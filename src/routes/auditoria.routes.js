const express = require('express')
const router = express.Router()
const {
  getAuditoriaTimeline,
  getAuditoriaLogs
} = require('../services/auditoriaService')
const authenticateToken = require('../middlewares/authenticateToken')

/**
 * GET /auditoria/timeline
 * Obtiene el historial de cambios para un registro específico
 * Query params: tabla, registroId
 */
router.get('/timeline', authenticateToken, async (req, res) => {
  try {
    const { tabla, registroId } = req.query
    const tenantId = req.user.tenant_id

    if (!tabla || !registroId) {
      return res.status(400).json({
        error: 'Los parámetros tabla y registroId son requeridos'
      })
    }

    const timeline = await getAuditoriaTimeline({
      tenantId,
      tabla,
      registroId
    })

    res.json(timeline)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /auditoria/logs
 * Obtiene registros de auditoría con filtros opcionales
 * Query params: tabla, userId, accion, fechaDesde, fechaHasta, limit
 */
router.get('/logs', authenticateToken, async (req, res) => {
  try {
    const {
      tabla,
      userId,
      accion,
      fechaDesde,
      fechaHasta,
      limit
    } = req.query
    const tenantId = req.user.tenant_id

    const logs = await getAuditoriaLogs({
      tenantId,
      tabla,
      userId,
      accion,
      fechaDesde: fechaDesde ? new Date(fechaDesde) : undefined,
      fechaHasta: fechaHasta ? new Date(fechaHasta) : undefined,
      limit: limit ? parseInt(limit) : 100
    })

    res.json(logs)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
