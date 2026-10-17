const { Router } = require('express')
const requireRole = require('../middlewares/requireRole')
const uploadRiceMiddleware = require('../middlewares/uploadRiceMiddleware')
const {
  uploadRiceHandler,
  obtenerRiceActivoHandler,
  consultarRiceHandler,
} = require('../controllers/riceController')

const router = Router()

// Subida de RICE (PDF o MD): Exclusivo para Administrador
router.post(
  '/upload',
  requireRole('Administrador'),
  uploadRiceMiddleware,
  uploadRiceHandler
)

// Consulta del estado del RICE activo del colegio: Todos los roles autenticados
router.get('/documento-activo', obtenerRiceActivoHandler)

// Consulta asistida por RAG (Chat / Recomendación normativa): Todos los roles autenticados
router.post('/consultar', consultarRiceHandler)

module.exports = router
