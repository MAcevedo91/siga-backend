const { supabase } = require('../utils/db')
const { registrarAuditoria } = require('./auditoriaService')
const logger = require('../utils/logger')

// =============================================================================
// SERVICIO EXTRACTOR Y SANITIZADOR DE EXPEDIENTE PARA SALUD (TASK 8.2.1.1)
// Cumplimiento: Ley N° 19.628, Circular N° 482 y Ley N° 20.584 (Derechos del Paciente)
// =============================================================================

// Expresiones regulares para PII sensible
const REGEX_RUT = /\b(\d{1,2}(?:\.?\d{3}){2}-[\dkK]|\d{7,8}-[\dkK])\b/gi
const REGEX_EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g
const REGEX_TELEFONO = /(?:\+?56\s?9|\b9)\s?\d{4}\s?\d{4}\b/g

/**
 * Escapa caracteres especiales de regex para búsqueda literal segura.
 *
 * @param {string} str
 * @returns {string}
 */
const escapeRegExp = (str) => {
  if (!str || typeof str !== 'string') return ''
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Convierte un nombre de persona en iniciales genéricas.
 * Ejemplo: "Juan Carlos Pérez González" -> "J. C. P. G."
 * Ejemplo: "Camila Soto" -> "C. S."
 *
 * @param {string} nombreCompleto
 * @returns {string} Iniciales separadas por punto
 */
const convertirAIniciales = (nombreCompleto) => {
  if (!nombreCompleto || typeof nombreCompleto !== 'string') return 'N. N.'
  const palabras = nombreCompleto
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0)

  if (palabras.length === 0) return 'N. N.'
  return palabras.map((p) => `${p[0].toUpperCase()}.`).join(' ')
}

/**
 * Anonimiza un texto escolar reemplazando los nombres y apellidos de terceros
 * (compañeros de curso y otros estudiantes) por sus iniciales genéricas,
 * resguardando y preservando intacta la identidad del estudiante foco/paciente.
 *
 * @param {string} texto - Relato de incidente, observación o acuerdo
 * @param {Array<Object>} listaTerceros - Lista de compañeros u otros involucrados ({ id, nombre, apellido })
 * @param {Object} estudianteFoco - Estudiante evaluado ({ id, nombre, apellido, rut })
 * @returns {string} Texto completamente sanitizado y anonimizado
 */
