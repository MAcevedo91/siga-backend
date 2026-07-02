const { z } = require('zod')
const { supabase } = require('../utils/db')
const logger = require('../utils/logger')

// =============================================================================
// ESQUEMA DE VALIDACIÓN ZOD
// =============================================================================

const exportacionSchema = z.object({
  tipoExportacion: z.enum(['Matrícula', 'Asistencia', 'Notas', 'Incidentes']),
  fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato fecha inválido'),
  fechaFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato fecha inválido')
}).refine(data => new Date(data.fechaFin) >= new Date(data.fechaInicio), {
  message: 'fechaFin debe ser mayor o igual a fechaInicio'
})

// =============================================================================
// SERVICIOS
// =============================================================================

/**
 * Genera exportación CSV de matrícula para SIGE (formato MINEDUC).
 *
 * @param {string} tenantId - UUID del tenant
 * @param {Object} params - { fechaInicio, fechaFin }
 * @param {string} usuarioId - Usuario que genera la exportación
 * @returns {Promise<Object>} - { exportacionId, registros }
 */
const generarExportacionMatricula = async (tenantId, params, usuarioId) => {
  const { fechaInicio, fechaFin } = params

  // Crear registro de exportación
  const { data: exportacion, error: exportError } = await supabase
    .from('sige_exportaciones')
    .insert({
      tenant_id: tenantId,
      tipo_exportacion: 'Matrícula',
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      estado: 'En Proceso',
      generado_por: usuarioId
    })
    .select('id')
    .single()

  if (exportError) {
    logger.error('Error creando exportación:', exportError)
    throw new Error(`Error al crear exportación: ${exportError.message}`)
  }

  try {
    // Obtener estudiantes matriculados en el período
    const { data: estudiantes, error: estudiantesError } = await supabase
      .from('estudiantes')
      .select(`
        id,
        rut,
        nombre,
        apellido,
        fecha_nacimiento,
        activo,
        cursos(nombre, nivel, anio_academico),
        apoderados(nombre, apellido, email, telefono, es_titular)
      `)
      .eq('tenant_id', tenantId)
      .eq('activo', true)

    if (estudiantesError) {
      throw new Error(`Error obteniendo estudiantes: ${estudiantesError.message}`)
    }

    // Generar CSV en formato SIGE
    const csvData = generarCSVMatricula(estudiantes)

    // En producción, aquí se subiría el CSV a Supabase Storage
    // Por ahora simulamos la URL
    const archivoUrl = `https://storage.supabase.co/sige-exports/${exportacion.id}.csv`

    // Actualizar exportación como completada
    const { error: updateError } = await supabase
      .from('sige_exportaciones')
      .update({
        estado: 'Completada',
        archivo_url: archivoUrl,
        registros_exportados: estudiantes.length
      })
      .eq('id', exportacion.id)

    if (updateError) {
      logger.error('Error actualizando exportación:', updateError)
    }

    logger.info(`Exportación SIGE matrícula completada: ${exportacion.id} (${estudiantes.length} registros)`)

    return {
      exportacionId: exportacion.id,
      registros: estudiantes.length,
      archivoUrl
    }
  } catch (error) {
    // Marcar exportación como fallida
    await supabase
      .from('sige_exportaciones')
      .update({
        estado: 'Fallida',
        error_mensaje: error.message
      })
      .eq('id', exportacion.id)

    logger.error('Error generando exportación:', error)
    throw error
  }
}

/**
 * Genera CSV en formato SIGE para matrícula.
 *
 * @param {Array} estudiantes
 * @returns {string} - CSV string
 */
const generarCSVMatricula = (estudiantes) => {
  // Header según formato SIGE MINEDUC
  const header = [
    'RUT',
    'NOMBRE',
    'APELLIDO_PATERNO',
    'APELLIDO_MATERNO',
    'FECHA_NACIMIENTO',
    'CURSO',
    'NIVEL',
    'APODERADO_NOMBRE',
    'APODERADO_EMAIL',
    'APODERADO_TELEFONO'
  ].join(',')

  const rows = estudiantes.map(est => {
    const apellidos = est.apellido.split(' ')
    const apoderadoTitular = est.apoderados?.find(a => a.es_titular) || est.apoderados?.[0]

    return [
      est.rut || '',
      est.nombre || '',
      apellidos[0] || '',
      apellidos[1] || '',
      est.fecha_nacimiento || '',
      est.cursos?.nombre || '',
      est.cursos?.nivel || '',
      apoderadoTitular ? `${apoderadoTitular.nombre} ${apoderadoTitular.apellido}` : '',
      apoderadoTitular?.email || '',
      apoderadoTitular?.telefono || ''
    ]
      .map(val => `"${String(val).replace(/"/g, '""')}"`) // Escape quotes
      .join(',')
  })

  return [header, ...rows].join('\n')
}

