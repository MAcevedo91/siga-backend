const crypto = require('crypto')
const { supabase } = require('../utils/db')
const logger = require('../utils/logger')
const { registrarAuditoria } = require('./auditoriaService')
const emailService = require('./emailService')
const {
  crearCitacionSchema,
  responderCitacionPublicaSchema,
  tokenParamSchema,
  registrarAcuerdosSchema,
  metricasFiltrosSchema,
  estudianteIdParamSchema,
  MOTIVOS_VALIDOS,
} = require('../schemas/citacionesValidations')
const {
  generarActaCitacionPDF,
  calcularHashActaCitacion,
} = require('./pdfCitacionActaService')
const { despacharActaOficialCitacion } = require('./emailServiceCitacion')

// Ventana de bloqueo por traslape horario: 45 minutos
const VENTANA_TRASLAPE_MINUTOS = 45

/**
 * Valida si el docente tiene disponibilidad horaria para una nueva citación.
 * Evita traslapes con citaciones existentes en estado 'programada' o 'confirmada'.
 *
 * @param {string} tenantId - UUID del establecimiento
 * @param {string} docenteId - UUID del docente
 * @param {string|Date} fechaHora - Fecha y hora propuesta
 * @param {string|null} citacionIdExcluir - ID de citación a excluir (en caso de edición)
 */
const validarDisponibilidadDocente = async (tenantId, docenteId, fechaHora, citacionIdExcluir = null) => {
  const fechaObjetivo = new Date(fechaHora)
  const inicioVentana = new Date(fechaObjetivo.getTime() - VENTANA_TRASLAPE_MINUTOS * 60 * 1000).toISOString()
  const finVentana = new Date(fechaObjetivo.getTime() + VENTANA_TRASLAPE_MINUTOS * 60 * 1000).toISOString()

  let query = supabase
    .from('citaciones_formativas')
    .select('id, folio, fecha_hora_programada, estado')
    .eq('tenant_id', tenantId)
    .eq('docente_id', docenteId)
    .in('estado', ['programada', 'confirmada'])
    .gte('fecha_hora_programada', inicioVentana)
    .lte('fecha_hora_programada', finVentana)

  if (citacionIdExcluir) {
    query = query.neq('id', citacionIdExcluir)
  }

  const { data: colisiones, error } = await query

  if (error) {
    logger.error('Error al verificar disponibilidad horaria del docente:', error)
    // Si la tabla no existe aún en test, no bloquear
    if (error.code !== '42P01') {
      const err = new Error('Error al verificar disponibilidad horaria')
      err.statusCode = 500
      throw err
    }
  }

  if (colisiones && colisiones.length > 0) {
    const colision = colisiones[0]
    const err = new Error(
      `El docente ya cuenta con la citación ${colision.folio} agendada en ese bloque horario (ventana de ${VENTANA_TRASLAPE_MINUTOS} min)`
    )
    err.statusCode = 409
    err.code = 'DOCENTE_HORARIO_OCUPADO'
    throw err
  }

  return true
}

/**
 * Programa una nueva Citación Formativa (Privado - Docente / Convivencia / Directivo).
 *
 * @param {string} tenantId - UUID del colegio
 * @param {string} docenteId - UUID del usuario que convoca
 * @param {Object} body - Parámetros de la citación
 * @returns {Promise<Object>} Citación creada
 */
