const { supabase } = require('../utils/db')
const logger = require('../utils/logger')
const emailService = require('./emailService')
const pdfCitacionActaService = require('./pdfCitacionActaService')
const { registrarAuditoria } = require('./auditoriaService')
const { renderActaCitacionOficialTemplate } = require('../utils/emailTemplates')

// =============================================================================
// SERVICIO DISPATCHER DE CORREOS: ACTA DE CITACIÓN Y ACUERDOS MUTUOS
// TASK 10.2.2 / SPRINT 10 — Escuela Coeducacional N° 1 El Salvador
// Despacho a Apoderado Titular y Copia Informativa al Profesor Jefe del Curso
// =============================================================================

const CATEGORIAS_LABELS = {
  refuerzo_academico:         'Refuerzo Académico',
  habitos_asistencia:         'Hábitos y Asistencia',
  reconocimiento_felicitacion: 'Reconocimiento y Felicitación',
  acuerdos_convivencia:       'Acuerdos de Convivencia',
  seguimiento_formativo:      'Seguimiento Formativo',
}

/**
 * Resuelve y desduplica los destinatarios del acta oficial:
 * 1. Apoderado Titular del estudiante
 * 2. Profesor/a Jefe del curso del estudiante
 *
 * @param {string} tenantId - UUID del colegio
 * @param {Object} citacion - Datos de la citación, estudiante, apoderado y curso
 * @returns {Promise<Array<Object>>} Lista desduplicada de destinatarios con roles
 */
const obtenerDestinatariosCitacion = async (tenantId, citacion) => {
  const mapaDestinatarios = new Map()

  // 1. Apoderado Titular convocado
  const apoderado = citacion.apoderado || {}
  const apoEmail = (apoderado.email || '').trim().toLowerCase()
  if (apoEmail) {
    const apoNombre = `${apoderado.nombre || ''} ${apoderado.apellido || ''}`.trim() || 'Apoderado/a Titular'
    mapaDestinatarios.set(apoEmail, {
      email: apoEmail,
      nombre: apoNombre,
      tipo: 'apoderado_titular',
      rolLabel: 'Apoderado/a Titular',
    })
  }

  // 2. Profesor Jefe del Curso
  const estudiante = citacion.estudiante || {}
  const curso = estudiante.cursos || estudiante.curso || {}
  let pjEmail = null
  let pjNombre = null

  // Si el objeto curso ya tiene incrustado el profesor jefe
  if (curso.profesores_jefes || curso.profesor_jefe) {
    const pjObj = curso.profesores_jefes || curso.profesor_jefe
    pjEmail = (pjObj.email || '').trim().toLowerCase()
    pjNombre = `${pjObj.nombre || ''} ${pjObj.apellido || ''}`.trim() || 'Profesor/a Jefe'
  } else if (curso.profesor_jefe_id || estudiante.curso_id) {
    try {
      let profeId = curso.profesor_jefe_id

      // Si no tenemos el profesor_jefe_id pero sí el curso_id, consultar el curso
      if (!profeId && estudiante.curso_id) {
        const { data: cursoDb } = await supabase
          .from('cursos')
          .select('profesor_jefe_id')
          .eq('id', estudiante.curso_id)
          .eq('tenant_id', tenantId)
          .maybeSingle()
        if (cursoDb) profeId = cursoDb.profesor_jefe_id
      }

      if (profeId) {
        const { data: profeDb } = await supabase
          .from('usuarios')
          .select('id, nombre, apellido, email')
          .eq('id', profeId)
          .eq('tenant_id', tenantId)
          .maybeSingle()

        if (profeDb && profeDb.email) {
          pjEmail = profeDb.email.trim().toLowerCase()
          pjNombre = `${profeDb.nombre || ''} ${profeDb.apellido || ''}`.trim() || 'Profesor/a Jefe'
        }
      }
    } catch (errPj) {
      logger.warn('No se pudo resolver el profesor jefe del curso para copia de citación:', errPj.message)
    }
  }

  // Si no se halló profesor jefe pero la citación fue convocada por un docente, remitir copia al docente
  if (!pjEmail && citacion.docente && citacion.docente.email) {
    pjEmail = citacion.docente.email.trim().toLowerCase()
    pjNombre = `${citacion.docente.nombre || ''} ${citacion.docente.apellido || ''}`.trim() || 'Docente Convocante'
  }

  // Agregar profesor jefe desduplicando
  if (pjEmail) {
    if (!mapaDestinatarios.has(pjEmail)) {
      mapaDestinatarios.set(pjEmail, {
        email: pjEmail,
        nombre: pjNombre,
        tipo: 'profesor_jefe',
        rolLabel: 'Profesor/a Jefe del Curso',
      })
    } else {
      // Si el apoderado y el profesor jefe tienen el mismo correo (caso anómalo de prueba)
      const actual = mapaDestinatarios.get(pjEmail)
      actual.rolLabel = `${actual.rolLabel} y Profesor/a Jefe`
    }
  }

  return Array.from(mapaDestinatarios.values())
}

