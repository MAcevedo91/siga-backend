const { z } = require('zod')
const { supabase } = require('../utils/db')
const logger = require('../utils/logger')
const { registrarAuditoria } = require('./auditoriaService')

// =============================================================================
// ESQUEMAS DE VALIDACIÓN ZOD (CIRCULAR N° 482 - SUPERINTENDENCIA DE EDUCACIÓN)
// =============================================================================

const seccionesReporteSchema = z.object({
  contexto: z
    .string({ required_error: 'El contexto es requerido' })
    .min(10, 'El contexto debe tener al menos 10 caracteres'),
  hechos_objetivos: z
    .string({ required_error: 'El relato de hechos objetivos es requerido' })
    .min(20, 'El relato objetivo debe tener al menos 20 caracteres'),
  medidas_adoptadas: z
    .string({ required_error: 'Las medidas adoptadas son requeridas' })
    .min(10, 'Las medidas adoptadas deben tener al menos 10 caracteres'),
  acuerdos_compromisos: z
    .string({ required_error: 'Los acuerdos y compromisos son requeridos' })
    .min(10, 'Los acuerdos y compromisos deben tener al menos 10 caracteres'),
  plan_seguimiento: z
    .string({ required_error: 'El plan de seguimiento es requerido' })
    .min(10, 'El plan de seguimiento debe tener al menos 10 caracteres'),
})

const crearReporteSchema = z.object({
  incidente_id: z.string().uuid('incidente_id debe ser un UUID válido'),
  estudiante_id: z.string().uuid('estudiante_id debe ser un UUID válido'),
  contenido_borrador: seccionesReporteSchema,
})

const editarReporteSchema = z.object({
  contenido_editado: seccionesReporteSchema,
})

// =============================================================================
// MÉTODOS DE PERSISTENCIA Y GESTIÓN EN BASE DE DATOS
// =============================================================================

/**
 * Inserta un nuevo borrador de reporte en la tabla reportes_incidentes.
 */
const crearBorradorReporte = async ({
  tenantId,
  incidenteId,
  estudianteId,
  contenidoBorrador,
  creadoPor,
  version = 1,
}) => {
  // Validación de esquema Zod
  const datosValidados = crearReporteSchema.parse({
    incidente_id: incidenteId,
    estudiante_id: estudianteId,
    contenido_borrador: contenidoBorrador,
  })

  // Validar que el estudiante pertenezca al incidente
  const { data: participacion, error: errPart } = await supabase
    .from('incidente_estudiantes')
    .select('id')
    .eq('incidente_id', datosValidados.incidente_id)
    .eq('estudiante_id', datosValidados.estudiante_id)
    .maybeSingle()

  if (errPart) {
    logger.error('Error al verificar pertenencia del estudiante en incidente:', errPart)
    throw new Error('Error al verificar vinculación del estudiante')
  }

  if (!participacion) {
    const error = new Error('El estudiante indicado no figura como involucrado en este incidente')
    error.status = 400
    throw error
  }

  // Insertar borrador en BD
  const { data, error } = await supabase
    .from('reportes_incidentes')
    .insert({
      tenant_id: tenantId,
      incidente_id: datosValidados.incidente_id,
      estudiante_id: datosValidados.estudiante_id,
      version,
      estado: 'Borrador',
      contenido_borrador: datosValidados.contenido_borrador,
      creado_por: creadoPor,
    })
    .select(`
      id, tenant_id, incidente_id, estudiante_id, version, estado,
      contenido_borrador, contenido_editado, contenido_aprobado,
      creado_por, aprobado_por, fecha_aprobacion,
      email_apoderado_enviado, fecha_envio_email, created_at, updated_at
    `)
    .single()

  if (error) {
    logger.error('Error al insertar borrador de reporte en BD:', error)
    if (error.code === '23505') {
      const err = new Error('Ya existe un borrador de esta versión para el estudiante e incidente indicado')
      err.status = 409
      throw err
    }
    throw new Error(error.message || 'Error al persistir reporte')
  }

  // Auditoría asíncrona
  try {
    await registrarAuditoria({
      tenant_id: tenantId,
      usuario_id: creadoPor,
      accion: 'CREAR_BORRADOR_REPORTE',
      tabla_afectada: 'reportes_incidentes',
      registro_id: data.id,
      detalles: {
        incidente_id: incidenteId,
        estudiante_id: estudianteId,
        version,
      },
    })
  } catch (auditErr) {
    logger.warn('Fallo no bloqueante al auditar creación de borrador de reporte:', auditErr.message)
  }

  return data
}

/**
 * Obtiene los reportes vinculados a un incidente en particular.
 */
const obtenerReportesPorIncidente = async (tenantId, incidenteId) => {
  const { data, error } = await supabase
    .from('reportes_incidentes')
    .select(`
      id, tenant_id, incidente_id, estudiante_id, version, estado,
      contenido_borrador, contenido_editado, contenido_aprobado,
      creado_por, aprobado_por, fecha_aprobacion,
      email_apoderado_enviado, fecha_envio_email, created_at, updated_at,
      estudiantes:estudiante_id ( id, rut, nombre, apellido, es_pie ),
      creador:creado_por ( id, nombre, apellido, rol ),
      aprobador:aprobado_por ( id, nombre, apellido, rol )
    `)
    .eq('tenant_id', tenantId)
    .eq('incidente_id', incidenteId)
    .order('created_at', { ascending: true })

  if (error) {
    logger.error('Error al consultar reportes del incidente:', error)
    throw new Error('Error al consultar reportes')
  }

  return data || []
}