const crearCitacion = async (tenantId, docenteId, body) => {
  const parseResult = crearCitacionSchema.safeParse(body)
  if (!parseResult.success) {
    const issues = parseResult.error.issues || parseResult.error.errors || []
    const err = new Error(issues.map((i) => i.message).join('. '))
    err.statusCode = 400
    throw err
  }

  const {
    estudiante_id,
    apoderado_id,
    motivo_categoria,
    motivo_detalle,
    fecha_hora_programada,
    lugar_entrevista,
    modalidad,
    enlace_virtual,
  } = parseResult.data

  // 1. Validar disponibilidad del docente
  await validarDisponibilidadDocente(tenantId, docenteId, fecha_hora_programada)

  // 2. Validar pertenencia del estudiante y apoderado al tenant
  const { data: estudiante, error: estError } = await supabase
    .from('estudiantes')
    .select('id, nombre, apellido, rut')
    .eq('id', estudiante_id)
    .eq('tenant_id', tenantId)
    .single()

  if (estError || !estudiante) {
    const err = new Error('Estudiante no encontrado o no pertenece a este establecimiento')
    err.statusCode = 404
    throw err
  }

  const { data: apoderado, error: apodError } = await supabase
    .from('apoderados')
    .select('id, nombre, apellido, email, telefono')
    .eq('id', apoderado_id)
    .single()

  if (apodError || !apoderado) {
    const err = new Error('Apoderado no encontrado')
    err.statusCode = 404
    throw err
  }

  // 2.1 Obtener datos del docente convocante para remitente personalizado y Reply-To
  let docenteInfo = null
  try {
    const { data: docData } = await supabase
      .from('usuarios')
      .select('id, nombre, apellido, email, rol')
      .eq('id', docenteId)
      .maybeSingle()
    docenteInfo = docData
  } catch (docErr) {
    logger.warn('No se pudieron obtener datos del docente para remitente de citación:', docErr.message)
  }

  // 3. Generar token criptográfico seguro y expiración a 72 horas
  const tokenConfirmacion = crypto.randomUUID()
  const tokenExpiraAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()

  // 4. Insertar en citaciones_formativas
  const payloadInsert = {
    tenant_id: tenantId,
    estudiante_id,
    apoderado_id,
    docente_id: docenteId,
    motivo_categoria,
    motivo_detalle,
    fecha_hora_programada,
    lugar_entrevista: lugar_entrevista || 'Sala de Entrevistas / Convivencia Escolar',
    modalidad,
    enlace_virtual: modalidad === 'virtual' ? enlace_virtual : null,
    token_confirmacion: tokenConfirmacion,
    token_expira_at: tokenExpiraAt,
    estado: 'programada',
  }

  const { data: citacion, error: insertError } = await supabase
    .from('citaciones_formativas')
    .insert(payloadInsert)
    .select(`
      id,
      folio,
      motivo_categoria,
      motivo_detalle,
      fecha_hora_programada,
      lugar_entrevista,
      modalidad,
      enlace_virtual,
      token_confirmacion,
      token_expira_at,
      estado,
      created_at
    `)
    .single()

  if (insertError) {
    logger.error('Error al insertar citación formativa en Supabase:', insertError)
    const err = new Error(insertError.message || 'Error al programar la citación formativa')
    err.statusCode = 500
    throw err
  }

  // 5. Enviar notificación por correo con colilla y enlace móvil
  if (apoderado.email) {
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
      const enlaceMovil = `${frontendUrl}/citaciones/confirmacion/${tokenConfirmacion}`
      
      const docenteNombre = docenteInfo?.nombre
        ? `${docenteInfo.nombre} ${docenteInfo.apellido || ''}`.trim()
        : 'Docente Convocante'
      const fromName = `${docenteNombre} (vía SIGA Escolar)`
      const replyTo = docenteInfo?.email || undefined

      await emailService.enviarEmail({
        to: apoderado.email,
        cc: docenteInfo?.email || undefined,
        fromName,
        replyTo,
        subject: `[SIGA Escolar] Convocatoria a Entrevista Formativa — ${estudiante.nombre} ${estudiante.apellido}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
            <h2 style="color: #1e293b; margin-top: 0;">Convocatoria a Citación Formativa</h2>
            <p>Estimado/a <strong>${apoderado.nombre} ${apoderado.apellido}</strong>,</p>
            <p>Se le invita a una entrevista de colaboración formativa respecto a su pupilo/a <strong>${estudiante.nombre} ${estudiante.apellido}</strong>.</p>
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Folio:</strong> ${citacion.folio || 'Pendiente'}</p>
              <p style="margin: 5px 0;"><strong>Fecha y Hora:</strong> ${new Date(fecha_hora_programada).toLocaleString('es-CL')}</p>
              <p style="margin: 5px 0;"><strong>Lugar / Modalidad:</strong> ${modalidad === 'virtual' ? 'Reunión Virtual' : (lugar_entrevista || 'Sala de Entrevistas')}</p>
              <p style="margin: 5px 0;"><strong>Motivo Formativo:</strong> ${motivo_detalle}</p>
            </div>
            <p>Por favor, confirme su asistencia o solicite una reprogramación en 1 clic directamente desde su teléfono celular (enlace válido por 72 horas):</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${enlaceMovil}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Responder Citación Móvil</a>
            </div>
            <p style="color: #64748b; font-size: 12px;">Escuela Coeducacional N° 1 El Salvador · Sistema SIGA Escolar</p>
          </div>
        `,
        text: `Convocatoria a citación formativa para ${estudiante.nombre}. Ingrese a: ${enlaceMovil}`,
      })
    } catch (mailErr) {
      logger.warn('Advertencia: No se pudo enviar el email de citación al apoderado:', mailErr.message)
    }
  }

  // 6. Registro de auditoría
  try {
    await registrarAuditoria({
      tenantId,
      userId: docenteId,
      accion: 'CREATE',
      tabla: 'citaciones_formativas',
      registroId: citacion.id,
      datosBefore: null,
      datosAfter: {
        id: citacion.id,
        folio: citacion.folio,
        estudiante_id,
        fecha_hora_programada,
      },
    })
  } catch (auditErr) {
    logger.warn('Advertencia: Falló auditoría de citación:', auditErr.message)
  }

  return citacion
}

