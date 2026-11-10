const { Router } = require('express')
const {
  obtenerCitacionPublicaHandler,
  responderCitacionPublicaHandler,
} = require('../controllers/citacionesController')

const router = Router()

// =============================================================================
// RUTAS PÚBLICAS: CITACIONES FORMATIVAS (ACCESO MÓVIL FAMILIAS SIN LOGIN)
// =============================================================================

// Obtener datos sanitizados de la citación mediante token seguro (72 hrs)
router.get('/token/:token', obtenerCitacionPublicaHandler)

// Confirmar asistencia, reprogramar o justificar en 1 clic móvil
router.post('/responder', responderCitacionPublicaHandler)

module.exports = router
