const { Router }  = require('express')
const requireRole = require('../middlewares/requireRole')
const {
  listarHandler,
  obtenerHandler,
  crearHandler,
  cambiarEstadoHandler,
  tiposAbordajeHandler,
} = require('../controllers/incidentesController')

const {
  generarBorradorHandler,
  listarReportesIncidenteHandler,
  obtenerReporteHandler,
  editarBorradorHandler,
  aprobarReporteHandler,
} = require('../controllers/reportesController')

const router = Router()

// Catálogo de tipos de abordaje — todos los roles
router.get('/tipos-abordaje', tiposAbordajeHandler)

// Lectura — todos los roles autenticados
router.get('/',    listarHandler)
router.get('/:id', obtenerHandler)

// Creación — Administrador, Equipo de Formación e Inspector
router.post('/',
  requireRole('Administrador', 'Equipo de Formación', 'Inspector'),
  crearHandler
)

// Cambio de estado — solo Administrador y Equipo de Formación
router.patch('/:id/estado',
  requireRole('Administrador', 'Equipo de Formación'),
  cambiarEstadoHandler
)


// =============================================================================
// REPORTES NORMATIVOS CON ASISTENCIA IA (SPRINT 6 - HU 6.1)
// =============================================================================

// Generación asistida de borradores diferenciados con Gemini Flash y DLP
router.post(
  '/:id/borrador-reporte',
  requireRole('Administrador', 'Directivo', 'Equipo de Formación', 'Inspector'),
  generarBorradorHandler
)

// Consulta de reportes del incidente (todos los roles autorizados a ver el incidente)
router.get('/:id/reportes', listarReportesIncidenteHandler)

// Detalle de un reporte específico
router.get('/:id/reportes/:reporteId', obtenerReporteHandler)

// Edición de borrador en curso (sin aprobar)
router.patch(
  '/:id/reportes/:reporteId',
  requireRole('Administrador', 'Directivo', 'Equipo de Formación', 'Inspector'),
  editarBorradorHandler
)

// Aprobación y oficialización formal (exclusivo jefatura: Director/a y Convivencia)
router.post(
  '/:id/reportes/:reporteId/aprobar',
  requireRole('Administrador', 'Directivo', 'Equipo de Formación'),
  aprobarReporteHandler
)

module.exports = router