/**
 * Genera exportación CSV de asistencia para SIGE.
 *
 * @param {string} tenantId
 * @param {Object} params - { fechaInicio, fechaFin }
 * @param {string} usuarioId
 * @returns {Promise<Object>}
 */
const generarExportacionAsistencia = async (tenantId, params, usuarioId) => {
  const { fechaInicio, fechaFin } = params

  const { data: exportacion, error: exportError } = await supabase
    .from('sige_exportaciones')
    .insert({
      tenant_id: tenantId,
      tipo_exportacion: 'Asistencia',
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      estado: 'En Proceso',
      generado_por: usuarioId
    })
    .select('id')
    .single()

  if (exportError) {
    throw new Error(`Error al crear exportación: ${exportError.message}`)
  }

  try {
    // Obtener registros de asistencia en el período
    const { data: asistencias, error: asistenciasError } = await supabase
      .from('asistencia')
      .select(`
        fecha,
        estado,
        bloque,
        estudiantes(rut, nombre, apellido, cursos(nombre))
      `)
      .eq('tenant_id', tenantId)
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin)
      .order('fecha', { ascending: true })

    if (asistenciasError) {
      throw new Error(`Error obteniendo asistencias: ${asistenciasError.message}`)
    }

    const csvData = generarCSVAsistencia(asistencias)
    const archivoUrl = `https://storage.supabase.co/sige-exports/${exportacion.id}.csv`

    await supabase
      .from('sige_exportaciones')
      .update({
        estado: 'Completada',
        archivo_url: archivoUrl,
        registros_exportados: asistencias.length
      })
      .eq('id', exportacion.id)

    logger.info(`Exportación SIGE asistencia completada: ${exportacion.id}`)

    return {
      exportacionId: exportacion.id,
      registros: asistencias.length,
      archivoUrl
    }
  } catch (error) {
    await supabase
      .from('sige_exportaciones')
      .update({ estado: 'Fallida', error_mensaje: error.message })
      .eq('id', exportacion.id)

    throw error
  }
}

/**
 * Genera CSV de asistencia formato SIGE.
 */
const generarCSVAsistencia = (asistencias) => {
  const header = ['RUT', 'NOMBRE', 'APELLIDO', 'CURSO', 'FECHA', 'BLOQUE', 'ESTADO'].join(',')

  const rows = asistencias.map(a => {
    return [
      a.estudiantes?.rut || '',
      a.estudiantes?.nombre || '',
      a.estudiantes?.apellido || '',
      a.estudiantes?.cursos?.nombre || '',
      a.fecha || '',
      a.bloque || '',
      a.estado || ''
    ]
      .map(val => `"${String(val).replace(/"/g, '""')}"`)
      .join(',')
  })

  return [header, ...rows].join('\n')
}

/**
 * Obtiene historial de exportaciones.
 *
 * @param {string} tenantId
 * @param {Object} filtros - { tipoExportacion?, limit? }
 * @returns {Promise<Array>}
 */
const getExportaciones = async (tenantId, filtros = {}) => {
  const { tipoExportacion, limit = 50 } = filtros

  let query = supabase
    .from('sige_exportaciones')
    .select(`
      id,
      tipo_exportacion,
      fecha_inicio,
      fecha_fin,
      archivo_url,
      estado,
      registros_exportados,
      created_at,
      usuarios:generado_por(nombre, apellido)
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (tipoExportacion) {
    query = query.eq('tipo_exportacion', tipoExportacion)
  }

  const { data, error } = await query

  if (error) {
    logger.error('Error obteniendo exportaciones:', error)
    throw new Error(`Error al obtener exportaciones: ${error.message}`)
  }

  return data
}

module.exports = {
  generarExportacionMatricula,
  generarExportacionAsistencia,
  getExportaciones
}
