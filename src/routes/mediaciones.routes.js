const { Router } = require('express')
const requireRole = require('../middlewares/requireRole')
const {
  crearHandler,
  listarHandler,
  obtenerHandler,
  notificarApoderadosHandler,
} = require('../controllers/mediacionesController')

const router = Router()

// =============================================================================
// RUTAS DEL MÓDULO DE MEDIACIONES Y ACUERDOS FORMATIVOS (SPRINT 7 / ÉPICA 7.2)
// Todas las rutas requieren token y contexto de tenant configurado
// =============================================================================

// Listar mediaciones paginadas y filtrables
router.get(
  '/',
  requireRole('Administrador', 'Directivo', 'Equipo de Formación', 'Inspector', 'Docente'),
  listarHandler
)

// Obtener expediente detallado de una mediación por ID
router.get(
  '/:id',
  requireRole('Administrador', 'Directivo', 'Equipo de Formación', 'Inspector', 'Docente'),
  obtenerHandler
)

// Registrar nueva mediación con participantes
router.post(
  '/',
  requireRole('Administrador', 'Directivo', 'Equipo de Formación', 'Inspector', 'Docente'),
  crearHandler
)

// Registrar aviso previo y notificar formalmente a apoderados
router.post(
  '/:id/notificar-apoderados',
  requireRole('Administrador', 'Directivo', 'Equipo de Formación', 'Inspector'),
  notificarApoderadosHandler
)

module.exports = router
