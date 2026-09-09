const express = require('express')
const router = express.Router()
const broadcastsController = require('../../controllers/broadcastsController')
const authenticateToken = require('../../middlewares/authenticateToken')
const setTenantContext = require('../../middlewares/setTenantContext')
const requireRole = require('../../middlewares/requireRole')

router.use(authenticateToken)
router.use(setTenantContext)

// Crear broadcast: solo Directivo/Admin
router.post('/', requireRole('Directivo', 'Administrador'), broadcastsController.crearBroadcast)

// Listar y leer: todos los usuarios
router.get('/', broadcastsController.getBroadcasts)
router.get('/:id', broadcastsController.getBroadcast)
router.post('/:id/leer', broadcastsController.marcarLeido)

// Estadísticas: solo Directivo/Admin
router.get('/:id/lecturas', requireRole('Directivo', 'Administrador'), broadcastsController.getEstadisticas)

module.exports = router
