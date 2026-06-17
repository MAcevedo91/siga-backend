const { Router }  = require('express')
const requireRole = require('../middlewares/requireRole')
const {
  listarHandler,
  obtenerHandler,
  crearHandler,
  cambiarEstadoHandler,
  tiposProtocoloHandler,
} = require('../controllers/protocolosController')

const router = Router()

// Catálogo de tipos — todos los roles autenticados
router.get('/tipos-protocolo', tiposProtocoloHandler)

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
