const pdfService = require('../services/pdfService')
const { supabase } = require('../utils/db')
const reportesService = require('../services/reportesService')
const logger = require('../utils/logger')

/**
 * POST /api/v1/incidentes/:id/borrador-reporte
 * Genera y persiste borradores diferenciados asistidos por IA para todos los
 * estudiantes involucrados en el incidente especificado.
 */
const generarBorradorHandler = async (req, res, next) => {
  try {
    const { id: incidenteId } = req.params
    const tenantId = req.user.tenant_id
    const usuarioId = req.user.user_id

    const reportes = await reportesService.generarBorradoresParaIncidente({
      tenantId,
      incidenteId,
      usuarioId,
    })

    res.status(201).json({
      status: 'success',
      message: `${reportes.length} borrador(es) de reporte generado(s) exitosamente`,
      data: reportes,
    })
  } catch (err) {
    logger.error('Error en generarBorradorHandler:', err)
    next(err)
  }
}

/**
 * GET /api/v1/incidentes/:id/reportes
 * Retorna todos los reportes generados para un incidente dado dentro del tenant.
 */
const listarReportesIncidenteHandler = async (req, res, next) => {
  try {
    const { id: incidenteId } = req.params
    const tenantId = req.user.tenant_id

    const reportes = await reportesService.obtenerReportesPorIncidente(tenantId, incidenteId)

    res.status(200).json({
      status: 'success',
      message: `${reportes.length} reporte(s) encontrado(s)`,
      data: reportes,
    })
  } catch (err) {
    logger.error('Error en listarReportesIncidenteHandler:', err)
    next(err)
  }
}

/**
 * GET /api/v1/incidentes/:id/reportes/:reporteId
 * Retorna el detalle completo de un reporte específico.
 */
const obtenerReporteHandler = async (req, res, next) => {
  try {
    const { reporteId } = req.params
    const tenantId = req.user.tenant_id

    const reporte = await reportesService.obtenerReportePorId(tenantId, reporteId)

    res.status(200).json({
      status: 'success',
      message: 'Reporte encontrado exitosamente',
      data: reporte,
    })
  } catch (err) {
    logger.error('Error en obtenerReporteHandler:', err)
    next(err)
  }
}

/**
 * PATCH /api/v1/incidentes/:id/reportes/:reporteId
 * Actualiza el contenido editado de un borrador en curso sin oficializarlo.
 */
const editarBorradorHandler = async (req, res, next) => {
  try {
    const { reporteId } = req.params
    const { contenido_editado } = req.body
    const tenantId = req.user.tenant_id
    const usuarioId = req.user.user_id

    if (!contenido_editado) {
      return res.status(400).json({
        status: 'error',
        message: 'El campo "contenido_editado" es obligatorio',
        statusCode: 400,
      })
    }

    const reporteActualizado = await reportesService.guardarEdicionBorrador({
      tenantId,
      reporteId,
      contenidoEditado: contenido_editado,
      modificadoPor: usuarioId,
    })

    res.status(200).json({
      status: 'success',
      message: 'Borrador de reporte actualizado exitosamente',
      data: reporteActualizado,
    })
  } catch (err) {
    logger.error('Error en editarBorradorHandler:', err)
    next(err)
  }
}

/**
 * POST /api/v1/incidentes/:id/reportes/:reporteId/aprobar
 * Aprueba y oficializa formalmente un reporte de incidente.
 * Exclusivo para directivos y coordinación.
 */
const aprobarReporteHandler = async (req, res, next) => {
  try {
    const { reporteId } = req.params
    const { contenido_final } = req.body || {}
    const tenantId = req.user.tenant_id
    const usuarioId = req.user.user_id

    const reporteAprobado = await reportesService.aprobarReporte({
      tenantId,
      reporteId,
      aprobadoPor: usuarioId,
      contenidoFinal: contenido_final,
    })

    res.status(200).json({
      status: 'success',
      message: 'Reporte aprobado y oficializado exitosamente',
      data: reporteAprobado,
    })
  } catch (err) {
    logger.error('Error en aprobarReporteHandler:', err)
    next(err)
  }
}


