const express = require('express')
const router = express.Router()
const analyticsController = require('../controllers/analyticsController')
const cacheMiddleware = require('../middlewares/cache')

// GET /api/v1/analytics/resumen - Resumen general (cache 5min)
router.get('/resumen', cacheMiddleware(300), analyticsController.getResumen)

// GET /api/v1/analytics/tendencia-mensual - Tendencia últimos 12 meses (cache 5min)
router.get('/tendencia-mensual', cacheMiddleware(300), analyticsController.getTendenciaMensual)

// GET /api/v1/analytics/por-gravedad - Distribución por gravedad (cache 5min)
router.get('/por-gravedad', cacheMiddleware(300), analyticsController.getPorGravedad)

// GET /api/v1/analytics/top-estudiantes - Top 5 estudiantes (cache 5min)
router.get('/top-estudiantes', cacheMiddleware(300), analyticsController.getTopEstudiantes)

// GET /api/v1/analytics/tiempo-resolucion - Tiempo promedio resolución (cache 5min)
router.get('/tiempo-resolucion', cacheMiddleware(300), analyticsController.getTiempoResolucion)

// GET /api/v1/analytics/mapa-calor-cursos - Matriz agregada Curso vs Mes escolar (cache 3min)
router.get('/mapa-calor-cursos', cacheMiddleware(180), analyticsController.getMapaCalorCursos)

// GET /api/v1/analytics/mapa-calor-cursos/detalle - Diagnóstico pedagógico anónimo de celda (cache 3min)
router.get('/mapa-calor-cursos/detalle', cacheMiddleware(180), analyticsController.getDetalleCeldaMapaCalor)

module.exports = router
