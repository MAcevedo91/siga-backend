const { Router } = require('express')
const requireRole = require('../middlewares/requireRole')
const cacheMiddleware = require('../middlewares/cache')
const {
  resumenHandler,
  porCursoHandler,
  porGravedadHandler,
  tendenciaMensualHandler,
} = require('../controllers/dashboardController')

const router = Router()

// Solo Administrador, Equipo de Formación y Directivo
router.use(requireRole('Administrador', 'Equipo de Formación', 'Directivo'))

// Cache dashboard con TTL 5min (300s)
router.get('/resumen',            cacheMiddleware(300), resumenHandler)
router.get('/incidentes-por-curso', cacheMiddleware(300), porCursoHandler)
router.get('/por-gravedad',       cacheMiddleware(300), porGravedadHandler)
router.get('/tendencia-mensual',  cacheMiddleware(300), tendenciaMensualHandler)

module.exports = router
