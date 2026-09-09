const configuracionService = require('../services/configuracionService')

/**
 * Obtiene la IP del cliente considerando proxies.
 */
const getClientIp = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  )
}

/**
 * GET /api/v1/configuracion
 * Retorna parámetros analíticos y matriz de reglas normativas del tenant.
 */
const obtenerConfiguracionHandler = async (req, res, next) => {
  try {
    const data = await configuracionService.obtenerConfiguracion(req.user.tenant_id)
    res.status(200).json({
      status: 'success',
      message: 'Configuración general del establecimiento recuperada',
      data,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * PUT /api/v1/configuracion
 * Actualiza los parámetros de alertas y ventanas de análisis por tenant.
 */
const actualizarConfiguracionHandler = async (req, res, next) => {
  try {
    const data = await configuracionService.actualizarConfiguracion(
      req.user.tenant_id,
      req.user.user_id,
      req.body,
      getClientIp(req)
    )

    res.status(200).json({
      status: 'success',
      message: 'Parámetros de configuración actualizados exitosamente',
      data,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * PUT /api/v1/configuracion/reglas/:id
 * Modifica el plazo normativo u opciones de una regla de protocolo.
 */
const actualizarReglaHandler = async (req, res, next) => {
  try {
    const data = await configuracionService.actualizarPlazoRegla(
      req.user.tenant_id,
      req.params.id,
      req.user.user_id,
      req.body,
      getClientIp(req)
    )

    res.status(200).json({
      status: 'success',
      message: 'Plazo de regla normativa actualizado exitosamente',
      data,
    })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  obtenerConfiguracionHandler,
  actualizarConfiguracionHandler,
  actualizarReglaHandler,
}
