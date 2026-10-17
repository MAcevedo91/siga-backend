const { Router } = require('express')
const requireRole = require('../middlewares/requireRole')
const {
  obtenerEstadoActualHandler,
  generarPropuestaHandler,
  ejecutarCierreHandler,
} = require('../controllers/cierreAnioController')

const router = Router()

// Permisos según definición de Escuela Coeducacional N° 1 El Salvador:
// Administrador, Inspectoría General y Equipo Directivo
router.use(requireRole('Administrador', 'Inspector', 'Equipo de Formación', 'Directivo'))

// GET /api/v1/cierre-anio/estado-actual
router.get('/estado-actual', obtenerEstadoActualHandler)

// GET /api/v1/cierre-anio/propuesta
router.get('/propuesta', generarPropuestaHandler)

// POST /api/v1/cierre-anio/ejecutar
router.post('/ejecutar', ejecutarCierreHandler)

module.exports = router
