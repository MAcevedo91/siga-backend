const { supabase } = require('../utils/db')
const logger = require('../utils/logger')
const { registrarAuditoria } = require('./auditoriaService')
const emailService = require('./emailService')
const { renderAvisoMediacionApoderadoTemplate } = require('../utils/emailTemplates')
const {
  crearMediacionSchema,
  filtrosMediacionesSchema,
  notificarApoderadosSchema,
  crearGuardarCompromisosSchema,
} = require('../schemas/mediacionesSchemas')

// =============================================================================
// MÓDULO DE SERVICIOS: MEDIACIÓN ESCOLAR Y ACUERDOS FORMATIVOS (SPRINT 7 / ÉPICA 7.2)
// =============================================================================

/**
 * Registra una nueva mediación escolar y sus estudiantes participantes.
 * Garantiza integridad atómica mediante validación previa y reversión compensatoria.
 *
 * @param {string} tenantId - UUID del establecimiento
 * @param {string} mediadorId - UUID del usuario que registra/asume como mediador
 * @param {Object} body - Datos de la mediación y participantes
 * @returns {Promise<Object>} Mediación creada con participantes y folio asignado
 */
const crearMediacion = async (tenantId, mediadorId, body) => {
  // 1. Validación estricta con esquema Zod
  const parseResult = crearMediacionSchema.safeParse(body)
  if (!parseResult.success) {
    const issues = parseResult.error.issues || parseResult.error.errors || []
    const errorDetails = issues.map((e) => e.message).join('. ') || 'Datos inválidos'
    const err = new Error(errorDetails)
    err.statusCode = 400
    throw err
  }


  const {
    tipo_origen,
    incidente_id,
    motivo,
    fecha_programada,
    lugar_sesion,
    observaciones_previas,
    participantes,
  } = parseResult.data

  // 2. Insertar cabecera de la mediación (el folio MED-YYYY-XXXX se genera vía trigger)
  const { data: mediacion, error: mediacionError } = await supabase
    .from('mediaciones')
    .insert({
      tenant_id: tenantId,
      mediador_id: mediadorId,
      tipo_origen,
      incidente_id: incidente_id || null,
      motivo,
      fecha_programada,
      lugar_sesion: lugar_sesion || 'Oficina de Convivencia Escolar',
      observaciones_previas: observaciones_previas || null,
      estado: 'programada',
    })
    .select()
    .single()

  if (mediacionError) {
    logger.error('Error al insertar registro en mediaciones:', mediacionError)
    const err = new Error(mediacionError.message || 'Error al crear la mediación')
    err.statusCode = 500
    throw err
  }

  // 3. Mapear e insertar participantes
  const participantesRows = participantes.map((p) => ({
    mediacion_id: mediacion.id,
    tenant_id: tenantId,
    estudiante_id: p.estudiante_id,
    rol_participante: p.rol_participante || 'parte_1',
    aviso_apoderado_enviado: false,
  }))

  const { error: participantesError } = await supabase
    .from('mediacion_participantes')
    .insert(participantesRows)

  if (participantesError) {
    logger.error('Error al insertar participantes, ejecutando rollback compensatorio:', participantesError)
    // Reversión atómica: si fallan los participantes, eliminamos la mediación huérfana
    await supabase.from('mediaciones').delete().eq('id', mediacion.id)
    const err = new Error(participantesError.message || 'Error al asociar estudiantes a la mediación')
    err.statusCode = 500
    throw err
  }

  // 4. Registro de auditoría inmutable
  try {
    await registrarAuditoria({
      tenantId,
      userId: mediadorId,
      accion: 'CREATE',
      tabla: 'mediaciones',
      registroId: mediacion.id,
      datosBefore: null,
      datosAfter: {
        id: mediacion.id,
        folio: mediacion.folio,
        estado: mediacion.estado,
        tipo_origen: mediacion.tipo_origen,
        total_participantes: participantesRows.length,
      },
    })
  } catch (auditErr) {
    logger.warn('Advertencia: No se pudo registrar auditoría de mediación:', auditErr.message)
  }

  // 5. Retornar mediación completa consolidada
  return obtenerMediacionPorId(tenantId, mediacion.id)
}

/**
 * Consulta listado paginado y filtrable de mediaciones escolares dentro del tenant.
 *
 * @param {string} tenantId - UUID del establecimiento
 * @param {Object} queryParams - Filtros y opciones de paginación
 * @returns {Promise<Object>} Resultado paginado con total y páginas
 */