/**
 * Consulta pública de una citación mediante Token Criptográfico (Sin login).
 *
 * @param {string} token - UUID v4 del token de confirmación
 * @returns {Promise<Object>} Datos sanitizados de la citación para el móvil del apoderado
 */
const obtenerCitacionPublicaPorToken = async (token) => {
  const parseResult = tokenParamSchema.safeParse({ token })
  if (!parseResult.success) {
    const err = new Error('El formato del token de citación es inválido')
    err.statusCode = 400
    throw err
  }

  const { data, error } = await supabase
    .from('citaciones_formativas')
    .select(`
      id,
      folio,
      motivo_categoria,
      motivo_detalle,
      fecha_hora_programada,
      lugar_entrevista,
      modalidad,
      enlace_virtual,
      estado,
      token_expira_at,
      fecha_respuesta_apoderado,
      comentario_apoderado,
      nueva_fecha_solicitada,
      estudiantes ( id, nombre, apellido, cursos ( id, nombre, nivel, letra ) ),
      apoderados ( id, nombre, apellido ),
      usuarios!citaciones_formativas_docente_id_fkey ( id, nombre, apellido )
    `)
    .eq('token_confirmacion', token)
    .single()

  if (error || !data) {
    const err = new Error('Citación no encontrada o enlace inválido')
    err.statusCode = 404
    throw err
  }

  // Verificar caducidad del token (72 horas)
  const ahora = new Date()
  const expiraAt = new Date(data.token_expira_at)
  if (ahora > expiraAt) {
    const err = new Error('El enlace de confirmación ha expirado (validez de 72 horas). Por favor contacte al colegio.')
    err.statusCode = 410
    err.code = 'TOKEN_EXPIRADO'
    throw err
  }

  const est = data.estudiantes || {}
  const apod = data.apoderados || {}
  const doc = data.usuarios || {}

  // Retornar información segura sin datos sensibles (RUTs, notas o incidentes disciplinarios)
  return {
    folio: data.folio,
    estudiante: {
      nombre: est.nombre || 'Estudiante',
      apellido: est.apellido || '',
      curso: est.cursos ? est.cursos.nombre : null,
    },
    apoderado: {
      nombre: apod.nombre || 'Apoderado',
      apellido: apod.apellido || '',
    },
    docente: {
      nombre: doc.nombre ? `${doc.nombre} ${doc.apellido || ''}`.trim() : 'Profesor Jefe',
    },
    motivo_categoria: data.motivo_categoria,
    motivo_detalle: data.motivo_detalle,
    fecha_hora_programada: data.fecha_hora_programada,
    lugar_entrevista: data.lugar_entrevista,
    modalidad: data.modalidad,
    enlace_virtual: data.enlace_virtual,
    estado: data.estado,
    token_expira_at: data.token_expira_at,
    fecha_respuesta_apoderado: data.fecha_respuesta_apoderado,
    comentario_apoderado: data.comentario_apoderado,
    nueva_fecha_solicitada: data.nueva_fecha_solicitada,
  }
}

/**
 * Procesa la respuesta del apoderado en 1 clic móvil (confirmar, reprogramar, justificar).
 *
 * @param {Object} body - Payload con token, accion, comentario y nueva fecha propuesta
 * @returns {Promise<Object>} Resultado de la confirmación
 */