/**
 * Obtiene un reporte específico por su ID.
 */
const obtenerReportePorId = async (tenantId, reporteId) => {
  const { data, error } = await supabase
    .from('reportes_incidentes')
    .select(`
      id, tenant_id, incidente_id, estudiante_id, version, estado,
      contenido_borrador, contenido_editado, contenido_aprobado,
      creado_por, aprobado_por, fecha_aprobacion,
      email_apoderado_enviado, fecha_envio_email, created_at, updated_at,
      estudiantes:estudiante_id ( id, rut, nombre, apellido, es_pie, direccion ),
      incidentes:incidente_id ( id, fecha, gravedad, relato, medidas ),
      creador:creado_por ( id, nombre, apellido, rol ),
      aprobador:aprobado_por ( id, nombre, apellido, rol )
    `)
    .eq('tenant_id', tenantId)
    .eq('id', reporteId)
    .maybeSingle()

  if (error) {
    logger.error('Error al obtener reporte por id:', error)
    throw new Error('Error al consultar el reporte')
  }

  if (!data) {
    const err = new Error('Reporte no encontrado')
    err.status = 404
    throw err
  }

  return data
}

/**
 * Actualiza el contenido editado de un borrador en curso.
 */
const guardarEdicionBorrador = async ({
  tenantId,
  reporteId,
  contenidoEditado,
  modificadoPor,
}) => {
  const validado = editarReporteSchema.parse({
    contenido_editado: contenidoEditado,
  })

  // Verificar estado actual
  const actual = await obtenerReportePorId(tenantId, reporteId)
  if (actual.estado === 'Aprobado') {
    const err = new Error('No se puede editar un reporte que ya ha sido aprobado y oficializado')
    err.status = 400
    throw err
  }

  const { data, error } = await supabase
    .from('reportes_incidentes')
    .update({
      contenido_editado: validado.contenido_editado,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', reporteId)
    .select(`
      id, tenant_id, incidente_id, estudiante_id, version, estado,
      contenido_borrador, contenido_editado, contenido_aprobado,
      creado_por, aprobado_por, fecha_aprobacion,
      email_apoderado_enviado, fecha_envio_email, created_at, updated_at
    `)
    .single()

  if (error) {
    logger.error('Error al actualizar borrador de reporte:', error)
    throw new Error('Error al guardar edición del reporte')
  }

  return data
}

/**
 * Aprueba y oficializa un reporte de incidente.
 */
const aprobarReporte = async ({
  tenantId,
  reporteId,
  aprobadoPor,
  contenidoFinal,
}) => {
  // Verificar reporte existente
  const actual = await obtenerReportePorId(tenantId, reporteId)
  if (actual.estado === 'Aprobado') {
    const err = new Error('El reporte ya se encuentra aprobado y oficializado')
    err.status = 400
    throw err
  }

  // Determinar contenido oficial: provisto explícitamente, o el editado, o el borrador
  const contenidoParaAprobar = contenidoFinal || actual.contenido_editado || actual.contenido_borrador
  const contenidoValidado = seccionesReporteSchema.parse(contenidoParaAprobar)

  const ahora = new Date().toISOString()
  const { data, error } = await supabase
    .from('reportes_incidentes')
    .update({
      estado: 'Aprobado',
      contenido_aprobado: contenidoValidado,
      aprobado_por: aprobadoPor,
      fecha_aprobacion: ahora,
      updated_at: ahora,
    })
    .eq('tenant_id', tenantId)
    .eq('id', reporteId)
    .select(`
      id, tenant_id, incidente_id, estudiante_id, version, estado,
      contenido_borrador, contenido_editado, contenido_aprobado,
      creado_por, aprobado_por, fecha_aprobacion,
      email_apoderado_enviado, fecha_envio_email, created_at, updated_at
    `)
    .single()

  if (error) {
    logger.error('Error al oficializar reporte en BD:', error)
    throw new Error('Error al aprobar el reporte')
  }

  // Registrar auditoría de aprobación
  try {
    await registrarAuditoria({
      tenant_id: tenantId,
      usuario_id: aprobadoPor,
      accion: 'APROBAR_REPORTE_INCIDENTE',
      tabla_afectada: 'reportes_incidentes',
      registro_id: data.id,
      detalles: {
        incidente_id: actual.incidente_id,
        estudiante_id: actual.estudiante_id,
        fecha_aprobacion: ahora,
      },
    })
  } catch (auditErr) {
    logger.warn('Fallo no bloqueante al auditar aprobación de reporte:', auditErr.message)
  }

  return data
}

module.exports = {
  seccionesReporteSchema,
  crearReporteSchema,
  editarReporteSchema,
  crearBorradorReporte,
  obtenerReportesPorIncidente,
  obtenerReportePorId,
  guardarEdicionBorrador,
  aprobarReporte,
}
