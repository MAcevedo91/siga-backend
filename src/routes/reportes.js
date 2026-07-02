const express = require('express')
const router = express.Router()
const { generarPerfilEstudiante } = require('../services/pdfService')
const { calcularRiesgoEstudiante } = require('../services/riesgoService')
const { supabase } = require('../utils/db')
const authenticateToken = require('../middlewares/authenticateToken')

// GET /api/v1/reportes/estudiante/:id/perfil.pdf
router.get('/estudiante/:id/perfil.pdf', authenticateToken, async (req, res) => {
  try {
    const estudianteId = parseInt(req.params.id)
    const tenantId = req.user.tenant_id

    // Get estudiante data
    const { data: estudiante, error: estError } = await supabase
      .from('estudiantes')
      .select('*')
      .eq('id', estudianteId)
      .eq('tenant_id', tenantId)
      .single()

    if (estError) throw new Error(estError.message)

    // Get incidents
    const { data: incidentes, error: incError } = await supabase
      .from('incidentes')
      .select('*')
      .eq('estudiante_id', estudianteId)
      .eq('tenant_id', tenantId)
      .order('fecha', { ascending: false })
      .limit(50)

    if (incError) throw new Error(incError.message)

    // Calculate risk
    const riesgo = await calcularRiesgoEstudiante(estudianteId, tenantId)

    // Generate PDF
    const pdfBuffer = await generarPerfilEstudiante(estudiante, incidentes, riesgo)

    // Send PDF
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="perfil-${estudiante.rut}.pdf"`)
    res.send(pdfBuffer)
  } catch (error) {
    console.error('Error generating PDF:', error)
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
