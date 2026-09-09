const notificacionesService = require('../services/notificacionesService')
const logger = require('../utils/logger')

async function obtenerMisNotificaciones(req, res) {
  try {
    const userId = req.user.id
    const tenantId = req.user.tenant_id

    const notificaciones = await notificacionesService.obtenerNotificaciones(userId, tenantId)

    res.json({
      success: true,
      data: notificaciones
    })
  } catch (error) {
    logger.error('Error al obtener notificaciones', {
      error: error.message,
      userId: req.user.id
    })
    res.status(500).json({
      success: false,
      error: 'Error al obtener notificaciones'
    })
  }
}

async function marcarComoLeida(req, res) {
  try {
    const { id } = req.params
    const userId = req.user.id

    await notificacionesService.marcarComoLeida(parseInt(id), userId)

    res.json({
      success: true,
      message: 'Notificación marcada como leída'
    })
  } catch (error) {
    logger.error('Error al marcar notificación como leída', {
      error: error.message,
      notificacionId: req.params.id
    })
    res.status(500).json({
      success: false,
      error: 'Error al marcar notificación como leída'
    })
  }
}

async function obtenerContadorNoLeidas(req, res) {
  try {
    const userId = req.user.id

    const count = await notificacionesService.contarNoLeidas(userId)

    res.json({
      success: true,
      data: { count }
    })
  } catch (error) {
    logger.error('Error al contar notificaciones no leídas', {
      error: error.message,
      userId: req.user.id
    })
    res.status(500).json({
      success: false,
      error: 'Error al contar notificaciones'
    })
  }
}

async function marcarTodasComoLeidas(req, res) {
  try {
    const userId = req.user.id
    const tenantId = req.user.tenant_id

    await notificacionesService.marcarTodasComoLeidas(userId, tenantId)

    res.json({
      success: true,
      message: 'Todas las notificaciones marcadas como leídas'
    })
  } catch (error) {
    logger.error('Error al marcar todas como leídas', {
      error: error.message,
      userId: req.user.id
    })
    res.status(500).json({
      success: false,
      error: 'Error al marcar todas como leídas'
    })
  }
}

module.exports = {
  obtenerMisNotificaciones,
  marcarComoLeida,
  obtenerContadorNoLeidas,
  marcarTodasComoLeidas
}
