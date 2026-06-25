const dashboardService = require('../services/dashboardService')

const resumenHandler = async (req, res, next) => {
  try {
    const data = await dashboardService.getResumen(req.user.tenant_id)
    res.status(200).json({ status: 'success', message: 'Resumen del dashboard', data })
  } catch (err) { next(err) }
}

const porCursoHandler = async (req, res, next) => {
  try {
    const data = await dashboardService.getIncidentesPorCurso(req.user.tenant_id)
    res.status(200).json({ status: 'success', message: 'Incidentes por curso', data })
  } catch (err) { next(err) }
}

const porGravedadHandler = async (req, res, next) => {
  try {
    const data = await dashboardService.getIncidentesPorGravedad(req.user.tenant_id)
    res.status(200).json({ status: 'success', message: 'Incidentes por gravedad', data })
  } catch (err) { next(err) }
}

const tendenciaMensualHandler = async (req, res, next) => {
  try {
    const data = await dashboardService.getTendenciaMensual(req.user.tenant_id)
    res.status(200).json({ status: 'success', message: 'Tendencia mensual', data })
  } catch (err) { next(err) }
}

module.exports = { resumenHandler, porCursoHandler, porGravedadHandler, tendenciaMensualHandler }
