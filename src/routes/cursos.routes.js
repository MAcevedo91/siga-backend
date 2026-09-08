const { Router } = require('express')
const {
  listarCursosHandler,
  obtenerNivelesHandler,
  obtenerLetrasHandler,
  obtenerEstudiantesCursoHandler,
} = require('../controllers/cursosController')

const router = Router()

// Endpoints jerárquicos para búsqueda en cascada (Nivel -> Letra -> Alumnos)
router.get('/niveles', obtenerNivelesHandler)
router.get('/letras', obtenerLetrasHandler)
router.get('/:id/estudiantes', obtenerEstudiantesCursoHandler)

// Listado general de cursos (compatibilidad hacia atrás)
router.get('/', listarCursosHandler)

module.exports = router
