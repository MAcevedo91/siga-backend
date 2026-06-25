const { Router } = require('express')
const requireRole = require('../middlewares/requireRole')
const {
  resumenHandler,
  porCursoHandler,
  porGravedadHandler,
  tendenciaMensualHandler,
} = require('../controllers/dashboardController')

const router = Router()

// Solo Administrador, Equipo de Formación y Directivo
router.use(requireRole('Administrador', 'Equipo de Formación', 'Directivo'))

router.get('/resumen',            resumenHandler)
router.get('/incidentes-por-curso', porCursoHandler)
router.get('/por-gravedad',       porGravedadHandler)
router.get('/tendencia-mensual',  tendenciaMensualHandler)

module.exports = router
