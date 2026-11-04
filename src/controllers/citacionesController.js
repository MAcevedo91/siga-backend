const citacionesService = require('../services/citacionesService')
const logger = require('../utils/logger')

/**
 * POST /api/v1/citaciones y POST /api/citaciones
 * Programa una nueva citación formativa. Valida disponibilidad del docente y pertenencia.
 */
const crearCitacionHandler = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id
    const docenteId = req.user.user_id || req.user.id

    const data = await citacionesService.crearCitacion(tenantId, docenteId, req.body)

    res.status(201).json({
      status: 'success',
      message: 'Citación pedagógica-formativa programada exitosamente',
      data,
    })
  } catch (err) {
    logger.error('Error en crearCitacionHandler:', err)
    next(err)
  }
}

/**
 * GET /api/v1/citaciones y GET /api/citaciones
 * Lista el historial de citaciones del establecimiento con paginación y filtros.
 */
const listarCitacionesHandler = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id
    const data = await citacionesService.listarCitaciones(tenantId, req.query)

    res.status(200).json({
      status: 'success',
      ...data,
    })
  } catch (err) {
    logger.error('Error en listarCitacionesHandler:', err)
    next(err)
  }
}

/**
 * GET /api/v1/citaciones/public/token/:token y GET /api/citaciones/public/token/:token
 * Endpoint público para abrir la colilla de citación en el móvil del apoderado sin autenticación.
 */
const obtenerCitacionPublicaHandler = async (req, res, next) => {
  try {
    const { token } = req.params
    const data = await citacionesService.obtenerCitacionPublicaPorToken(token)

    res.status(200).json({
      status: 'success',
      data,
    })
  } catch (err) {
    logger.error('Error en obtenerCitacionPublicaHandler:', err)
    next(err)
  }
}

/**
 * POST /api/v1/citaciones/public/responder y POST /api/citaciones/public/responder
 * Endpoint público para procesar la respuesta en 1-clic del apoderado (confirmar, reprogramar, justificar).
 */
const responderCitacionPublicaHandler = async (req, res, next) => {
  try {
    const resultado = await citacionesService.responderCitacionPublica(req.body)

    res.status(200).json({
      status: 'success',
      message: resultado.mensaje,
      data: resultado.citacion,
    })
  } catch (err) {
    logger.error('Error en responderCitacionPublicaHandler:', err)
    next(err)
  }
}

module.exports = {
  crearCitacionHandler,
  listarCitacionesHandler,
  obtenerCitacionPublicaHandler,
  responderCitacionPublicaHandler,
}
