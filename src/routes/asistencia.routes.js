const { Router } = require('express')
const requireRole = require('../middlewares/requireRole')
const {
  registrarHandler,
  getCursoDiaHandler,
  getEstudianteResumenHandler,
  getAlertasHandler,
  justificarHandler
} = require('../controllers/asistenciaController')

const router = Router()

// Registro de asistencia - Inspector o Docente (sus cursos)
router.post('/registrar',
  requireRole('Administrador', 'Directivo', 'Inspector', 'Docente'),
  registrarHandler
)

// Consulta asistencia curso/día - todos los roles autenticados
router.get('/curso/:cursoId/fecha/:fecha', getCursoDiaHandler)

// Resumen asistencia estudiante - todos los roles
router.get('/estudiante/:id/resumen', getEstudianteResumenHandler)

// Alertas ausentismo - solo Administrador, Directivo, Inspector
router.get('/alertas',
  requireRole('Administrador', 'Directivo', 'Inspector'),
  getAlertasHandler
)

// Justificar ausencia - Administrador, Directivo, Inspector
router.patch('/:id/justificar',
  requireRole('Administrador', 'Directivo', 'Inspector'),
  justificarHandler
)

module.exports = router
