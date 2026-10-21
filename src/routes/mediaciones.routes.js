const { Router } = require('express')
const requireRole = require('../middlewares/requireRole')
const {
  crearHandler,
  listarHandler,
  obtenerHandler,
  notificarApoderadosHandler,
  guardarCompromisosHandler,
  listarCompromisosHandler,
  descargarActaPdfHandler,
  despacharActaHandler,
  evaluarCompromisosHandler,
  cerrarMediacionHandler,
  historialEstudianteHandler,
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

// Consultar historial conductual y restaurativo por estudiante (TASK 7.2.4.1)
// Nota: Se registra antes de /:id para evitar colisión de rutas en Express
router.get(
  '/estudiante/:estudianteId',
  requireRole('Administrador', 'Directivo', 'Equipo de Formación', 'Inspector', 'Docente'),
  historialEstudianteHandler
)

// Obtener expediente detallado de una mediación por ID (incluye participantes y compromisos)
router.get(
  '/:id',
  requireRole('Administrador', 'Directivo', 'Equipo de Formación', 'Inspector', 'Docente'),
  obtenerHandler
)

// Generar y descargar Acta Oficial de Mediación Escolar en PDF (TASK 7.2.3.1)
router.get(
  '/:id/acta-pdf',
  requireRole('Administrador', 'Directivo', 'Equipo de Formación', 'Inspector', 'Docente'),
  descargarActaPdfHandler
)

// Despachar transaccionalmente el Acta Oficial en PDF a apoderados y profesores jefes (TASK 7.2.3.2)
router.post(
  '/:id/despachar-acta',
  requireRole('Administrador', 'Directivo', 'Equipo de Formación', 'Inspector'),
  despacharActaHandler
)

// Evaluar cumplimiento de acuerdos formativos (cumplido, parcial, incumplido - TASK 7.2.4.1)
router.patch(
  '/:id/evaluar-compromisos',
  requireRole('Administrador', 'Directivo', 'Equipo de Formación', 'Inspector'),
  evaluarCompromisosHandler
)

// Sellar y cerrar inmutablemente el expediente de mediación (TASK 7.2.4.1)
router.patch(
  '/:id/cerrar',
  requireRole('Administrador', 'Directivo', 'Equipo de Formación', 'Inspector'),
  cerrarMediacionHandler
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

// Listar compromisos y acuerdos formativos vigentes de una mediación (TASK 7.2.2.1)
router.get(
  '/:id/compromisos',
  requireRole('Administrador', 'Directivo', 'Equipo de Formación', 'Inspector', 'Docente'),
  listarCompromisosHandler
)

// Guardar y actualizar atómicamente acuerdos y compromisos formativos (TASK 7.2.2.1)
router.put(
  '/:id/compromisos',
  requireRole('Administrador', 'Directivo', 'Equipo de Formación', 'Inspector', 'Docente'),
  guardarCompromisosHandler
)

module.exports = router
