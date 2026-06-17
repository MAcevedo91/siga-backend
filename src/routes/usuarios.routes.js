const { Router } = require('express')
const requireRole = require('../middlewares/requireRole')
const {
  listarHandler,
  obtenerHandler,
  crearHandler,
  actualizarHandler,
  desactivarHandler,
} = require('../controllers/usuariosController')

const router = Router()

// Todos los endpoints de usuarios son exclusivos del Administrador
router.use(requireRole('Administrador'))

router.get('/',                   listarHandler)
router.get('/:id',                obtenerHandler)
router.post('/',                  crearHandler)
router.put('/:id',                actualizarHandler)
router.patch('/:id/desactivar',   desactivarHandler)

module.exports = router