/**
 * Despacha transaccionalmente el Acta Oficial de Citación por correo electrónico
 * al Apoderado Titular y con copia informativa al Profesor Jefe del curso.
 *
 * @param {Object} params
 * @param {string} params.tenantId - UUID del colegio
 * @param {string} params.citacionId - UUID de la citación
 * @param {string} params.usuarioId - UUID del usuario que ejecuta el despacho
 * @returns {Promise<Object>} Resumen del despacho y trazabilidad
 */
const despacharActaOficialCitacion = async ({ tenantId, citacionId, usuarioId }) => {
  if (!tenantId || !citacionId) {
    const err = new Error('tenantId y citacionId son obligatorios para despachar el acta oficial')
    err.statusCode = 400
    throw err
  }

  // 1. Obtener la citación completa con estudiante, apoderado, docente y curso
  const { data: citacion, error: errCitacion } = await supabase
    .from('citaciones_formativas')
    .select(`
      id, tenant_id, folio, motivo_categoria, motivo_detalle,
      fecha_hora_programada, modalidad, lugar_entrevista, estado,
      estudiantes (
        id, nombre, apellido, rut, curso_id,
        cursos ( id, nombre, nivel, profesor_jefe_id )
      ),
      apoderados ( id, nombre, apellido, rut, email, telefono ),
      usuarios:docente_id ( id, nombre, apellido, email )
    `)
    .eq('id', citacionId)
    .eq('tenant_id', tenantId)
    .single()

  if (errCitacion || !citacion) {
    const err = new Error('Citación formativa no encontrada')
    err.statusCode = 404
    throw err
  }

  // Normalizar estructura
  const citacionFormateada = {
    ...citacion,
    estudiante: citacion.estudiantes || {},
    apoderado: citacion.apoderados || {},
    docente: citacion.usuarios || {},
  }

  // 2. Obtener los acuerdos mutuos suscritos
  const { data: acuerdos } = await supabase
    .from('citacion_acuerdos_mutuos')
    .select('*')
    .eq('citacion_id', citacionId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  const acuerdosObj = acuerdos || {
    compromisos_colegio: [],
    compromisos_apoderado: [],
    fecha_proximo_seguimiento: null,
  }

  // 3. Obtener destinatarios desduplicados
  const destinatarios = await obtenerDestinatariosCitacion(tenantId, citacionFormateada)

  if (destinatarios.length === 0) {
    const err = new Error('No se encontraron correos electrónicos válidos del apoderado ni del profesor jefe para despachar el acta')
    err.statusCode = 400
    throw err
  }

  // 4. Generar el PDF oficial del acta y calcular su hash SHA-256
  const pdfBuffer = await pdfCitacionActaService.generarActaCitacionPDF(citacionFormateada, acuerdosObj)
  const hashSha256 = acuerdosObj.hash_sha256 || pdfCitacionActaService.calcularHashActaCitacion(citacionFormateada, acuerdosObj)
  const folioSeguro = (citacion.folio || 'CIT-2026').replace(/[^a-zA-Z0-9_-]/g, '_')
  const filename = `Acta_Citacion_${folioSeguro}.pdf`

  // Adjunto en Base64 para despacho seguro
  const attachments = [
    {
      filename,
      content: pdfBuffer.toString('base64'),
      contentType: 'application/pdf',
      encoding: 'base64',
    },
  ]

  // Formateo de datos para la plantilla
  const fechaEntrevistaStr = citacion.fecha_hora_programada
    ? new Date(citacion.fecha_hora_programada).toLocaleDateString('es-CL', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Coordinada en el establecimiento'

  const fechaSeguimientoStr = acuerdosObj.fecha_proximo_seguimiento
    ? new Date(acuerdosObj.fecha_proximo_seguimiento).toLocaleDateString('es-CL', {
        timeZone: 'UTC',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : 'Por coordinar'

  const estudianteNombre = `${citacionFormateada.estudiante.nombre || ''} ${citacionFormateada.estudiante.apellido || ''}`.trim() || 'Estudiante'
  const cursoNombre = citacionFormateada.estudiante.cursos?.nombre || 'Curso no asignado'
  const docenteNombre = citacionFormateada.docente.nombre
    ? `${citacionFormateada.docente.nombre} ${citacionFormateada.docente.apellido || ''}`.trim()
    : 'Profesor/a Jefe'
  const categoriaLabel = CATEGORIAS_LABELS[citacion.motivo_categoria] || citacion.motivo_categoria || 'Colaboración Pedagógica'

  const timestampDespacho = new Date().toISOString()
  const resultadosEnvio = []

  // 5. Envío formal individual a cada destinatario
  for (const dest of destinatarios) {
    try {
      const html = renderActaCitacionOficialTemplate({
        destinatarioNombre: dest.nombre,
        rolDestinatario: dest.rolLabel,
        folio: citacion.folio || 'CIT-2026',
        estudianteNombre,
        cursoNombre,
        docenteNombre,
        fechaEntrevista: fechaEntrevistaStr,
        motivoCategoria: categoriaLabel,
        fechaSeguimiento: fechaSeguimientoStr,
        filename,
        hashSha256,
      })

      const subject = `[SIGA Escolar] Acta Oficial de Compromisos Familia-Escuela — Folio ${citacion.folio || 'CIT-2026'}`

      const fromName = docenteNombre ? `${docenteNombre} (vía SIGA Escolar)` : 'SIGA Escolar — Escuela El Salvador'
      const replyTo = citacionFormateada.docente?.email || undefined

      await emailService.enviarEmail({
        to: dest.email,
        fromName,
        replyTo,
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
      logger.error(`Error al enviar acta de citación a (${dest.email}):`, errEnvio)
      resultadosEnvio.push({
        email: dest.email,
        nombre: dest.nombre,
        tipo: dest.tipo,
        estado: 'fallido',
        error: errEnvio.message,
      })
    }
  }

  // 6. Registro inmutable en auditoría institucional
  const payloadAuditoria = {
    folio: citacion.folio,
    citacion_id: citacion.id,
    estudiante_id: citacionFormateada.estudiante.id,
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
      tabla: 'citacion_acuerdos_mutuos',
      registroId: citacion.id,
      datosBefore: null,
      datosAfter: payloadAuditoria,
    })
  } catch (auditErr) {
    logger.warn('Advertencia: No se pudo registrar auditoría estándar para acta de citación:', auditErr.message)
  }

  try {
    await supabase.from('auditoria_logs').insert({
      tenant_id: tenantId,
      usuario_id: usuarioId,
      accion: 'DESPACHO_ACTA_CITACION',
      tabla: 'citaciones_formativas',
      registro_id: citacion.id,
      datos: payloadAuditoria,
      created_at: timestampDespacho,
    })
  } catch (_e) {
    // Si la tabla física no existe, registrarAuditoria ya cubrió la tabla auditoria
  }

  return {
    citacion_id: citacion.id,
    folio: citacion.folio,
    total_destinatarios: destinatarios.length,
    destinatarios: resultadosEnvio,
    hash_sha256: hashSha256,
    timestamp: timestampDespacho,
  }
}

module.exports = {
  obtenerDestinatariosCitacion,
  despacharActaOficialCitacion,
}
