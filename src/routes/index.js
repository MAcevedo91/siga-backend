const { Router } = require('express')
const router = Router()

// =============================================================================
// RUTAS PRIVADAS — todas requieren token válido y tenant_id
// (authenticateToken y setTenantContext se aplican globalmente en app.js)
// =============================================================================

// --- Módulos (se agregan por sprint) ---
router.use('/usuarios',    require('./usuarios.routes'))
router.use('/estudiantes', require('./estudiantes.routes'))
router.use('/incidentes',  require('./incidentes.routes'))
// router.use('/incidentes', require('./incidentes.routes'))
// router.use('/protocolos', require('./protocolos.routes'))
// router.use('/dashboard',  require('./dashboard.routes'))

module.exports = router
