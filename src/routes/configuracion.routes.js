const { Router } = require('express')
const requireRole = require('../middlewares/requireRole')
const {
  obtenerConfiguracionHandler,
  actualizarConfiguracionHandler,
  actualizarReglaHandler,
} = require('../controllers/configuracionController')

const router = Router()

// Todas las rutas de configuración requieren rol Administrador (RF-02)
router.use(requireRole('Administrador'))

// GET /api/v1/configuracion
router.get('/', obtenerConfiguracionHandler)

// PUT /api/v1/configuracion
router.put('/', actualizarConfiguracionHandler)

// PUT /api/v1/configuracion/reglas/:id
router.put('/reglas/:id', actualizarReglaHandler)

module.exports = router