const anonimizarRelatoConIniciales = (texto, listaTerceros = [], estudianteFoco = {}) => {
  if (!texto || typeof texto !== 'string') return ''

  let resultado = texto

  // 1. Censurar correos y teléfonos
  resultado = resultado
    .replace(REGEX_EMAIL, '[EMAIL_RESERVADO]')
    .replace(REGEX_TELEFONO, '[TEL_RESERVADO]')

  // 2. Censurar RUTs de terceros (preservando el RUT del estudiante foco si aparece)
  const rutFocoLimpio = (estudianteFoco.rut || '').replace(/\./g, '').toLowerCase()

  resultado = resultado.replace(REGEX_RUT, (coincidencia) => {
    const rutCoincidenciaLimpio = coincidencia.replace(/\./g, '').toLowerCase()
    if (rutFocoLimpio && rutCoincidenciaLimpio === rutFocoLimpio) {
      return coincidencia
    }
    return '[RUT_RESERVADO]'
  })

  // 3. Anonimizar nombres de terceros por iniciales genéricas
  const focoNombre = (estudianteFoco.nombre || '').trim().toLowerCase()
  const focoApellido = (estudianteFoco.apellido || '').trim().toLowerCase()
  const focoCompleto = `${focoNombre} ${focoApellido}`.trim()

  // Extraer tokens de reemplazo para terceros (excluyendo al estudiante foco)
  const reglasReemplazo = []

  listaTerceros.forEach((tercero) => {
    if (!tercero) return
    const id = tercero.id || tercero.estudiante_id
    if (id && estudianteFoco.id && id === estudianteFoco.id) return

    const tNombre = (tercero.nombre || '').trim()
    const tApellido = (tercero.apellido || '').trim()
    const tCompleto = `${tNombre} ${tApellido}`.trim()

    // Si coincide exactamente con el estudiante foco, no anonimizar
    if (tCompleto.toLowerCase() === focoCompleto) return

    const inicialesCompletas = convertirAIniciales(tCompleto)
    const inicialNombre = tNombre.length > 0 ? `${tNombre[0].toUpperCase()}.` : ''
    const inicialApellido = tApellido.length > 0 ? `${tApellido[0].toUpperCase()}.` : ''

    // Nombre completo (prioridad más alta por longitud)
    if (tCompleto.length >= 3) {
      reglasReemplazo.push({
        patron: new RegExp(`\\b${escapeRegExp(tCompleto)}\\b`, 'gi'),
        reemplazo: inicialesCompletas,
        longitud: tCompleto.length,
      })
    }

    // Nombre de pila (solo si no coincide con el nombre de pila del foco y tiene >= 3 caracteres)
    if (tNombre.length >= 3 && tNombre.toLowerCase() !== focoNombre) {
      reglasReemplazo.push({
        patron: new RegExp(`\\b${escapeRegExp(tNombre)}\\b`, 'gi'),
        reemplazo: inicialNombre,
        longitud: tNombre.length,
      })
    }

    // Apellido (solo si no coincide con el apellido del foco y tiene >= 3 caracteres)
    if (tApellido.length >= 3 && tApellido.toLowerCase() !== focoApellido) {
      reglasReemplazo.push({
        patron: new RegExp(`\\b${escapeRegExp(tApellido)}\\b`, 'gi'),
        reemplazo: inicialApellido,
        longitud: tApellido.length,
      })
    }
  })

  // Ordenar reglas por longitud descendente para evitar colisiones de subcadenas
  reglasReemplazo.sort((a, b) => b.longitud - a.longitud)

  // Aplicar reemplazos de nombres
  reglasReemplazo.forEach(({ patron, reemplazo }) => {
    resultado = resultado.replace(patron, reemplazo)
  })

  return resultado
}

/**
 * Extrae y sanitiza el expediente escolar y de convivencia de un estudiante
 * para remitirlo de forma legal y segura a un especialista externo de salud.
 *
 * @param {string} tenantId - UUID del establecimiento
 * @param {string} estudianteId - UUID del estudiante derivado/paciente
 * @param {Object} usuarioSolicitante - Usuario que genera el expediente ({ id, nombre, apellido, rol })
 * @param {Object} opciones - Metadatos de la solicitud ({ motivo, especialistaDestino, ip })
 * @returns {Promise<Object>} Expediente clínico-escolar sanitizado y auditado
 */
