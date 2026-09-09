const express = require('express')
const router = express.Router()
const mensajesController = require('../../controllers/mensajesController')
const authenticateToken = require('../../middlewares/authenticateToken')
const setTenantContext = require('../../middlewares/setTenantContext')

// Todos los endpoints requieren auth
router.use(authenticateToken)
router.use(setTenantContext)

router.post('/conversacion', mensajesController.crearConversacion)
router.get('/conversaciones', mensajesController.getConversaciones)
router.get('/:conversacionId', mensajesController.getMensajes)
router.post('/:conversacionId', mensajesController.enviarMensaje)
router.post('/:conversacionId/leer', mensajesController.marcarLeido)

module.exports = router
