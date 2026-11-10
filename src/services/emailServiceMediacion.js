const { supabase } = require('../utils/db')
const logger = require('../utils/logger')
const emailService = require('./emailService')
const mediacionesService = require('./mediacionesService')
const pdfMediacionService = require('./pdfMediacionService')
const { registrarAuditoria } = require('./auditoriaService')
const { renderActaMediacionOficialTemplate } = require('../utils/emailTemplates')

// =============================================================================
// SERVICIO DISPATCHER TRANSACCIONAL DE CORREOS: ACTA DE MEDIACIÓN (TASK 7.2.3.2)
// Despacho a Apoderados Titulares y Profesores Jefes con Desduplicación Estricta
// =============================================================================

/**
 * Extrae y desduplica los destinatarios del acta (Apoderados Titulares y Profesores Jefes).
 *
 * @param {string} tenantId - UUID del establecimiento
 * @param {Object} mediacion - Datos de la mediación con participantes y cursos
 * @returns {Promise<Array<Object>>} Lista desduplicada de destinatarios
 */
const obtenerDestinatariosDesduplicados = async (tenantId, mediacion) => {
  const participantes = mediacion.mediacion_participantes || []
  const mapaDestinatarios = new Map() // key: email en minusculas
  const profesorJefeIds = new Set()
  const cursoDocenteMap = new Map() // profesorJefeId -> Set de nombres de cursos

  // 1. Procesar apoderados titulares y recolectar IDs de profesores jefes
  for (const part of participantes) {
    const estudiante = part.estudiantes || {}
    const estudianteNombre = `${estudiante.nombre || ''} ${estudiante.apellido || ''}`.trim() || 'Estudiante'
    const cursoNombre = estudiante.cursos?.nombre || 'Curso no asignado'

    // Soporte para profesor jefe incrustado en el objeto (p.ej. JOIN en Supabase o mock)
    const pjObj = estudiante.cursos?.profesores_jefes || estudiante.cursos?.profesor_jefe
    const profeId = estudiante.cursos?.profesor_jefe_id || pjObj?.id

    if (pjObj && pjObj.email) {
      const emailNormalizado = pjObj.email.trim().toLowerCase()
      const profeNombre = `${pjObj.nombre || ''} ${pjObj.apellido || ''}`.trim() || 'Profesor/a Jefe'

      if (!mapaDestinatarios.has(emailNormalizado)) {
        mapaDestinatarios.set(emailNormalizado, {
          email: emailNormalizado,
          nombre: profeNombre,
          tipo: 'profesor_jefe',
          cursos: [cursoNombre],
        })
      } else {
        const destExistente = mapaDestinatarios.get(emailNormalizado)
        destExistente.tipo = 'profesor_jefe'
        destExistente.cursos = Array.from(new Set([...(destExistente.cursos || []), cursoNombre]))
      }
    } else if (profeId) {
      profesorJefeIds.add(profeId)
      if (!cursoDocenteMap.has(profeId)) {
        cursoDocenteMap.set(profeId, new Set())
      }
      cursoDocenteMap.get(profeId).add(cursoNombre)
    }

    // Buscar apoderado titular del estudiante
    const apoderados = estudiante.apoderados || []
    const apoderadoTitular = apoderados.find((a) => a.es_titular && a.email) || apoderados.find((a) => a.email)

    if (apoderadoTitular && apoderadoTitular.email) {
      const emailNormalizado = apoderadoTitular.email.trim().toLowerCase()
      const apoderadoNombre = `${apoderadoTitular.nombre || ''} ${apoderadoTitular.apellido || ''}`.trim() || 'Apoderado/a'

      if (!mapaDestinatarios.has(emailNormalizado)) {
        mapaDestinatarios.set(emailNormalizado, {
          email: emailNormalizado,
          nombre: apoderadoNombre,
          tipo: 'apoderado_titular',
          estudiantes: [estudianteNombre],
        })
      } else {
        const destExistente = mapaDestinatarios.get(emailNormalizado)
        if (!destExistente.estudiantes.includes(estudianteNombre)) {
          destExistente.estudiantes.push(estudianteNombre)
        }
      }
    }
  }

  // 2. Consultar datos de profesores jefes únicos si existen
  if (profesorJefeIds.size > 0) {
    const idsArray = Array.from(profesorJefeIds)
    const { data: profesores, error: errProfes } = await supabase
      .from('usuarios')
      .select('id, nombre, apellido, email')
      .in('id', idsArray)
      .eq('tenant_id', tenantId)

    if (errProfes) {
      logger.error('Error al consultar usuarios profesores jefes para despacho de acta:', errProfes)
    } else if (profesores) {
      for (const profe of profesores) {
        if (profe.email) {
          const emailNormalizado = profe.email.trim().toLowerCase()
          const profeNombre = `${profe.nombre || ''} ${profe.apellido || ''}`.trim() || 'Profesor/a Jefe'
          const cursosAsociados = Array.from(cursoDocenteMap.get(profe.id) || [])

          // Desduplicación garantizada: si el profesor jefe es el mismo para ambos alumnos,
          // se consolida en una única entrada
          if (!mapaDestinatarios.has(emailNormalizado)) {
            mapaDestinatarios.set(emailNormalizado, {
              email: emailNormalizado,
              nombre: profeNombre,
              tipo: 'profesor_jefe',
              cursos: cursosAsociados,
            })
          } else {
            const destExistente = mapaDestinatarios.get(emailNormalizado)
            destExistente.tipo = 'profesor_jefe' // prioridad de rol institucional
            destExistente.cursos = Array.from(new Set([...(destExistente.cursos || []), ...cursosAsociados]))
          }
        }
      }
    }
  }

  return Array.from(mapaDestinatarios.values())
}

