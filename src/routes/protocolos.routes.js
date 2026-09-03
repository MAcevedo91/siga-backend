const { Router }  = require('express')
const requireRole = require('../middlewares/requireRole')
const {
  listarHandler,
  obtenerHandler,
  crearHandler,
  cambiarEstadoHandler,
  tiposProtocoloHandler,
  accionesPendientesHandler,
} = require('../controllers/protocolosController')

const router = Router()

// Catálogo de tipos — todos los roles autenticados
router.get('/tipos-protocolo', tiposProtocoloHandler)

// Acciones pendientes — solo Administrador, Equipo de Formación, Directivo
// IMPORTANTE: Antes de /:id para no colisionar con obtenerHandler
router.get('/acciones-pendientes',
  requireRole('Administrador', 'Equipo de Formación', 'Directivo'),
  accionesPendientesHandler
)

// Lectura — todos los roles autenticados
router.get('/',    listarHandler)
router.get('/:id', obtenerHandler)

// Escritura — solo Administrador y Equipo de Formación (Coordinador)
router.post('/',
  requireRole('Administrador', 'Equipo de Formación'),
  crearHandler
)

router.patch('/:id/estado',
  requireRole('Administrador', 'Equipo de Formación'),
  cambiarEstadoHandler
)

module.exports = router