const responderCitacionPublica = async (body) => {
  const parseResult = responderCitacionPublicaSchema.safeParse(body)
  if (!parseResult.success) {
    const issues = parseResult.error.issues || parseResult.error.errors || []
    const err = new Error(issues.map((i) => i.message).join('. '))
    err.statusCode = 400
    throw err
  }

  const { token, accion, comentario, nueva_fecha_solicitada } = parseResult.data

  // 1. Obtener la citación por token
  const { data: citacion, error } = await supabase
    .from('citaciones_formativas')
    .select('id, tenant_id, folio, estado, token_expira_at, fecha_hora_programada, docente_id')
    .eq('token_confirmacion', token)
    .single()

  if (error || !citacion) {
    const err = new Error('Citación no encontrada o token inválido')
    err.statusCode = 404
    throw err
  }

  // 2. Validar expiración del token
  if (new Date() > new Date(citacion.token_expira_at)) {
    const err = new Error('El enlace de confirmación ha expirado tras 72 horas. Comuníquese con el establecimiento.')
    err.statusCode = 410
    err.code = 'TOKEN_EXPIRADO'
    throw err
  }

  // 3. Validar estado actual de la citación
  if (['realizada', 'cancelada'].includes(citacion.estado)) {
    const err = new Error(`La citación se encuentra en estado '${citacion.estado}' y ya no admite respuestas.`)
    err.statusCode = 400
    throw err
  }

  // 4. Mapear estado resultante según la acción
  let nuevoEstado = 'confirmada'
  if (accion === 'reprogramar') nuevoEstado = 'reprogramacion_solicitada'
  if (accion === 'justificar') nuevoEstado = 'justificada'

  const updatePayload = {
    estado: nuevoEstado,
    fecha_respuesta_apoderado: new Date().toISOString(),
    comentario_apoderado: comentario || null,
    nueva_fecha_solicitada: accion === 'reprogramar' && nueva_fecha_solicitada ? nueva_fecha_solicitada : null,
  }

  const { data: actualizada, error: updateError } = await supabase
    .from('citaciones_formativas')
    .update(updatePayload)
    .eq('id', citacion.id)
    .select('id, folio, estado, fecha_respuesta_apoderado, comentario_apoderado, nueva_fecha_solicitada')
    .single()

  if (updateError) {
    logger.error('Error al actualizar respuesta de citación en Supabase:', updateError)
    const err = new Error('Error al registrar la respuesta a la citación')
    err.statusCode = 500
    throw err
  }

  // 5. Auditoría
  try {
    await registrarAuditoria({
      tenantId: citacion.tenant_id,
      userId: citacion.docente_id,
      accion: 'UPDATE',
      tabla: 'citaciones_formativas',
      registroId: citacion.id,
      datosBefore: { estado: citacion.estado },
      datosAfter: { estado: nuevoEstado, accion, fecha_respuesta: updatePayload.fecha_respuesta_apoderado },
    })
  } catch (auditErr) {
    logger.warn('Advertencia: Falló auditoría de respuesta a citación:', auditErr.message)
  }

  return {
    mensaje:
      accion === 'confirmar'
        ? 'Asistencia confirmada exitosamente. ¡Muchas gracias!'
        : accion === 'reprogramar'
        ? 'Solicitud de reprogramación recibida. El docente se contactará a la brevedad.'
        : 'Inasistencia justificada registrada.',
    citacion: actualizada,
  }
}

/**
 * Consulta la lista paginada y filtrable de citaciones formativas (Privado).
 *
 * @param {string} tenantId - UUID del colegio
 * @param {Object} query - Parámetros de consulta (page, limit, estado, docente_id, estudiante_id)
 * @returns {Promise<Object>} Lista paginada
 */
const listarCitaciones = async (tenantId, query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 10))
  const offset = (page - 1) * limit

  let q = supabase
    .from('citaciones_formativas')
    .select(
      `
      id,
      folio,
      motivo_categoria,
      motivo_detalle,
      fecha_hora_programada,
      lugar_entrevista,
      modalidad,
      estado,
      fecha_respuesta_apoderado,
      created_at,
      estudiantes ( id, nombre, apellido, rut, curso_id, cursos ( id, nombre ) ),
      apoderados ( id, nombre, apellido, email, telefono ),
      usuarios!citaciones_formativas_docente_id_fkey ( id, nombre, apellido, email )
    `,
      { count: 'exact' }
    )
    .eq('tenant_id', tenantId)
    .order('fecha_hora_programada', { ascending: false })
    .range(offset, offset + limit - 1)

  if (query.estado) q = q.eq('estado', query.estado)
  if (query.docente_id) q = q.eq('docente_id', query.docente_id)
  if (query.estudiante_id) q = q.eq('estudiante_id', query.estudiante_id)

  const { data, error, count } = await q

  if (error) {
    logger.error('Error al listar citaciones en Supabase:', error)
    if (error.code === '42P01') {
      return { data: [], total: 0, page, limit, totalPages: 0 }
    }
    const err = new Error(error.message || 'Error al consultar citaciones')
    err.statusCode = 500
    throw err
  }

  const total = count || 0
  return {
    data: data || [],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  }
}