/**
 * Despacha transaccionalmente el Acta Oficial de Mediación Escolar por correo
 * a los apoderados titulares y profesores jefes, adjuntando el PDF y registrando
 * la trazabilidad con hash SHA-256 en auditoría.
 *
 * @param {Object} params
 * @param {string} params.tenantId - UUID del colegio
 * @param {string} params.mediacionId - UUID de la mediación
 * @param {string} params.usuarioId - UUID del usuario solicitante
 * @returns {Promise<Object>} Resumen del despacho y hash de verificación
 */
const despacharActaOficial = async ({ tenantId, mediacionId, usuarioId }) => {
  if (!tenantId || !mediacionId) {
    const err = new Error('tenantId y mediacionId son requeridos para despachar el acta')
    err.statusCode = 400
    throw err
  }

  // 1. Obtener expediente detallado de la mediación
  const mediacion = await mediacionesService.obtenerMediacionPorId(tenantId, mediacionId)
  if (!mediacion) {
    const err = new Error('Mediación escolar no encontrada')
    err.statusCode = 404
    throw err
  }

  // 2. Obtener destinatarios desduplicados
  const destinatarios = await obtenerDestinatariosDesduplicados(tenantId, mediacion)

  if (destinatarios.length === 0) {
    const err = new Error('No se encontraron correos válidos de apoderados ni profesores jefes para esta mediación')
    err.statusCode = 400
    throw err
  }

  // 3. Generar el PDF oficial del acta y calcular el hash inmutable SHA-256
  const pdfBuffer = await pdfMediacionService.generarActaMediacionPDF(mediacion)
  const hashSha256 = pdfMediacionService.calcularHashMediacion(mediacion)
  const folioSeguro = (mediacion.folio || 'S-F').replace(/[^a-zA-Z0-9_-]/g, '_')
  const filename = `Acta_Mediacion_${folioSeguro}.pdf`

  // 4. Preparar adjunto en Base64 para serialización en cola Redis/Bull
  const attachments = [
    {
      filename,
      content: pdfBuffer.toString('base64'),
      contentType: 'application/pdf',
      encoding: 'base64',
    },
  ]

  // Formateo de fechas y datos comunes para las plantillas
  const fechaSesionFormateada = mediacion.fecha_programada
    ? new Date(mediacion.fecha_programada).toLocaleDateString('es-CL', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'No especificada'

  const fechaSeguimientoFormateada = mediacion.fecha_seguimiento
    ? new Date(mediacion.fecha_seguimiento).toLocaleDateString('es-CL', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : 'Por coordinar'

  const mediadorNombre = mediacion.usuarios
    ? `${mediacion.usuarios.nombre || ''} ${mediacion.usuarios.apellido || ''}`.trim()
    : 'Encargado/a de Convivencia Escolar'

  const nombresEstudiantes = (mediacion.mediacion_participantes || [])
    .map((p) => {
      const e = p.estudiantes || {}
      return `${e.nombre || ''} ${e.apellido || ''}`.trim()
    })
    .filter(Boolean)

  const estudiantesTexto = nombresEstudiantes.join(' y ') || 'Estudiantes participantes'
  const timestampDespacho = new Date().toISOString()
  const resultadosEnvio = []

  // 5. Despacho individual por cada destinatario desduplicado
  for (const dest of destinatarios) {
    try {
      const rolLabel = dest.tipo === 'apoderado_titular' ? 'Apoderado/a Titular' : 'Profesor/a Jefe'

      const html = renderActaMediacionOficialTemplate({
        destinatarioNombre: dest.nombre,
        rolDestinatario: rolLabel,
        folio: mediacion.folio || 'EN TRÁMITE',
        fechaSesion: fechaSesionFormateada,
        lugarSesion: mediacion.lugar_sesion || 'Oficina de Convivencia Escolar',
        mediadorNombre,
        estudiantesTexto,
        fechaSeguimiento: fechaSeguimientoFormateada,
        hashSha256,
        filename,
      })

      const subject = `[SIGA Escolar] Acta Oficial de Mediación Escolar — Folio ${mediacion.folio || 'S-F'}`

      await emailService.enviarEmail({
        to: dest.email,
        subject,
        html,
        attachments,
      })

      resultadosEnvio.push({
        email: dest.email,
        nombre: dest.nombre,
        tipo: dest.tipo,
        estado: 'enviado',
      })
    } catch (errEnvio) {
      logger.error(`Error al enviar acta de mediación a destinatario (${dest.email}):`, errEnvio)
      resultadosEnvio.push({
        email: dest.email,
        nombre: dest.nombre,
        tipo: dest.tipo,
        estado: 'fallido',
        error: errEnvio.message,
      })
    }
  }

  // 6. Inserción de registro inmutable en auditoría con destinatarios, timestamp y hash SHA-256
  const payloadAuditoria = {
    folio: mediacion.folio,
    mediacion_id: mediacion.id,
    total_destinatarios: destinatarios.length,
    destinatarios: resultadosEnvio,
    hash_sha256: hashSha256,
    timestamp: timestampDespacho,
  }

  try {
    await registrarAuditoria({
      tenantId,
      userId: usuarioId,
      accion: 'SEND_EMAIL',
      tabla: 'mediacion_actas',
      registroId: mediacion.id,
      datosBefore: null,
      datosAfter: payloadAuditoria,
    })
  } catch (auditErr) {
    logger.warn('Advertencia: No se pudo registrar auditoría estándar para despacho de acta:', auditErr.message)
  }

  // Respaldo de compatibilidad directa en tabla auditoria_logs si existe
  try {
    await supabase.from('auditoria_logs').insert({
      tenant_id: tenantId,
      usuario_id: usuarioId,
      accion: 'DESPACHO_ACTA_MEDIACION',
      tabla: 'mediaciones',
      registro_id: mediacion.id,
      datos: payloadAuditoria,
      created_at: timestampDespacho,
    })
  } catch (_e) {
    // Si la tabla física no existe, registrarAuditoria ya cubrió la tabla auditoria
  }

  return {
    mediacion_id: mediacion.id,
    folio: mediacion.folio,
    total_destinatarios: destinatarios.length,
    destinatarios: resultadosEnvio,
    hash_sha256: hashSha256,
    timestamp: timestampDespacho,
    filename,
  }
}

module.exports = {
  despacharActaOficial,
  obtenerDestinatariosDesduplicados,
}