/**
 * GET /api/v1/incidentes/:id/reportes/:reporteId/pdf
 * Genera y descarga el archivo PDF oficial del reporte de convivencia escolar.
 * Requisito normativo: El reporte DEBE estar en estado "Aprobado".
 */
const descargarReportePdfHandler = async (req, res, next) => {
  try {
    const { id: incidenteId, reporteId } = req.params
    const tenantId = req.user.tenant_id

    // 1. Obtener datos completos del reporte
    const reporte = await reportesService.obtenerReportePorId(tenantId, reporteId)

    // Validar que el reporte corresponda al incidente solicitado
    if (reporte.incidente_id !== incidenteId) {
      return res.status(400).json({
        status: 'error',
        message: 'El reporte solicitado no corresponde al incidente especificado',
        statusCode: 400,
      })
    }

    // 2. Control de inmutabilidad: Solo descargable definitivo si está Aprobado (salvo en modo vista previa de validación)
    const esPreview = req.query.preview === 'true'
    if (reporte.estado !== 'Aprobado' && !esPreview) {
      return res.status(400).json({
        status: 'error',
        message: 'Debe aprobar el reporte antes de emitir el PDF oficial definitivo',
        statusCode: 400,
      })
    }

    // 3. Consultar datos del tenant (establecimiento escolar)
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, nombre, rbd, direccion')
      .eq('id', tenantId)
      .maybeSingle()

    // 4. Consultar datos complementarios del estudiante (incluyendo curso)
    const { data: estudianteData } = await supabase
      .from('estudiantes')
      .select(`
        id, rut, nombre, apellido, es_pie, direccion,
        cursos:curso_id ( id, nombre, nivel, letra )
      `)
      .eq('id', reporte.estudiante_id)
      .maybeSingle()

    // 5. Consultar apoderado titular
    const { data: apoderado } = await supabase
      .from('apoderados')
      .select('id, nombre, apellido, rut, telefono, email')
      .eq('estudiante_id', reporte.estudiante_id)
      .eq('es_titular', true)
      .maybeSingle()

    // 6. Consultar TODOS los estudiantes involucrados en el incidente para garantizar la sanitización DLP de contrapartes
    const { data: todosInvolucrados } = await supabase
      .from('incidente_estudiantes')
      .select(`
        estudiante_id, es_victima, observacion,
        estudiantes:estudiante_id ( id, rut, nombre, apellido )
      `)
      .eq('incidente_id', incidenteId)

    const involucradosList = (todosInvolucrados || []).map((i) => ({
      ...(i.estudiantes || {}),
      id: i.estudiante_id,
      es_victima: i.es_victima,
    }))

    // 7. Generar Buffer del PDF oficial o de validación con PDFKit
    const estudianteCompleto = {
      ...(reporte.estudiantes || {}),
      ...(estudianteData || {}),
    }

    const incidenteCompleto = {
      ...(reporte.incidentes || { id: incidenteId }),
      estudiantes: involucradosList,
      incidente_estudiantes: involucradosList,
    }

    const pdfBuffer = await pdfService.generarInformeOficialIncidentePDF({
      reporte,
      incidente: incidenteCompleto,
      estudiante: estudianteCompleto,
      tenant: tenant || {},
      apoderado,
      preview: esPreview,
    })

    // 8. Enviar PDF con cabeceras de visualización y descarga
    const apellidoEst = (estudianteCompleto.apellido || 'Alumno').replace(/\s+/g, '_')
    const prefix = esPreview ? 'Validacion_Borrador' : 'Informe_Incidente'
    const filename = `${prefix}_${incidenteId.slice(0, 8)}_${apellidoEst}.pdf`

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`)
    res.setHeader('Content-Length', pdfBuffer.length)

    return res.status(200).send(pdfBuffer)
  } catch (err) {
    logger.error('Error en descargarReportePdfHandler:', err)
    next(err)
  }
}

module.exports = {
  generarBorradorHandler,
  listarReportesIncidenteHandler,
  obtenerReporteHandler,
  editarBorradorHandler,
  aprobarReporteHandler,
  descargarReportePdfHandler,
}