/**
 * Registra los acuerdos mutuos y cierra formalmente la entrevista de citación (TASK 10.2.3).
 *
 * @param {string} tenantId - UUID del colegio
 * @param {string} citacionId - UUID de la citación
 * @param {string} userId - UUID del usuario que registra
 * @param {Object} body - { compromisos_colegio, compromisos_apoderado, fecha_proximo_seguimiento }
 * @returns {Promise<Object>} Acuerdos creados y citación actualizada
 */
const registrarAcuerdosMutuos = async (tenantId, citacionId, userId, body) => {
  const parseResult = registrarAcuerdosSchema.safeParse(body)
  if (!parseResult.success) {
    const issues = parseResult.error.issues || parseResult.error.errors || []
    const err = new Error(issues.map((i) => i.message).join('. '))
    err.statusCode = 400
    throw err
  }

  const {
    compromisos_colegio,
    compromisos_apoderado,
    fecha_proximo_seguimiento,
    firma_docente,
    firma_apoderado,
  } = parseResult.data

  // 1. Obtener la citación con sus datos completos (estudiante, curso, apoderado, docente)
  const { data: citacion, error: citError } = await supabase
    .from('citaciones_formativas')
    .select(
      `
      id,
      tenant_id,
      folio,
      motivo_categoria,
      motivo_detalle,
      fecha_hora_programada,
      lugar_entrevista,
      modalidad,
      enlace_virtual,
      estado,
      estudiantes (
        id,
        nombre,
        apellido,
        rut,
        curso_id,
        cursos (
          id,
          nombre,
          profesor_jefe_id,
          profesores_jefes:usuarios!cursos_profesor_jefe_id_fkey ( id, nombre, apellido, email )
        )
      ),
      apoderados ( id, nombre, apellido, email, telefono ),
      usuarios!citaciones_formativas_docente_id_fkey ( id, nombre, apellido, email )
    `
    )
    .eq('id', citacionId)
    .eq('tenant_id', tenantId)
    .single()

  if (citError || !citacion) {
    const err = new Error('Citación no encontrada en este establecimiento')
    err.statusCode = 404
    throw err
  }

  if (citacion.estado === 'cancelada') {
    const err = new Error('No se pueden registrar acuerdos para una citación cancelada')
    err.statusCode = 400
    throw err
  }

  // 2. Calcular hash SHA-256 de los acuerdos
  const payloadAcuerdos = {
    compromisos_colegio,
    compromisos_apoderado,
    fecha_proximo_seguimiento: fecha_proximo_seguimiento || null,
  }
  const hash_sha256 = calcularHashActaCitacion(citacion, payloadAcuerdos)

  // 3. Insertar o actualizar acuerdos en la base de datos
  const { data: acuerdos, error: acuerdosError } = await supabase
    .from('citacion_acuerdos_mutuos')
    .upsert(
      {
        citacion_id: citacionId,
        tenant_id: tenantId,
        compromisos_colegio,
        compromisos_apoderado,
        fecha_proximo_seguimiento:
          fecha_proximo_seguimiento ||
          new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        firma_docente_data: firma_docente || null,
        firma_apoderado_data: firma_apoderado || null,
        hash_sha256,
        creado_por: userId,
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: 'citacion_id' }
    )
    .select('*')
    .single()

  if (acuerdosError) {
    logger.error('Error al persistir citacion_acuerdos_mutuos en Supabase:', acuerdosError)
    const err = new Error('Error al registrar acuerdos mutuos en base de datos')
    err.statusCode = 500
    throw err
  }

  // 4. Actualizar estado de la citación a 'realizada'
  const { data: citacionActualizada, error: updateError } = await supabase
    .from('citaciones_formativas')
    .update({
      estado: 'realizada',
      updated_at: new Date().toISOString(),
    })
    .eq('id', citacionId)
    .eq('tenant_id', tenantId)
    .select('id, folio, estado')
    .single()

  if (updateError) {
    logger.warn('Advertencia: Falló actualización de estado de citación a realizada:', updateError.message)
  }

  // 5. Compilar buffer del PDF oficial
  let bufferPdf = null
  try {
    bufferPdf = await generarActaCitacionPDF(citacion, acuerdos)
  } catch (pdfErr) {
    logger.error('Error al generar Buffer PDF del Acta de Citación:', pdfErr)
  }

  // 6. Despachar copias automáticas por correo
  if (bufferPdf) {
    try {
      await despacharActaOficialCitacion(citacionId, tenantId, bufferPdf, acuerdos)
    } catch (mailErr) {
      logger.warn('Advertencia: No se pudo despachar el correo de acuerdos:', mailErr.message)
    }
  }

  // 7. Registro de Auditoría
  try {
    await registrarAuditoria({
      tenantId,
      userId,
      accion: 'CIERRE_CITACION_ACUERDOS',
      tabla: 'citacion_acuerdos_mutuos',
      registroId: acuerdos.id,
      datosBefore: { estado_anterior: citacion.estado },
      datosAfter: {
        folio: citacion.folio,
        hash_sha256,
        cant_compromisos_colegio: compromisos_colegio.length,
        cant_compromisos_apoderado: compromisos_apoderado.length,
        fecha_proximo_seguimiento,
      },
    })
  } catch (auditErr) {
    logger.warn('Advertencia al auditar acuerdos de citación:', auditErr.message)
  }

  return {
    acuerdos,
    citacion: citacionActualizada || { id: citacionId, folio: citacion.folio, estado: 'realizada' },
    hash_sha256,
  }
}

