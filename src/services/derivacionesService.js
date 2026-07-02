const { z } = require('zod')
const { supabase } = require('../utils/db')
const { registrarAuditoria } = require('./auditoriaService')
const logger = require('../utils/logger')

// =============================================================================
// ESQUEMA DE VALIDACIÓN ZOD
// =============================================================================

const derivacionSchema = z.object({
  estudianteId: z.string().uuid('estudianteId debe ser UUID válido'),
  incidenteId: z.string().uuid().nullable().optional(),
  tipo: z.enum(['Psicológica', 'Social', 'Pedagógica', 'Médica', 'Externa']),
  prioridad: z.enum(['Baja', 'Media', 'Alta', 'Urgente']).default('Media'),
  motivo: z.string().min(10, 'Motivo debe tener al menos 10 caracteres'),
  profesionalAsignado: z.string().uuid().nullable().optional()
})

const seguimientoSchema = z.object({
  observaciones: z.string().min(5, 'Observaciones deben tener al menos 5 caracteres'),
  accionesRealizadas: z.string().optional(),
  adjunto: z.string().url().optional()
})

// =============================================================================
// SERVICIOS
// =============================================================================

/**
 * Crea una derivación psicosocial.
 *
 * @param {string} tenantId - UUID del tenant
 * @param {Object} data - Datos de la derivación
 * @param {string} usuarioId - UUID del usuario que deriva
 * @returns {Promise<Object>} - Derivación creada
 * @throws {Error} Si validación falla o error de base de datos
 */
const crearDerivacion = async (tenantId, data, usuarioId) => {
  // Validación
  const validacion = derivacionSchema.safeParse(data)
  if (!validacion.success) {
    const errores = validacion.error.issues.map(e => e.message).join(', ')
    throw new Error(`Validación fallida: ${errores}`)
  }

  const {
    estudianteId,
    incidenteId,
    tipo,
    prioridad,
    motivo,
    profesionalAsignado
  } = validacion.data

  // Verificar que el estudiante existe y pertenece al tenant
  const { data: estudiante, error: estudianteError } = await supabase
    .from('estudiantes')
    .select('id, nombre, apellido')
    .eq('id', estudianteId)
    .eq('tenant_id', tenantId)
    .single()

  if (estudianteError || !estudiante) {
    throw new Error('Estudiante no encontrado en este tenant')
  }

  // Insertar derivación
  const { data: derivacion, error: derivacionError } = await supabase
    .from('derivaciones')
    .insert({
      tenant_id: tenantId,
      estudiante_id: estudianteId,
      incidente_id: incidenteId || null,
      tipo,
      prioridad,
      motivo,
      profesional_asignado: profesionalAsignado || null,
      estado: 'Pendiente',
      derivado_por: usuarioId
    })
    .select('id, estudiante_id, tipo, prioridad, estado, fecha_derivacion')
    .single()

  if (derivacionError) {
    logger.error('Error creando derivación:', derivacionError)
    throw new Error(`Error al crear derivación: ${derivacionError.message}`)
  }

  // Auditoría
  await registrarAuditoria({
    tenantId,
    userId: usuarioId,
    accion: 'CREAR_DERIVACION',
    tabla: 'derivaciones',
    registroId: derivacion.id,
    datosBefore: null,
    datosAfter: { estudianteId, tipo, prioridad }
  })

  logger.info(`Derivación creada: ${derivacion.id} - ${tipo} para estudiante ${estudianteId}`)

  return derivacion
}

/**
 * Obtiene derivaciones con filtros.
 *
 * @param {string} tenantId
 * @param {Object} filtros - { estudianteId?, estado?, tipo?, profesionalAsignado? }
 * @returns {Promise<Array>} - Lista de derivaciones
 */
const getDerivaciones = async (tenantId, filtros = {}) => {
  const { estudianteId, estado, tipo, profesionalAsignado } = filtros

  let query = supabase
    .from('derivaciones')
    .select(`
      id,
      estudiante_id,
      tipo,
      prioridad,
      motivo,
      estado,
      fecha_derivacion,
      fecha_cierre,
      profesional_asignado,
      estudiantes(nombre, apellido, rut),
      usuarios:derivado_por(nombre, apellido),
      derivacion_seguimientos(
        id,
        fecha_seguimiento,
        observaciones,
        created_at
      )
    `)
    .eq('tenant_id', tenantId)
    .order('fecha_derivacion', { ascending: false })

  // Filtros opcionales
  if (estudianteId) {
    query = query.eq('estudiante_id', estudianteId)
  }

  if (estado) {
    query = query.eq('estado', estado)
  }

  if (tipo) {
    query = query.eq('tipo', tipo)
  }

  if (profesionalAsignado) {
    query = query.eq('profesional_asignado', profesionalAsignado)
  }

  const { data, error } = await query

  if (error) {
    logger.error('Error obteniendo derivaciones:', error)
    throw new Error(`Error al obtener derivaciones: ${error.message}`)
  }

  return data
}

