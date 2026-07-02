const { z } = require('zod')
const { supabase } = require('../utils/db')
const { registrarAuditoria } = require('./auditoriaService')
const logger = require('../utils/logger')

// =============================================================================
// ESQUEMA DE VALIDACIÓN ZOD
// =============================================================================

const asistenciaSchema = z.object({
  cursoId: z.string().uuid('cursoId debe ser UUID válido'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato fecha inválido. Use YYYY-MM-DD'),
  bloque: z.number().int().min(1).max(8).nullable().optional(),
  asistencias: z.array(
    z.object({
      estudianteId: z.string().uuid('estudianteId debe ser UUID válido'),
      estado: z.enum(['Presente', 'Ausente', 'Atrasado', 'Justificado']),
      observaciones: z.string().optional(),
      justificacion_adjunto: z.string().url().optional()
    })
  ).min(1, 'Debe incluir al menos una asistencia')
})

// =============================================================================
// SERVICIOS
// =============================================================================

/**
 * Registra asistencia en bulk para un curso (día completo o bloque específico).
 *
 * @param {string} tenantId - UUID del tenant
 * @param {Object} data - { cursoId, fecha, bloque?, asistencias: [{ estudianteId, estado, observaciones? }] }
 * @param {string} usuarioId - UUID del usuario que registra
 * @returns {Promise<{ registros: number }>}
 * @throws {Error} Si validación falla o error de base de datos
 */
const registrarAsistencia = async (tenantId, data, usuarioId) => {
  // Validación
  const validacion = asistenciaSchema.safeParse(data)
  if (!validacion.success) {
    const errores = validacion.error.issues.map(e => e.message).join(', ')
    throw new Error(`Validación fallida: ${errores}`)
  }

  const { cursoId, fecha, bloque = null, asistencias } = validacion.data

  // Construir registros para inserción
  const registros = asistencias.map(a => ({
    tenant_id: tenantId,
    estudiante_id: a.estudianteId,
    fecha,
    estado: a.estado,
    bloque,
    registrado_por: usuarioId,
    observaciones: a.observaciones || null,
    justificacion_adjunto: a.justificacion_adjunto || null
  }))

  // Inserción bulk con upsert (actualiza si ya existe por UNIQUE constraint)
  const { data: insertData, error } = await supabase
    .from('asistencia')
    .upsert(registros, { onConflict: 'tenant_id,estudiante_id,fecha,bloque' })
    .select('id')

  if (error) {
    logger.error('Error insertando asistencia:', error)
    throw new Error(`Error al registrar asistencia: ${error.message}`)
  }

  // Auditoría
  await registrarAuditoria({
    tenantId,
    userId: usuarioId,
    accion: 'REGISTRAR_ASISTENCIA',
    tabla: 'asistencia',
    registroId: cursoId,
    datosBefore: null,
    datosAfter: { curso: cursoId, fecha, bloque, registros: asistencias.length }
  })

  logger.info(`Asistencia registrada: ${asistencias.length} estudiantes`)

  return { registros: insertData.length }
}

/**
 * Obtiene asistencia de un curso en una fecha (con estudiantes del curso).
 *
 * @param {string} tenantId
 * @param {string} cursoId
 * @param {string} fecha - YYYY-MM-DD
 * @param {number|null} bloque - 1-8 o null para día completo
 * @returns {Promise<Array>} - [{ estudianteId, nombre, apellido, estado, bloque, observaciones }]
 */
const getAsistenciaCurso = async (tenantId, cursoId, fecha, bloque = null) => {
  // Query estudiantes del curso con LEFT JOIN a asistencia
  const { data, error } = await supabase
    .from('estudiantes')
    .select(`
      id,
      nombre,
      apellido,
      asistencia!left(fecha, estado, bloque, observaciones, justificacion_adjunto)
    `)
    .eq('tenant_id', tenantId)
    .eq('curso_id', cursoId)
    .order('apellido')

  if (error) {
    logger.error('Error obteniendo asistencia curso:', error)
    throw new Error(`Error al obtener asistencia: ${error.message}`)
  }

  // Filtrar asistencia por fecha y bloque
  const resultado = data.map(est => {
    const asistenciaFecha = est.asistencia.find(
      a => a.fecha === fecha && (bloque === null ? a.bloque === null : a.bloque === bloque)
    )

    return {
      estudianteId: est.id,
      nombre: est.nombre,
      apellido: est.apellido,
      estado: asistenciaFecha?.estado || null,
      bloque: asistenciaFecha?.bloque || null,
      observaciones: asistenciaFecha?.observaciones || null,
      justificacion_adjunto: asistenciaFecha?.justificacion_adjunto || null
    }
  })

  return resultado
}

/**
 * Obtiene historial de asistencia de un estudiante en un rango de fechas.
 *
 * @param {string} tenantId
 * @param {string} estudianteId
 * @param {string} fechaDesde - YYYY-MM-DD
 * @param {string} fechaHasta - YYYY-MM-DD
 * @returns {Promise<Array>} - [{ fecha, estado, bloque, observaciones }]
 */
const getAsistenciaEstudiante = async (tenantId, estudianteId, fechaDesde, fechaHasta) => {
  const { data, error } = await supabase
    .from('asistencia')
    .select('fecha, estado, bloque, observaciones, justificacion_adjunto')
    .eq('tenant_id', tenantId)
    .eq('estudiante_id', estudianteId)
    .gte('fecha', fechaDesde)
    .lte('fecha', fechaHasta)
    .order('fecha', { ascending: false })

  if (error) {
    logger.error('Error obteniendo asistencia estudiante:', error)
    throw new Error(`Error al obtener asistencia: ${error.message}`)
  }

  return data
}

module.exports = {
  registrarAsistencia,
  getAsistenciaCurso,
  getAsistenciaEstudiante
}
