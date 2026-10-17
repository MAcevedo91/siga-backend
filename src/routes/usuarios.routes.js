const { Router } = require('express')
const requireRole = require('../middlewares/requireRole')
const { uploadAvatarMiddleware } = require('../middlewares/uploadAvatar')
const {
  listarHandler,
  obtenerHandler,
  crearHandler,
  actualizarHandler,
  desactivarHandler,
  subirAvatarHandler,
  eliminarAvatarHandler,
} = require('../controllers/usuariosController')

const router = Router()

// Rutas de gestión de foto de perfil / avatar
// Accesible para el propio usuario autenticado o para el Administrador del tenant
router.post('/:id/avatar', uploadAvatarMiddleware, subirAvatarHandler)
router.delete('/:id/avatar', eliminarAvatarHandler)

// Endpoints de consulta y administración
router.get('/',                 requireRole('Administrador'), listarHandler)
router.get('/:id',              obtenerHandler)
router.post('/',                requireRole('Administrador'), crearHandler)
router.put('/:id',              requireRole('Administrador'), actualizarHandler)
router.patch('/:id/desactivar', requireRole('Administrador'), desactivarHandler)

module.exports = router