/**
 * Agrega un seguimiento a una derivación.
 *
 * @param {string} derivacionId - UUID de la derivación
 * @param {Object} data - { observaciones, accionesRealizadas?, adjunto? }
 * @param {string} usuarioId - UUID del usuario que hace el seguimiento
 * @returns {Promise<Object>} - Seguimiento creado
 */
const agregarSeguimiento = async (derivacionId, data, usuarioId) => {
  // Validación
  const validacion = seguimientoSchema.safeParse(data)
  if (!validacion.success) {
    const errores = validacion.error.issues.map(e => e.message).join(', ')
    throw new Error(`Validación fallida: ${errores}`)
  }

  const { observaciones, accionesRealizadas, adjunto } = validacion.data

  // Verificar que la derivación existe
  const { data: derivacion, error: derivacionError } = await supabase
    .from('derivaciones')
    .select('id, estado')
    .eq('id', derivacionId)
    .single()

  if (derivacionError || !derivacion) {
    throw new Error('Derivación no encontrada')
  }

  if (derivacion.estado === 'Cerrada') {
    throw new Error('No se puede agregar seguimiento a una derivación cerrada')
  }

  // Insertar seguimiento
  const { data: seguimiento, error: seguimientoError } = await supabase
    .from('derivacion_seguimientos')
    .insert({
      derivacion_id: derivacionId,
      usuario_id: usuarioId,
      observaciones,
      acciones_realizadas: accionesRealizadas || null,
      adjunto: adjunto || null
    })
    .select('id, fecha_seguimiento, observaciones')
    .single()

  if (seguimientoError) {
    logger.error('Error creando seguimiento:', seguimientoError)
    throw new Error(`Error al crear seguimiento: ${seguimientoError.message}`)
  }

  // Actualizar estado de derivación a "En Proceso" si estaba pendiente
  if (derivacion.estado === 'Pendiente') {
    await supabase
      .from('derivaciones')
      .update({ estado: 'En Proceso', updated_at: new Date().toISOString() })
      .eq('id', derivacionId)
  }

  logger.info(`Seguimiento agregado a derivación ${derivacionId}`)

  return seguimiento
}

/**
 * Cierra una derivación.
 *
 * @param {string} derivacionId - UUID de la derivación
 * @param {string} usuarioId - UUID del usuario que cierra
 * @returns {Promise<Object>} - Derivación actualizada
 */
const cerrarDerivacion = async (derivacionId, usuarioId) => {
  // Verificar que la derivación existe y no está cerrada
  const { data: derivacion, error: derivacionError } = await supabase
    .from('derivaciones')
    .select('id, estado, tenant_id')
    .eq('id', derivacionId)
    .single()

  if (derivacionError || !derivacion) {
    throw new Error('Derivación no encontrada')
  }

  if (derivacion.estado === 'Cerrada') {
    throw new Error('La derivación ya está cerrada')
  }

  // Actualizar estado
  const { data: updated, error: updateError } = await supabase
    .from('derivaciones')
    .update({
      estado: 'Cerrada',
      fecha_cierre: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString()
    })
    .eq('id', derivacionId)
    .select('id, estado, fecha_cierre')
    .single()

  if (updateError) {
    logger.error('Error cerrando derivación:', updateError)
    throw new Error(`Error al cerrar derivación: ${updateError.message}`)
  }

  // Auditoría
  await registrarAuditoria({
    tenantId: derivacion.tenant_id,
    userId: usuarioId,
    accion: 'CERRAR_DERIVACION',
    tabla: 'derivaciones',
    registroId: derivacionId,
    datosBefore: { estado: derivacion.estado },
    datosAfter: { estado: 'Cerrada', fecha_cierre: updated.fecha_cierre }
  })

  logger.info(`Derivación cerrada: ${derivacionId}`)

  return updated
}

/**
 * Asigna un profesional a una derivación.
 *
 * @param {string} derivacionId
 * @param {string} profesionalId
 * @param {string} usuarioId - Usuario que asigna
 * @returns {Promise<Object>}
 */
const asignarProfesional = async (derivacionId, profesionalId, usuarioId) => {
  const { data, error } = await supabase
    .from('derivaciones')
    .update({
      profesional_asignado: profesionalId,
      updated_at: new Date().toISOString()
    })
    .eq('id', derivacionId)
    .select('id, profesional_asignado')
    .single()

  if (error) {
    logger.error('Error asignando profesional:', error)
    throw new Error(`Error al asignar profesional: ${error.message}`)
  }

  logger.info(`Profesional ${profesionalId} asignado a derivación ${derivacionId}`)

  return data
}

module.exports = {
  crearDerivacion,
  getDerivaciones,
  agregarSeguimiento,
  cerrarDerivacion,
  asignarProfesional
}
