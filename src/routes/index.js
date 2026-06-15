const { Router } = require('express')
const router = Router()

// Health check — no requiere autenticación
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Servidor operativo',
    data: {
      timestamp: new Date().toISOString(),
    },
  })
})

// --- Módulos ---
router.use('/auth', require('./auth.routes'))
// router.use('/incidentes', require('./incidentes.routes'))

module.exports = router
