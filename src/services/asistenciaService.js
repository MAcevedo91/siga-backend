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

/**
 * Calcula porcentaje de asistencia de un estudiante en un rango de fechas.
 * Solo cuenta registros de día completo (bloque=NULL).
 *
 * @param {string} tenantId
 * @param {string} estudianteId
 * @param {string} fechaDesde - YYYY-MM-DD
 * @param {string} fechaHasta - YYYY-MM-DD
 * @returns {Promise<Object>} - { porcentaje, totalDias, presente, ausente, atrasado, justificado }
 */
const calcularPorcentajeAsistencia = async (tenantId, estudianteId, fechaDesde, fechaHasta) => {
  // Query solo registros de día completo (bloque=NULL)
  const { data, error } = await supabase
    .from('asistencia')
    .select('estado')
    .eq('tenant_id', tenantId)
    .eq('estudiante_id', estudianteId)
    .gte('fecha', fechaDesde)
    .lte('fecha', fechaHasta)
    .is('bloque', null) // Solo día completo

  if (error) {
    logger.error('Error calculando porcentaje asistencia:', error)
    throw new Error(`Error al calcular asistencia: ${error.message}`)
  }

  // Contar por estado
  const totalDias = data.length
  const presente = data.filter(a => a.estado === 'Presente').length
  const ausente = data.filter(a => a.estado === 'Ausente').length
  const atrasado = data.filter(a => a.estado === 'Atrasado').length
  const justificado = data.filter(a => a.estado === 'Justificado').length

  // Porcentaje: solo "Presente" cuenta como asistencia efectiva
  const porcentaje = totalDias > 0 ? Math.round((presente / totalDias) * 100) : 0

  return {
    porcentaje,
    totalDias,
    presente,
    ausente,
    atrasado,
    justificado
  }
}

/**
 * Obtiene estudiantes con riesgo de ausentismo (< porcentaje mínimo en últimos 30 días).
 *
 * @param {string} tenantId
 * @param {number} porcentajeMinimo - Default 85 (alerta si < 85%)
 * @returns {Promise<Array>} - [{ estudianteId, nombre, apellido, curso, porcentajeAsistencia, diasAusente }]
 */
const getEstudiantesEnRiesgo = async (tenantId, porcentajeMinimo = 85) => {
  // Calcular rango últimos 30 días
  const fechaHasta = new Date().toISOString().split('T')[0]
  const fechaDesde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // Query estudiantes con sus asistencias (últimos 30 días)
  const { data: estudiantes, error } = await supabase
    .from('estudiantes')
    .select(`
      id,
      nombre,
      apellido,
      curso:cursos!inner(nombre),
      asistencia!left(estado)
    `)
    .eq('tenant_id', tenantId)
    .gte('asistencia.fecha', fechaDesde)
    .lte('asistencia.fecha', fechaHasta)
    .is('asistencia.bloque', null) // Solo día completo

  if (error) {
    logger.error('Error obteniendo estudiantes en riesgo:', error)
    throw new Error(`Error al obtener estudiantes: ${error.message}`)
  }

  // Calcular porcentaje por estudiante
  const resultado = estudiantes
    .map(est => {
      const asistencias = est.asistencia || []
      const totalDias = asistencias.length
      const presente = asistencias.filter(a => a.estado === 'Presente').length
      const ausente = asistencias.filter(a => a.estado === 'Ausente').length

      const porcentaje = totalDias > 0 ? Math.round((presente / totalDias) * 100) : 100

      return {
        estudianteId: est.id,
        nombre: est.nombre,
        apellido: est.apellido,
        curso: est.curso?.nombre || 'Sin curso',
        porcentajeAsistencia: porcentaje,
        diasAusente: ausente
      }
    })
    .filter(est => est.porcentajeAsistencia < porcentajeMinimo)
    .sort((a, b) => a.porcentajeAsistencia - b.porcentajeAsistencia) // Menor porcentaje primero

  return resultado
}

module.exports = {
  registrarAsistencia,
  getAsistenciaCurso,
  getAsistenciaEstudiante,
  calcularPorcentajeAsistencia,
  getEstudiantesEnRiesgo
}
