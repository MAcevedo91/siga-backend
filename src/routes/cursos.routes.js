const { Router } = require('express')
const requireRole = require('../middlewares/requireRole')
const {
  listarCursosHandler,
  obtenerNivelesHandler,
  obtenerLetrasHandler,
  obtenerEstudiantesCursoHandler,
  asignarProfesorJefeHandler,
} = require('../controllers/cursosController')

const router = Router()

// Asignar o desasignar profesor jefe (solo Administrador y Equipo de Formación)
router.patch('/:id/profesor-jefe',
  requireRole('Administrador', 'Equipo de Formación'),
  asignarProfesorJefeHandler
)

// Endpoints jerárquicos para búsqueda en cascada (Nivel -> Letra -> Alumnos)
router.get('/niveles', obtenerNivelesHandler)
router.get('/letras', obtenerLetrasHandler)
router.get('/:id/estudiantes', obtenerEstudiantesCursoHandler)

// Listado general de cursos (compatibilidad hacia atrás)
router.get('/', listarCursosHandler)

module.exports = router
