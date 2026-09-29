const { z } = require('zod')
const { supabase } = require('../utils/db')
const logger = require('../utils/logger')
const { registrarAuditoria } = require('./auditoriaService')
const dlpSanitizer = require('./dlpSanitizer')
const geminiService = require('./geminiService')
const emailService = require('./emailService')
const pdfService = require('./pdfService')


const {
  seccionesReporteSchema,
  crearReporteSchema,
  editarReporteSchema,
} = require('../schemas/reportesSchemas')

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
    .select('estudiante_id')
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

  // Despacho automatizado no bloqueante al apoderado titular con PDF adjunto (HU 6.4 - Tarea 6.4.1)
  try {
    const { data: apoderado } = await supabase
      .from('apoderados')
      .select('id, nombre, apellido, email, telefono')
      .eq('estudiante_id', actual.estudiante_id)
      .eq('es_titular', true)
      .maybeSingle()

    if (apoderado && apoderado.email) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id, nombre, rbd, direccion')
        .eq('id', tenantId)
        .maybeSingle()

      const { data: estudianteData } = await supabase
        .from('estudiantes')
        .select(`
          id, rut, nombre, apellido, es_pie, direccion,
          cursos:curso_id ( id, nombre, nivel, letra )
        `)
        .eq('id', actual.estudiante_id)
        .maybeSingle()

      const estudianteCompleto = {
        ...(actual.estudiantes || {}),
        ...(estudianteData || {}),
      }

      const incidenteCompleto = actual.incidentes || { id: actual.incidente_id }

      const pdfBuffer = await pdfService.generarInformeOficialIncidentePDF({
        reporte: data,
        incidente: incidenteCompleto,
        estudiante: estudianteCompleto,
        tenant: tenant || {},
        apoderado,
      })

      const anio = new Date(ahora).getFullYear()
      const correlativo = String(data.id || '').replace(/-/g, '').slice(0, 6).toUpperCase()
      const folio = `INF-${anio}-${correlativo}`

      const fechaIncidenteStr = incidenteCompleto.fecha
        ? new Date(incidenteCompleto.fecha).toLocaleDateString('es-CL')
        : 'Fecha no registrada'

      const fechaAprobacionStr = new Date(ahora).toLocaleDateString('es-CL', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })

      const filename = `Informe_Oficial_${estudianteCompleto.apellido || 'Estudiante'}.pdf`

      await emailService.enviarEmailInformeOficialApoderado({
        apoderadoEmail: apoderado.email,
        apoderadoNombre: `${apoderado.nombre} ${apoderado.apellido}`,
        estudianteNombre: `${estudianteCompleto.nombre} ${estudianteCompleto.apellido}`,
        colegioNombre: tenant?.nombre || 'Escuela Coeducacional N° 1 El Salvador',
        folio,
        fechaIncidente: fechaIncidenteStr,
        fechaAprobacion: fechaAprobacionStr,
        pdfBuffer,
        filename,
      })

      const fechaEnvio = new Date().toISOString()
      await supabase
        .from('reportes_incidentes')
        .update({
          email_apoderado_enviado: true,
          fecha_envio_email: fechaEnvio,
        })
        .eq('id', data.id)

      data.email_apoderado_enviado = true
      data.fecha_envio_email = fechaEnvio

      logger.info(`Informe oficial enviado por correo al apoderado titular (${apoderado.email}) para reporte ${data.id}`)
    } else {
      logger.info(`El estudiante ${actual.estudiante_id} no cuenta con apoderado titular con email. Notificación presencial requerida.`)
    }
  } catch (emailErr) {
    logger.error('Error no bloqueante al despachar informe oficial por email al apoderado:', emailErr.message || emailErr)
  }

  return data
}

/**
 * Orquesta la generación asistida con IA de borradores diferenciados para todos
 * los estudiantes involucrados en un incidente escolar.
 *
 * Flujo por cada estudiante:
 * 1. Sanitización DLP (enmascara RUT, teléfonos, emails y nombres con tokens).
 * 2. Inferencia estructurada vía Google Gemini Flash (o fallback algorítmico).
 * 3. Desanonimización local diferenciada (restaura nombre real del foco, mantiene reserva de contrapartes).
 * 4. Determinación de la versión adecuada (si ya existe un borrador, crea versión N+1).
 * 5. Persistencia atómica en reportes_incidentes y registro de auditoría.
 */
const generarBorradoresParaIncidente = async ({
  tenantId,
  incidenteId,
  usuarioId,
  incidenteData,
}) => {
  let incidente = incidenteData

  // Si no se proporcionó incidenteData, obtenerlo de la base de datos
  if (!incidente) {
    const { data: inc, error: errInc } = await supabase
      .from('incidentes')
      .select(`
        id, fecha, gravedad, estado, relato, medidas, fecha_creacion,
        tipos_abordaje ( id, nombre ),
        usuarios ( id, nombre, apellido, rol )
      `)
      .eq('id', incidenteId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (errInc) {
      logger.error('Error al consultar incidente para generar reporte:', errInc)
      throw new Error('Error al consultar incidente')
    }

    if (!inc) {
      const err = new Error('Incidente no encontrado')
      err.status = 404
      throw err
    }

    // Consultar estudiantes involucrados
    const { data: involucrados, error: errEst } = await supabase
      .from('incidente_estudiantes')
      .select(`
        es_victima, observacion,
        estudiantes ( id, rut, nombre, apellido, es_pie )
      `)
      .eq('incidente_id', incidenteId)

    if (errEst) {
      logger.error('Error al consultar involucrados del incidente:', errEst)
      throw new Error('Error al consultar estudiantes del incidente')
    }

    const flatEstudiantes = (involucrados || []).map(e => ({
      ...e.estudiantes,
      es_victima: e.es_victima,
      observacion: e.observacion,
    }))

    incidente = {
      ...inc,
      tipo_abordaje: inc.tipos_abordaje?.nombre || 'General',
      estudiantes: flatEstudiantes,
    }
  }

  const estudiantes = incidente.estudiantes || []
  if (estudiantes.length === 0) {
    const err = new Error('El incidente no tiene estudiantes involucrados registrados')
    err.status = 400
    throw err
  }

  const reportesGenerados = []

  for (const estudianteFoco of estudiantes) {
    // 1. Generar propuesta con Gemini Flash aplicando pipeline DLP y desanonimización
    const propuestaIA = await geminiService.generarPropuestaReporteIA(
      incidente,
      estudianteFoco.id
    )
    const seccionesDiferenciadas = propuestaIA.secciones || propuestaIA

    // 2. Determinar versión incremental si ya existe un reporte previo
    const { data: versionesPrevias } = await supabase
      .from('reportes_incidentes')
      .select('version')
      .eq('tenant_id', tenantId)
      .eq('incidente_id', incidenteId)
      .eq('estudiante_id', estudianteFoco.id)
      .order('version', { ascending: false })
      .limit(1)

    const siguienteVersion = versionesPrevias && versionesPrevias.length > 0
      ? (versionesPrevias[0].version + 1)
      : 1

    // 5. Persistir nuevo borrador
    const nuevoReporte = await crearBorradorReporte({
      tenantId,
      incidenteId,
      estudianteId: estudianteFoco.id,
      contenidoBorrador: seccionesDiferenciadas,
      creadoPor: usuarioId,
      version: siguienteVersion,
    })

    reportesGenerados.push(nuevoReporte)
  }

  return reportesGenerados
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
  generarBorradoresParaIncidente,
}
