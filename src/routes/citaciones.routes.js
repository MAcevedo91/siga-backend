const { Router } = require('express')
const requireRole = require('../middlewares/requireRole')
const {
  crearCitacionHandler,
  listarCitacionesHandler,
} = require('../controllers/citacionesController')

const router = Router()

// =============================================================================
// RUTAS PRIVADAS: CITACIONES FORMATIVAS (DOCENTES / DIRECTIVOS / CONVIVENCIA)
// =============================================================================

// Listar citaciones del establecimiento
router.get(
  '/',
  requireRole('Administrador', 'Directivo', 'Equipo de Formación', 'Inspector', 'Docente'),
  listarCitacionesHandler
)

// Programar nueva citación formativa (valida traslape de horario del docente)
router.post(
  '/',
  requireRole('Administrador', 'Directivo', 'Equipo de Formación', 'Inspector', 'Docente'),
  crearCitacionHandler
)

module.exports = router