const extraerExpedienteEspecialistaSalud = async (
  tenantId,
  estudianteId,
  usuarioSolicitante,
  opciones = {}
) => {
  if (!estudianteId) {
    const err = new Error('estudianteId es requerido')
    err.statusCode = 400
    throw err
  }

  // 1. Obtener datos del estudiante foco
  const { data: estudiante, error: estErr } = await supabase
    .from('estudiantes')
    .select(`
      id,
      rut,
      nombre,
      apellido,
      fecha_nacimiento,
      genero,
      curso_id,
      estado_matricula,
      cursos ( id, nombre, nivel, letra, anio_academico )
    `)
    .eq('id', estudianteId)
    .eq('tenant_id', tenantId)
    .single()

  if (estErr || !estudiante) {
    const err = new Error('Estudiante no encontrado en el establecimiento')
    err.statusCode = 404
    throw err
  }

  // 2. Obtener nómina de terceros (compañeros de curso y otros alumnos) para el motor de anonimización
  const { data: companerosCurso } = await supabase
    .from('estudiantes')
    .select('id, nombre, apellido')
    .eq('curso_id', estudiante.curso_id)
    .eq('tenant_id', tenantId)

  const listaTerceros = companerosCurso || []

  // 3. Consultar y sanitizar INCIDENTES disciplinarios donde participó el estudiante
  const { data: participanteIncidentes, error: incErr } = await supabase
    .from('incidente_estudiantes')
    .select(`
      incidente_id,
      estudiante_id,
      es_victima,
      rol,
      observacion,
      incidentes!inner (
        id,
        folio,
        fecha,
        gravedad,
        tipo_incidente,
        descripcion,
        medidas_tomadas,
        acuerdos,
        estado,
        tenant_id
      )
    `)
    .eq('estudiante_id', estudianteId)
    .eq('incidentes.tenant_id', tenantId)

  if (incErr) {
    logger.warn('Advertencia al consultar incidentes para expediente de salud:', incErr.message)
  }

  // Para cada incidente, buscar los demás participantes para anonimizarlos
  const incidentesIds = (participanteIncidentes || []).map((p) => p.incidente_id)
  let incidentesTodosParticipantes = []

  if (incidentesIds.length > 0) {
    const { data: otrosPart } = await supabase
      .from('incidente_estudiantes')
      .select(`
        incidente_id,
        estudiante_id,
        rol,
        estudiantes ( id, nombre, apellido )
      `)
      .in('incidente_id', incidentesIds)

    incidentesTodosParticipantes = otrosPart || []

    // Agregar estudiantes externos a listaTerceros si no estaban
    incidentesTodosParticipantes.forEach((op) => {
      if (op.estudiantes && op.estudiante_id !== estudianteId) {
        if (!listaTerceros.some((t) => t.id === op.estudiante_id)) {
          listaTerceros.push(op.estudiantes)
        }
      }
    })
  }

  const incidentesSanitizados = (participanteIncidentes || []).map((item) => {
    const inc = item.incidentes || {}
    const otrosInvolucrados = incidentesTodosParticipantes
      .filter((p) => p.incidente_id === inc.id && p.estudiante_id !== estudianteId)
      .map((p) => {
        const estTercero = p.estudiantes || {}
        const nombreCompleto = `${estTercero.nombre || ''} ${estTercero.apellido || ''}`.trim()
        return {
          id: p.estudiante_id,
          iniciales: convertirAIniciales(nombreCompleto),
          rol: p.rol || 'Participante',
        }
      })

    return {
      id: inc.id,
      folio: inc.folio || 'S/F',
      fecha: inc.fecha || inc.fecha_incidente || null,
      gravedad: inc.gravedad || 'Leve',
      tipo_incidente: inc.tipo_incidente || 'Convivencia escolar',
      rol_estudiante_foco: item.rol || (item.es_victima ? 'Afectado' : 'Involucrado'),
      descripcion_sanitizada: anonimizarRelatoConIniciales(inc.descripcion, listaTerceros, estudiante),
      medidas_tomadas_sanitizadas: anonimizarRelatoConIniciales(inc.medidas_tomadas, listaTerceros, estudiante),
      acuerdos_sanitizados: anonimizarRelatoConIniciales(inc.acuerdos, listaTerceros, estudiante),
      observacion_individual_sanitizada: anonimizarRelatoConIniciales(item.observacion, listaTerceros, estudiante),
      estado: inc.estado || 'cerrado',
      otros_involucrados_anonimizados: otrosInvolucrados,
    }
  })

  // 4. Consultar y sanitizar MEDIACIONES ESCOLARES
  const { data: participanteMediaciones, error: medErr } = await supabase
    .from('mediacion_participantes')
    .select(`
      mediacion_id,
      estudiante_id,
      rol_participante,
      mediaciones!inner (
        id,
        folio,
        fecha_programada,
        fecha_acuerdo,
        estado,
        motivo,
        conclusiones_cierre,
        tenant_id
      )
    `)
    .eq('estudiante_id', estudianteId)
    .eq('mediaciones.tenant_id', tenantId)

  if (medErr) {
    logger.warn('Advertencia al consultar mediaciones para expediente de salud:', medErr.message)
  }

  const mediacionesSanitizadas = (participanteMediaciones || []).map((item) => {
    const med = item.mediaciones || {}
    return {
      id: med.id,
      folio: med.folio || 'S/F',
      fecha_programada: med.fecha_programada,
      fecha_acuerdo: med.fecha_acuerdo,
      estado: med.estado,
      motivo_sanitizado: anonimizarRelatoConIniciales(med.motivo, listaTerceros, estudiante),
      conclusiones_sanitizadas: anonimizarRelatoConIniciales(med.conclusiones_cierre, listaTerceros, estudiante),
    }
  })

  // 5. Consultar y sanitizar DERIVACIONES previas
  const { data: derivacionesData } = await supabase
    .from('derivaciones')
    .select('id, tipo, prioridad, motivo, created_at, estado')
    .eq('estudiante_id', estudianteId)
    .eq('tenant_id', tenantId)

  const derivacionesSanitizadas = (derivacionesData || []).map((d) => ({
    id: d.id,
    tipo: d.tipo,
    prioridad: d.prioridad,
    motivo_sanitizado: anonimizarRelatoConIniciales(d.motivo, listaTerceros, estudiante),
    fecha_derivacion: d.created_at,
    estado: d.estado || 'activa',
  }))

  // 6. Registrar evento en bitácora inmutable de auditoría (auditoria / auditoria_logs)
  const metadataAuditoria = {
    estudiante_id: estudiante.id,
    estudiante_rut: estudiante.rut,
    estudiante_nombre: `${estudiante.nombre} ${estudiante.apellido}`.trim(),
    curso: estudiante.cursos?.nombre || 'S/C',
    especialista_destino: opciones.especialistaDestino || 'Especialista Externo de Salud',
    motivo_solicitud: opciones.motivo || 'Evaluación médica/psicológica externa',
    total_incidentes_sanitizados: incidentesSanitizados.length,
    total_mediaciones_sanitizadas: mediacionesSanitizadas.length,
    total_derivaciones_sanitizadas: derivacionesSanitizadas.length,
    timestamp: new Date().toISOString(),
  }

  try {
    await registrarAuditoria({
      tenantId,
      userId: usuarioSolicitante?.id || usuarioSolicitante?.user_id,
      accion: 'GENERAR_REPORTE_ESPECIALISTA',
      tabla: 'estudiantes',
      registroId: estudiante.id,
      datosBefore: null,
      datosAfter: metadataAuditoria,
      ip: opciones.ip || null,
    })
  } catch (auditErr) {
    logger.error('Error al registrar auditoría de expediente para especialista:', auditErr)
  }

  return {
    estudiante_evaluado: {
      id: estudiante.id,
      rut: estudiante.rut,
      nombre: estudiante.nombre,
      apellido: estudiante.apellido,
      nombre_completo: `${estudiante.nombre} ${estudiante.apellido}`.trim(),
      fecha_nacimiento: estudiante.fecha_nacimiento,
      genero: estudiante.genero,
      curso: estudiante.cursos ? `${estudiante.cursos.nombre}`.trim() : 'Sin curso asignado',
      estado_matricula: estudiante.estado_matricula,
    },
    resumen_clinico_escolar: {
      total_incidentes_registrados: incidentesSanitizados.length,
      total_mediaciones_registradas: mediacionesSanitizadas.length,
      total_derivaciones_previas: derivacionesSanitizadas.length,
      fecha_emision: new Date().toISOString(),
      solicitante: {
        id: usuarioSolicitante?.id || usuarioSolicitante?.user_id,
        nombre: `${usuarioSolicitante?.nombre || ''} ${usuarioSolicitante?.apellido || ''}`.trim() || 'Funcionario Autorizado',
        rol: usuarioSolicitante?.rol || 'Equipo Psicosocial / Directivo',
      },
      destinatario_especialista: opciones.especialistaDestino || 'Especialista Externo de Salud',
      motivo_informe: opciones.motivo || 'Evaluación médica/psicosocial',
      aviso_confidencialidad: 'DOCUMENTO CONFIDENCIAL — LEY N° 19.628 Y LEY N° 20.584. Nombres de terceros anonimizados con iniciales genéricas para resguardo estricto de privacidad de menores de edad.',
    },
    incidentes: incidentesSanitizados,
    mediaciones: mediacionesSanitizadas,
    derivaciones_anteriores: derivacionesSanitizadas,
  }
}

module.exports = {
  REGEX_RUT,
  REGEX_EMAIL,
  REGEX_TELEFONO,
  escapeRegExp,
  convertirAIniciales,
  anonimizarRelatoConIniciales,
  extraerExpedienteEspecialistaSalud,
}
