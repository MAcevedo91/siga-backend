const { Router } = require('express')
const router = Router()

// =============================================================================
// V1 RUTAS PRIVADAS — todas requieren token válido y tenant_id
// (authenticateToken y setTenantContext se aplican globalmente en app.js)
// =============================================================================

// Import existing route modules (private routes)
router.use('/usuarios',    require('../usuarios.routes'))
router.use('/estudiantes', require('../estudiantes.routes'))
router.use('/incidentes',  require('../incidentes.routes'))
router.use('/protocolos',  require('../protocolos.routes'))
router.use('/dashboard',   require('../dashboard.routes'))
router.use('/riesgo',      require('../riesgo'))
router.use('/reportes',    require('../reportes'))

// Additional v1 routes that were mounted separately in app.js
// These are now consolidated here for consistency
// Note: notificaciones, analytics, search are mounted separately in app.js
// because they need to be before authenticateToken middleware

module.exports = router