const listarMediaciones = async (tenantId, queryParams = {}) => {
  const parseResult = filtrosMediacionesSchema.safeParse(queryParams)
  if (!parseResult.success) {
    const issues = parseResult.error.issues || parseResult.error.errors || []
    const errorDetails = issues.map((e) => e.message).join('. ') || 'Filtros inválidos'
    const err = new Error(errorDetails)
    err.statusCode = 400
    throw err
  }


  const {
    estado,
    tipo_origen,
    fecha_desde,
    fecha_hasta,
    curso_id,
    estudiante_id,
    page,
    limit,
  } = parseResult.data

  const from = (page - 1) * limit
  const to = from + limit - 1

  // Filtro previo por estudiante o curso si aplica
  let idsPorFiltroEstudiante = null
  if (estudiante_id || curso_id) {
    let partQuery = supabase
      .from('mediacion_participantes')
      .select('mediacion_id, estudiantes!inner(id, curso_id)')
      .eq('tenant_id', tenantId)

    if (estudiante_id) {
      partQuery = partQuery.eq('estudiante_id', estudiante_id)
    }
    if (curso_id) {
      partQuery = partQuery.eq('estudiantes.curso_id', curso_id)
    }

    const { data: partData, error: partError } = await partQuery
    if (partError) {
      logger.error('Error al filtrar participantes de mediación por estudiante/curso:', partError)
    } else {
      idsPorFiltroEstudiante = (partData || []).map((row) => row.mediacion_id)
      if (idsPorFiltroEstudiante.length === 0) {
        return {
          data: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        }
      }
    }
  }

  let query = supabase
    .from('mediaciones')
    .select(`
      id,
      folio,
      tipo_origen,
      estado,
      motivo,
      fecha_programada,
      lugar_sesion,
      observaciones_previas,
      fecha_seguimiento,
      conclusiones_cierre,
      created_at,
      updated_at,
      usuarios ( id, nombre, apellido, email ),
      mediacion_participantes (

        id,
        rol_participante,
        aviso_apoderado_enviado,
        fecha_aviso_apoderado,
        medio_aviso,
        apoderado_notificado_email,
        estudiantes (
          id,
          rut,
          nombre,
          apellido,
          curso_id,
          cursos ( id, nombre, nivel, letra, anio_academico )

        )
      )
    `, { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('fecha_programada', { ascending: false })

  if (estado) query = query.eq('estado', estado)
  if (tipo_origen) query = query.eq('tipo_origen', tipo_origen)
  if (fecha_desde) query = query.gte('fecha_programada', `${fecha_desde}T00:00:00.000Z`)
  if (fecha_hasta) query = query.lte('fecha_programada', `${fecha_hasta}T23:59:59.999Z`)
  if (idsPorFiltroEstudiante) query = query.in('id', idsPorFiltroEstudiante)

  query = query.range(from, to)

  const { data, count, error } = await query

  if (error) {
    logger.error('Error al listar mediaciones:', error)
    const err = new Error('Error al consultar listado de mediaciones')
    err.statusCode = 500
    throw err
  }

  const total = count || 0
  const totalPages = Math.ceil(total / limit)

  return {
    data: data || [],
    total,
    page,
    limit,
    totalPages,
  }
}

/**
 * Retorna el expediente detallado de una mediación escolar por ID.
 *
 * @param {string} tenantId - UUID del establecimiento
 * @param {string} id - UUID de la mediación
 * @returns {Promise<Object>} Datos detallados de la mediación
 */
const obtenerMediacionPorId = async (tenantId, id) => {
  const { data, error } = await supabase
    .from('mediaciones')
    .select(`
      id,
      folio,
      tipo_origen,
      estado,
      motivo,
      fecha_programada,
      lugar_sesion,
      observaciones_previas,
      fecha_seguimiento,
      conclusiones_cierre,
      created_at,
      updated_at,
      incidente_id,
      usuarios ( id, nombre, apellido, email ),
      mediacion_participantes (
        id,
        estudiante_id,
        rol_participante,
        aviso_apoderado_enviado,
        fecha_aviso_apoderado,
        medio_aviso,
        apoderado_notificado_email,
        estudiantes (
          id,
          rut,
          nombre,
          apellido,
          curso_id,
          cursos ( id, nombre, nivel, letra, anio_academico, profesor_jefe_id ),
          apoderados ( id, rut, nombre, apellido, email, telefono, es_titular )
        )
      ),
      mediacion_compromisos (
        id,
        estudiante_id,
        tipo_compromiso,
        descripcion,
        fecha_limite,
        cumplido,
        fecha_cumplimiento,
        observaciones_seguimiento,
        created_at,
        updated_at
      )
    `)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .single()

  if (error) {
    logger.error('Error al obtener mediación en Supabase:', error)
    if (error.code === 'PGRST116') {
      const err = new Error('Mediación no encontrada')
      err.statusCode = 404
      throw err
    }
    const err = new Error(error.message || 'Error al obtener mediación')
    err.statusCode = 500
    throw err
  }

  if (!data) {
    const err = new Error('Mediación no encontrada')
    err.statusCode = 404
    throw err
  }


  return data
}

/**
 * Notifica formalmente a los apoderados de los estudiantes participantes en una mediación.
 * Registra la marca temporal del aviso en la base de datos y envía correo formativo.
 *
 * @param {string} tenantId - UUID del establecimiento
 * @param {string} mediacionId - UUID de la mediación
 * @param {string} usuarioId - UUID del funcionario que ejecuta la notificación
 * @param {Object} body - Opciones del aviso (medio_aviso, mensaje_personalizado, etc.)
 * @returns {Promise<Object>} Resumen de notificaciones emitidas y marcas registradas
 */
const notificarApoderados = async (tenantId, mediacionId, usuarioId, body = {}) => {
  const parseResult = notificarApoderadosSchema.safeParse(body)
  if (!parseResult.success) {
    const issues = parseResult.error.issues || parseResult.error.errors || []
    const errorDetails = issues.map((e) => e.message).join('. ') || 'Parámetros de notificación inválidos'
    const err = new Error(errorDetails)
    err.statusCode = 400
    throw err
  }


  const { medio_aviso, mensaje_personalizado, estudiante_ids } = parseResult.data

  // 1. Obtener la mediación completa con participantes y apoderados
  const mediacion = await obtenerMediacionPorId(tenantId, mediacionId)

  let participantes = mediacion.mediacion_participantes || []
  if (estudiante_ids && estudiante_ids.length > 0) {
    participantes = participantes.filter((p) => estudiante_ids.includes(p.estudiante_id))
  }

  if (participantes.length === 0) {
    const err = new Error('No se encontraron participantes válidos para notificar')
    err.statusCode = 400
    throw err
  }

  const fechaFormateada = new Date(mediacion.fecha_programada).toLocaleString('es-CL', {
    dateStyle: 'full',
    timeStyle: 'short',
  })
  const mediadorNombre = mediacion.usuarios
    ? `${mediacion.usuarios.nombre} ${mediacion.usuarios.apellido}`
    : 'Equipo de Convivencia Escolar'

  const notificados = []
  const timestampAviso = new Date().toISOString()

  // 2. Iterar participantes y emitir notificación formativa
  for (const part of participantes) {
    const est = part.estudiantes
    const estudianteNombre = est ? `${est.nombre} ${est.apellido}` : 'Estudiante'
    const listaApoderados = (est && est.apoderados) || []
    const apoderadoTitular = listaApoderados.find((a) => a.es_titular) || listaApoderados[0]

    const emailDestino = apoderadoTitular ? apoderadoTitular.email : null

    if (medio_aviso === 'correo' && emailDestino) {
      try {
        const html = renderAvisoMediacionApoderadoTemplate({
          estudianteNombre,
          folio: mediacion.folio,
          fechaProgramada: fechaFormateada,
          lugarSesion: mediacion.lugar_sesion || 'Oficina de Convivencia Escolar',
          mediadorNombre,
          motivo: mediacion.motivo,
          mensajePersonalizado: mensaje_personalizado || '',
        })

        await emailService.enviarEmail({
          to: emailDestino,
          subject: `[SIGA Escolar] Citación a Mediación y Diálogo Formativo — Folio ${mediacion.folio}`,
          html,
          text: `Se informa que el/la estudiante ${estudianteNombre} ha sido citado/a a un espacio de mediación formativa (Folio ${mediacion.folio}) el día ${fechaFormateada} en ${mediacion.lugar_sesion}.`,
        })
      } catch (errEmail) {
        logger.error(`Error al enviar correo de mediación a apoderado (${emailDestino}):`, errEmail)
      }
    }

    // 3. Registrar marca temporal del aviso en mediacion_participantes
    const { error: updateError } = await supabase
      .from('mediacion_participantes')
      .update({
        aviso_apoderado_enviado: true,
        fecha_aviso_apoderado: timestampAviso,
        medio_aviso,
        apoderado_notificado_email: emailDestino || null,
      })
      .eq('id', part.id)
      .eq('tenant_id', tenantId)

    if (updateError) {
      logger.error(`Error al actualizar marca de aviso en participante ${part.id}:`, updateError)
    }

    notificados.push({
      participante_id: part.id,
      estudiante_id: part.estudiante_id,
      estudiante_nombre: estudianteNombre,
      apoderado_email: emailDestino,
      medio_aviso,
      fecha_aviso: timestampAviso,
    })
  }

  // 4. Registro de auditoría
  try {
    await registrarAuditoria({
      tenantId,
      userId: usuarioId,
      accion: 'UPDATE',
      tabla: 'mediacion_participantes',
      registroId: mediacionId,
      datosBefore: { mediacion_id: mediacionId, aviso_apoderado_enviado: false },
      datosAfter: {
        mediacion_id: mediacionId,
        total_notificados: notificados.length,
        medio_aviso,
        fecha_aviso: timestampAviso,
      },
    })
  } catch (auditErr) {
    logger.warn('Advertencia: No se pudo registrar auditoría de aviso a apoderados:', auditErr.message)
  }

  return {
    mediacion_id: mediacionId,
    folio: mediacion.folio,
    total_notificados: notificados.length,
    notificados,
  }
}

/**
 * Guarda los acuerdos y compromisos formativos de una mediación escolar de forma atómica.
 * Si existen compromisos previos, los reemplaza transaccionalmente; en caso de fallo,
 * restaura los compromisos anteriores garantizando consistencia (rollback compensatorio).
 *
 * @param {string} tenantId - UUID del establecimiento
 * @param {string} mediacionId - UUID de la mediación
 * @param {string} usuarioId - UUID del usuario que registra los acuerdos
 * @param {Object} body - Lote de compromisos y fecha/observaciones de seguimiento
 * @returns {Promise<Object>} Resumen de compromisos guardados y estado actualizado
 */
const guardarCompromisos = async (tenantId, mediacionId, usuarioId, body) => {
  // 1. Obtener la mediación para verificar existencia y obtener su fecha programada
  const { data: mediacion, error: medError } = await supabase
    .from('mediaciones')
    .select('id, folio, fecha_programada, estado, fecha_seguimiento, conclusiones_cierre')
    .eq('id', mediacionId)
    .eq('tenant_id', tenantId)
    .single()

  if (medError || !mediacion) {
    const err = new Error('Mediación no encontrada')
    err.statusCode = 404
    throw err
  }

  // 2. Validación estricta con esquema Zod contextualizado con la fecha de la mediación
  const schema = crearGuardarCompromisosSchema(mediacion.fecha_programada)
  const parseResult = schema.safeParse(body)
  if (!parseResult.success) {
    const issues = parseResult.error.issues || parseResult.error.errors || []
    const errorDetails = issues.map((e) => e.message).join('. ') || 'Datos inválidos'
    const err = new Error(errorDetails)
    err.statusCode = 400
    throw err
  }

  const { compromisos, fecha_seguimiento, observaciones_cierre, estado } = parseResult.data

  // 3. Respaldar en memoria los compromisos previos para el rollback compensatorio
  const { data: compromisosPrevios, error: errPrev } = await supabase
    .from('mediacion_compromisos')
    .select('*')
    .eq('mediacion_id', mediacionId)
    .eq('tenant_id', tenantId)

  if (errPrev) {
    logger.error('Error al consultar compromisos previos para rollback:', errPrev)
    const err = new Error('Error al preparar actualización de compromisos')
    err.statusCode = 500
    throw err
  }

  // 4. Limpiar compromisos previos existentes
  const { error: deleteError } = await supabase
    .from('mediacion_compromisos')
    .delete()
    .eq('mediacion_id', mediacionId)
    .eq('tenant_id', tenantId)

  if (deleteError) {
    logger.error('Error al limpiar compromisos previos:', deleteError)
    const err = new Error('Error al actualizar acuerdos de la mediación')
    err.statusCode = 500
    throw err
  }

  // 5. Mapear y persistir el nuevo lote de compromisos
  const rowsToInsert = compromisos.map((c) => ({
    mediacion_id: mediacionId,
    tenant_id: tenantId,
    estudiante_id: c.estudiante_id || null,
    tipo_compromiso: c.tipo_compromiso,
    descripcion: c.descripcion,
    fecha_limite: c.fecha_limite,
    cumplido: Boolean(c.cumplido),
    fecha_cumplimiento: c.fecha_cumplimiento || (c.cumplido ? new Date().toISOString() : null),
    observaciones_seguimiento: c.observaciones_seguimiento || null,
  }))

  const { data: nuevosCompromisos, error: insertError } = await supabase
    .from('mediacion_compromisos')
    .insert(rowsToInsert)
    .select()

  if (insertError) {
    logger.error('Error al insertar nuevos compromisos, revirtiendo estado (rollback):', insertError)
    // Reversión compensatoria
    if (compromisosPrevios && compromisosPrevios.length > 0) {
      try {
        await supabase.from('mediacion_compromisos').insert(compromisosPrevios)
      } catch (restoreErr) {
        logger.error('Fallo crítico al restaurar compromisos previos tras rollback:', restoreErr)
      }
    }
    const err = new Error(insertError.message || 'Error al persistir acuerdos de mediación')
    err.statusCode = 500
    throw err
  }

  // 6. Actualizar cabecera de mediaciones si corresponde
  const updatePayload = {}
  if (fecha_seguimiento !== undefined && fecha_seguimiento !== null) {
    updatePayload.fecha_seguimiento = fecha_seguimiento
  }
  if (observaciones_cierre !== undefined && observaciones_cierre !== null) {
    updatePayload.conclusiones_cierre = observaciones_cierre
  }
  if (estado) {
    updatePayload.estado = estado
  } else if (['programada', 'en_sesion'].includes(mediacion.estado)) {
    updatePayload.estado = 'acordada'
  }

  if (Object.keys(updatePayload).length > 0) {
    const { error: medUpdateError } = await supabase
      .from('mediaciones')
      .update(updatePayload)
      .eq('id', mediacionId)
      .eq('tenant_id', tenantId)

    if (medUpdateError) {
      logger.warn('Advertencia: No se pudo actualizar estado o fecha de seguimiento de mediación:', medUpdateError)
    }
  }

  // 7. Auditoría
  try {
    await registrarAuditoria({
      tenantId,
      userId: usuarioId,
      accion: 'UPDATE',
      tabla: 'mediacion_compromisos',
      registroId: mediacionId,
      datosBefore: {
        mediacion_id: mediacionId,
        total_compromisos: (compromisosPrevios || []).length,
      },
      datosAfter: {
        mediacion_id: mediacionId,
        total_compromisos: nuevosCompromisos ? nuevosCompromisos.length : 0,
        estado_nuevo: updatePayload.estado || mediacion.estado,
        fecha_seguimiento: updatePayload.fecha_seguimiento || mediacion.fecha_seguimiento,
      },
    })
  } catch (auditErr) {
    logger.warn('Advertencia: No se pudo registrar auditoría de compromisos:', auditErr.message)
  }

  return {
    mediacion_id: mediacionId,
    folio: mediacion.folio,
    estado: updatePayload.estado || mediacion.estado,
    fecha_seguimiento: updatePayload.fecha_seguimiento || mediacion.fecha_seguimiento,
    total_compromisos: nuevosCompromisos ? nuevosCompromisos.length : 0,
    compromisos: nuevosCompromisos || [],
  }
}

/**
 * Retorna todos los compromisos formativos vigentes de una mediación escolar.
 *
 * @param {string} tenantId - UUID del establecimiento
 * @param {string} mediacionId - UUID de la mediación
 * @returns {Promise<Array>} Lista de compromisos
 */
const listarCompromisos = async (tenantId, mediacionId) => {
  const { data, error } = await supabase
    .from('mediacion_compromisos')
    .select(`
      id,
      mediacion_id,
      estudiante_id,
      tipo_compromiso,
      descripcion,
      fecha_limite,
      cumplido,
      fecha_cumplimiento,
      observaciones_seguimiento,
      created_at,
      updated_at,
      estudiantes ( id, rut, nombre, apellido, curso_id )
    `)
    .eq('tenant_id', tenantId)
    .eq('mediacion_id', mediacionId)
    .order('fecha_limite', { ascending: true })

  if (error) {
    logger.error('Error al listar compromisos de mediación:', error)
    const err = new Error('Error al consultar acuerdos de la mediación')
    err.statusCode = 500
    throw err
  }

  return data || []
}

module.exports = {
  crearMediacion,
  listarMediaciones,
  obtenerMediacionPorId,
  notificarApoderados,
  guardarCompromisos,
  listarCompromisos,
}
