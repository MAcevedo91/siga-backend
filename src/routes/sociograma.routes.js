const { Router } = require('express')
const requireRole = require('../middlewares/requireRole')
const {
  obtenerSociogramaCursoHandler,
} = require('../controllers/sociogramaController')

const router = Router()

// =============================================================================
// RUTAS DEL MÓDULO DE SOCIOGRAMA Y REDES DE CONVIVENCIA (SPRINT 8 / ÉPICA 8.1)
// =============================================================================

// GET /api/sociograma/curso/:cursoId
// GET /api/v1/sociograma/curso/:cursoId
// Retorna la matriz de adyacencia ponderada y topología de red para el curso
router.get(
  '/curso/:cursoId',
  requireRole('Administrador', 'Directivo', 'Equipo de Formación', 'Inspector', 'Docente'),
  obtenerSociogramaCursoHandler
)

module.exports = router
