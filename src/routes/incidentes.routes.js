const { Router }  = require('express')
const requireRole = require('../middlewares/requireRole')
const {
  listarHandler,
  obtenerHandler,
  crearHandler,
  cambiarEstadoHandler,
  tiposAbordajeHandler,
} = require('../controllers/incidentesController')

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

module.exports = router