/**
 * Obtiene el Buffer binario del Acta Oficial PDF de una citación con acuerdos registrados (TASK 10.2.3).
 *
 * @param {string} tenantId - UUID del colegio
 * @param {string} citacionId - UUID de la citación
 * @returns {Promise<{ pdfBuffer: Buffer, folio: string }>}
 */
const obtenerActaCitacionPDF = async (tenantId, citacionId) => {
  const { data: citacion, error: citError } = await supabase
    .from('citaciones_formativas')
    .select(
      `
      id,
      tenant_id,
      folio,
      motivo_categoria,
      motivo_detalle,
      fecha_hora_programada,
      lugar_entrevista,
      modalidad,
      enlace_virtual,
      estado,
      estudiantes (
        id,
        nombre,
        apellido,
        rut,
        curso_id,
        cursos ( id, nombre )
      ),
      apoderados ( id, nombre, apellido, email, telefono ),
      usuarios!citaciones_formativas_docente_id_fkey ( id, nombre, apellido, email )
    `
    )
    .eq('id', citacionId)
    .eq('tenant_id', tenantId)
    .single()

  if (citError || !citacion) {
    const err = new Error('Citación no encontrada')
    err.statusCode = 404
    throw err
  }

  const { data: acuerdos, error: acError } = await supabase
    .from('citacion_acuerdos_mutuos')
    .select('*')
    .eq('citacion_id', citacionId)
    .eq('tenant_id', tenantId)
    .single()

  if (acError || !acuerdos) {
    const err = new Error('Esta citación no cuenta con acuerdos registrados ni acta oficial emitida')
    err.statusCode = 404
    throw err
  }

  const pdfBuffer = await generarActaCitacionPDF(citacion, acuerdos)

  return {
    pdfBuffer,
    folio: citacion.folio || 'formativa',
  }
}

/**
 * Obtiene métricas agregadas de participación familiar, adherencia y distribución de motivos (TASK 10.3.1).
 *
 * @param {string} tenantId - UUID del establecimiento
 * @param {Object} query - Filtros opcionales (fecha_desde, fecha_hasta, docente_id)
 * @returns {Promise<Object>} Resumen estadístico y métricas de adherencia parental
 */
