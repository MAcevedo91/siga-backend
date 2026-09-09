const express = require('express')
const router = express.Router()
const { calcularRiesgoEstudiante, getEstudiantesConRiesgo } = require('../services/riesgoService')
const authenticateToken = require('../middlewares/authenticateToken')

// GET /api/v1/riesgo/estudiante/:id
router.get('/estudiante/:id', authenticateToken, async (req, res) => {
  try {
    const estudianteId = parseInt(req.params.id)
    const tenantId = req.user.tenant_id

    const riesgo = await calcularRiesgoEstudiante(estudianteId, tenantId)
    res.json(riesgo)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/v1/riesgo/estudiantes?minScore=50
router.get('/estudiantes', authenticateToken, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id
    const minScore = parseInt(req.query.minScore) || 0

    const estudiantes = await getEstudiantesConRiesgo(tenantId, minScore)
    res.json(estudiantes)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
