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

module.exports = {
  generarBorradorHandler,
  listarReportesIncidenteHandler,
  obtenerReporteHandler,
  editarBorradorHandler,
  aprobarReporteHandler,
}