const obtenerMetricasCitaciones = async (tenantId, query = {}) => {
  const parseResult = metricasFiltrosSchema.safeParse(query)
  if (!parseResult.success) {
    const issues = parseResult.error.issues || parseResult.error.errors || []
    const err = new Error(issues.map((i) => i.message).join('. '))
    err.statusCode = 400
    throw err
  }

  const { fecha_desde, fecha_hasta, docente_id } = parseResult.data

  let q = supabase
    .from('citaciones_formativas')
    .select('id, folio, estado, motivo_categoria, fecha_hora_programada, fecha_respuesta_apoderado')
    .eq('tenant_id', tenantId)

  if (fecha_desde) {
    q = q.gte('fecha_hora_programada', new Date(fecha_desde).toISOString())
  }
  if (fecha_hasta) {
    q = q.lte('fecha_hora_programada', new Date(fecha_hasta).toISOString())
  }
  if (docente_id) {
    q = q.eq('docente_id', docente_id)
  }

  const { data: citaciones, error } = await q

  if (error) {
    logger.error('Error al calcular métricas de citaciones en Supabase:', error)
    if (error.code === '42P01') {
      return {
        totales: {
          total_convocadas: 0,
          realizadas: 0,
          confirmadas: 0,
          reprogramadas: 0,
          justificadas: 0,
          no_asiste: 0,
          programadas: 0,
          canceladas: 0,
        },
        tasas: {
          asistencia_efectiva: 0,
          adherencia_parental: 0,
          efectividad_acuerdos: 0,
        },
        distribucion_motivos: {},
        ranking_motivos: [],
      }
    }
    const err = new Error('Error al consultar métricas de citaciones')
    err.statusCode = 500
    throw err
  }

  const totalConvocadas = citaciones ? citaciones.length : 0

  // Conteo por estados
  const realizadas = (citaciones || []).filter((c) => c.estado === 'realizada').length
  const confirmadas = (citaciones || []).filter((c) => c.estado === 'confirmada').length
  const reprogramadas = (citaciones || []).filter((c) => c.estado === 'reprogramacion_solicitada').length
  const justificadas = (citaciones || []).filter((c) => c.estado === 'justificada').length
  const noAsiste = (citaciones || []).filter((c) => c.estado === 'no_asiste').length
  const programadas = (citaciones || []).filter((c) => c.estado === 'programada').length
  const canceladas = (citaciones || []).filter((c) => c.estado === 'cancelada').length

  // Tasa de asistencia efectiva: realizadas vs (realizadas + no_asiste)
  const totalEvaluadas = realizadas + noAsiste
  const tasaAsistenciaEfectiva = totalEvaluadas > 0
    ? Number(((realizadas / totalEvaluadas) * 100).toFixed(1))
    : 0

  // Tasa de adherencia temprana: apoderados que interactuaron activamente
  const respondieron = (citaciones || []).filter(
    (c) => c.fecha_respuesta_apoderado != null || ['confirmada', 'reprogramacion_solicitada', 'justificada'].includes(c.estado)
  ).length
  const tasaAdherenciaParental = totalConvocadas > 0
    ? Number(((respondieron / totalConvocadas) * 100).toFixed(1))
    : 0

  // Distribución de motivos formativos
  const distribucionMotivos = {}
  MOTIVOS_VALIDOS.forEach((motivo) => {
    const cant = (citaciones || []).filter((c) => c.motivo_categoria === motivo).length
    distribucionMotivos[motivo] = {
      cantidad: cant,
      porcentaje: totalConvocadas > 0 ? Number(((cant / totalConvocadas) * 100).toFixed(1)) : 0,
    }
  })

  const rankingMotivos = MOTIVOS_VALIDOS.map((motivo) => ({
    motivo,
    cantidad: distribucionMotivos[motivo].cantidad,
    porcentaje: distribucionMotivos[motivo].porcentaje,
  })).sort((a, b) => b.cantidad - a.cantidad)

  // Consulta de acuerdos mutuos para calcular efectividad de cierre
  let totalAcuerdos = 0
  try {
    const { count, error: acError } = await supabase
      .from('citacion_acuerdos_mutuos')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)

    if (!acError && count != null) {
      totalAcuerdos = count
    }
  } catch (err) {
    logger.warn('Advertencia al consultar conteo de acuerdos mutuos:', err.message)
  }

  const tasaEfectividadAcuerdos = realizadas > 0
    ? Number(((Math.min(totalAcuerdos, realizadas) / realizadas) * 100).toFixed(1))
    : 0

  return {
    totales: {
      total_convocadas: totalConvocadas,
      realizadas,
      confirmadas,
      reprogramadas,
      justificadas,
      no_asiste: noAsiste,
      programadas,
      canceladas,
    },
    tasas: {
      asistencia_efectiva: tasaAsistenciaEfectiva,
      adherencia_parental: tasaAdherenciaParental,
      efectividad_acuerdos: tasaEfectividadAcuerdos,
    },
    distribucion_motivos: distribucionMotivos,
    ranking_motivos: rankingMotivos,
  }
}

/**
 * Consulta el historial cronológico enriquecido de citaciones de un estudiante con actas descargables (TASK 10.3.1).
 *
 * @param {string} tenantId - UUID del colegio
 * @param {string} estudianteId - UUID del estudiante
 * @returns {Promise<Object>} Historial y resumen analítico del alumno
 */
