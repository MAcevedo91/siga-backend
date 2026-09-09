const express = require('express')
const router = express.Router()
const notificacionesController = require('../controllers/notificacionesController')

// GET /api/v1/notificaciones - Obtener mis notificaciones
router.get('/', notificacionesController.obtenerMisNotificaciones)

// GET /api/v1/notificaciones/contador - Contador no leídas
router.get('/contador', notificacionesController.obtenerContadorNoLeidas)

// PUT /api/v1/notificaciones/:id/leer - Marcar como leída
router.put('/:id/leer', notificacionesController.marcarComoLeida)

// PUT /api/v1/notificaciones/leer-todas - Marcar todas como leídas
router.put('/leer-todas', notificacionesController.marcarTodasComoLeidas)

module.exports = router
