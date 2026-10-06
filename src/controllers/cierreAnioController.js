const cierreAnioService = require('../services/cierreAnioService')
const logger = require('../utils/logger')

/**
 * GET /api/v1/cierre-anio/estado-actual
 * Retorna el estado del período lectivo activo, cursos vigentes y profesores jefes.
 */
const obtenerEstadoActualHandler = async (req, res, next) => {
  try {
    const data = await cierreAnioService.obtenerEstadoActual(req.user.tenant_id)
    res.status(200).json({
      status: 'success',
      data,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * GET /api/v1/cierre-anio/propuesta
 * Genera la propuesta automática de promoción para todos los alumnos del colegio.
 */
const generarPropuestaHandler = async (req, res, next) => {
  try {
    const { tipo_establecimiento } = req.query
    const data = await cierreAnioService.generarPropuestaPromocion(req.user.tenant_id, {
      tipo_establecimiento,
    })
    res.status(200).json({
      status: 'success',
      data,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * POST /api/v1/cierre-anio/ejecutar
 * Ejecuta el cierre del año lectivo y la promoción masiva atómica.
 */
const ejecutarCierreHandler = async (req, res, next) => {
  try {
    const usuarioId = req.user?.user_id || req.user?.id || null
    const resultado = await cierreAnioService.ejecutarCierreYPromocion(
      req.user.tenant_id,
      usuarioId,
      req.body
    )

    res.status(200).json({
      status: 'success',
      message: 'Cierre de año lectivo y promoción de cursos ejecutado exitosamente',
      data: resultado,
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  obtenerEstadoActualHandler,
  generarPropuestaHandler,
  ejecutarCierreHandler,
}