const obtenerHistorialCitacionesEstudiante = async (tenantId, estudianteId) => {
  const parseResult = estudianteIdParamSchema.safeParse({ estudianteId })
  if (!parseResult.success) {
    const issues = parseResult.error.issues || parseResult.error.errors || []
    const err = new Error(issues.map((i) => i.message).join('. '))
    err.statusCode = 400
    throw err
  }

  // 1. Verificar existencia y pertenencia del estudiante al tenant
  const { data: estudiante, error: estError } = await supabase
    .from('estudiantes')
    .select('id, nombre, apellido, rut, curso_id, cursos ( id, nombre )')
    .eq('id', estudianteId)
    .eq('tenant_id', tenantId)
    .single()

  if (estError || !estudiante) {
    const err = new Error('Estudiante no encontrado en el establecimiento')
    err.statusCode = 404
    throw err
  }

  // 2. Consultar citaciones con apoderado, docente y acuerdos mutuos
  const { data: citaciones, error: citError } = await supabase
    .from('citaciones_formativas')
    .select(`
      id,
      folio,
      motivo_categoria,
      motivo_detalle,
      fecha_hora_programada,
      lugar_entrevista,
      modalidad,
      enlace_virtual,
      estado,
      fecha_respuesta_apoderado,
      comentario_apoderado,
      nueva_fecha_solicitada,
      conclusiones_entrevista,
      realizada_at,
      created_at,
      apoderados ( id, nombre, apellido, email, telefono ),
      usuarios!citaciones_formativas_docente_id_fkey ( id, nombre, apellido, email ),
      citacion_acuerdos_mutuos (
        id,
        compromisos_colegio,
        compromisos_apoderado,
        observaciones_pedagogicas,
        fecha_proximo_seguimiento,
        hash_sha256,
        creado_en
      )
    `)
    .eq('tenant_id', tenantId)
    .eq('estudiante_id', estudianteId)
    .order('fecha_hora_programada', { ascending: false })

  if (citError) {
    logger.error('Error al consultar historial de citaciones del estudiante:', citError)
    if (citError.code === '42P01') {
      return {
        estudiante,
        metricas_estudiante: {
          total_citaciones: 0,
          realizadas: 0,
          no_asiste: 0,
          tasa_asistencia: 0,
          compromisos_vigentes: 0,
        },
        citaciones: [],
      }
    }
    const err = new Error('Error al consultar historial de citaciones')
    err.statusCode = 500
    throw err
  }

  const hoyStr = new Date().toISOString().split('T')[0]
  let compromisosVigentes = 0

  const historialEnriquecido = (citaciones || []).map((c) => {
    const acuerdo = Array.isArray(c.citacion_acuerdos_mutuos)
      ? c.citacion_acuerdos_mutuos[0]
      : c.citacion_acuerdos_mutuos

    const tieneActa = Boolean(acuerdo && acuerdo.hash_sha256)

    if (acuerdo && acuerdo.fecha_proximo_seguimiento && acuerdo.fecha_proximo_seguimiento >= hoyStr) {
      compromisosVigentes++
    }

    return {
      id: c.id,
      folio: c.folio,
      motivo_categoria: c.motivo_categoria,
      motivo_detalle: c.motivo_detalle,
      fecha_hora_programada: c.fecha_hora_programada,
      lugar_entrevista: c.lugar_entrevista,
      modalidad: c.modalidad,
      enlace_virtual: c.enlace_virtual,
      estado: c.estado,
      fecha_respuesta_apoderado: c.fecha_respuesta_apoderado,
      comentario_apoderado: c.comentario_apoderado,
      nueva_fecha_solicitada: c.nueva_fecha_solicitada,
      conclusiones_entrevista: c.conclusiones_entrevista,
      realizada_at: c.realizada_at,
      created_at: c.created_at,
      apoderado: c.apoderados || null,
      docente: c.usuarios || null,
      acuerdos: acuerdo || null,
      tiene_acta: tieneActa,
      acta_pdf_url: tieneActa ? `/api/citaciones/${c.id}/acta-pdf` : null,
    }
  })

  const total = historialEnriquecido.length
  const realizadas = historialEnriquecido.filter((c) => c.estado === 'realizada').length
  const noAsiste = historialEnriquecido.filter((c) => c.estado === 'no_asiste').length
  const evaluadas = realizadas + noAsiste
  const tasaAsistencia = evaluadas > 0 ? Number(((realizadas / evaluadas) * 100).toFixed(1)) : 0

  return {
    estudiante,
    metricas_estudiante: {
      total_citaciones: total,
      realizadas,
      no_asiste: noAsiste,
      tasa_asistencia: tasaAsistencia,
      compromisos_vigentes: compromisosVigentes,
    },
    citaciones: historialEnriquecido,
  }
}

module.exports = {
  validarDisponibilidadDocente,
  crearCitacion,
  obtenerCitacionPublicaPorToken,
  responderCitacionPublica,
  listarCitaciones,
  registrarAcuerdosMutuos,
  obtenerActaCitacionPDF,
  obtenerMetricasCitaciones,
  obtenerHistorialCitacionesEstudiante,
}
