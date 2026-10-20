const { Router }  = require('express')
const requireRole = require('../middlewares/requireRole')
const {
  listarHandler,
  obtenerHandler,
  crearHandler,
  cambiarEstadoHandler,
  tiposProtocoloHandler,
  accionesPendientesHandler,
  listarPasosHandler,
  actualizarPasoHandler,
  subirEvidenciaHandler,
  eliminarEvidenciaHandler,
  descargarExpedientePDFHandler,
} = require('../controllers/protocolosController')
const { uploadEvidenciaMiddleware } = require('../middlewares/uploadEvidenciaMiddleware')

const router = Router()

// Catálogo de tipos — todos los roles autenticados
router.get('/tipos-protocolo', tiposProtocoloHandler)

// Acciones pendientes — solo Administrador, Equipo de Formación, Directivo
// IMPORTANTE: Antes de /:id para no colisionar con obtenerHandler
router.get('/acciones-pendientes',
  requireRole('Administrador', 'Equipo de Formación', 'Directivo'),
  accionesPendientesHandler
)

// Expediente Oficial RICE con Evidencias en PDF (Hallazgo 7)
router.get('/:id/expediente-pdf',
  requireRole('Administrador', 'Equipo de Formación', 'Directivo', 'Docente'),
  descargarExpedientePDFHandler
)

// Lectura — todos los roles autenticados
router.get('/',          listarHandler)
router.get('/:id',       obtenerHandler)
router.get('/:id/pasos', listarPasosHandler)

// Escritura — solo Administrador y Equipo de Formación (Coordinador)
router.post('/',
  requireRole('Administrador', 'Equipo de Formación'),
  crearHandler
)

router.patch('/:id/estado',
  requireRole('Administrador', 'Equipo de Formación'),
  cambiarEstadoHandler
)

router.patch('/:id/pasos/:pasoId',
  requireRole('Administrador', 'Equipo de Formación'),
  actualizarPasoHandler
)

// Carga y eliminación de evidencias probatorias en pasos (Hallazgo 7)
router.post('/:id/pasos/:pasoId/evidencias',
  requireRole('Administrador', 'Equipo de Formación'),
  uploadEvidenciaMiddleware,
  subirEvidenciaHandler
)

router.delete('/:id/pasos/:pasoId/evidencias/:evidenciaId',
  requireRole('Administrador', 'Equipo de Formación'),
  eliminarEvidenciaHandler
)

module.exports = router
