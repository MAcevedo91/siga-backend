const { Router } = require('express')
const requireRole = require('../middlewares/requireRole')
const {
  crearCitacionHandler,
  listarCitacionesHandler,
  registrarAcuerdosHandler,
  descargarActaPdfHandler,
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

// Registrar acuerdos mutuos y emitir acta oficial (TASK 10.2.3)
router.post(
  '/:id/acuerdos',
  requireRole('Administrador', 'Directivo', 'Equipo de Formación', 'Docente'),
  registrarAcuerdosHandler
)

// Descargar Acta Oficial PDF con membrete y código SHA-256 (TASK 10.2.3)
router.get(
  '/:id/acta-pdf',
  requireRole('Administrador', 'Directivo', 'Equipo de Formación', 'Inspector', 'Docente'),
  descargarActaPdfHandler
)

module.exports = router
