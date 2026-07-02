const express = require('express')
const cors    = require('cors')

// Infrastructure middlewares
const requestIdMiddleware = require('./middlewares/requestId')
const loggingMiddleware   = require('./middlewares/logging')
const securityMiddleware  = require('./middlewares/security')
const { generalLimiter }  = require('./middlewares/rateLimiter')

// Application middlewares
const routes           = require('./routes')
const auditLogger      = require('./middlewares/auditLogger')
const authenticateToken = require('./middlewares/authenticateToken')
const setTenantContext  = require('./middlewares/setTenantContext')

const app = express()

// =============================================================================
// INFRASTRUCTURE MIDDLEWARE CHAIN
// Order is critical: requestId → logging → security → CORS → rate limiting
// =============================================================================

// 1. Request ID (must be first to add req.id for all subsequent middlewares)
app.use(requestIdMiddleware)

// 2. HTTP Request/Response Logging (uses req.id)
app.use(loggingMiddleware)

// 3. Security headers (Helmet + custom)
// Replaces standalone helmet() call with security middleware that includes helmet
app.use(securityMiddleware)

// 4. CORS — solo acepta orígenes explícitamente listados
const ALLOWED_ORIGINS = [
  'http://localhost:5173',                          // Vite dev server (frontend)
  'http://localhost:4173',                          // Vite preview
  'https://siga-frontend-delta-six.vercel.app',    // Producción Vercel
]

app.use(cors({
  origin: (origin, callback) => {
    // Permite requests sin origin (Postman, curl, server-to-server)
    if (!origin) return callback(null, true)

    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error(`CORS: origen no permitido → ${origin}`))
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))

// 5. General rate limiter (applies to all routes)
app.use(generalLimiter)

// =============================================================================
// BODY PARSERS
// =============================================================================

// Parseo de JSON en el body de los requests
app.use(express.json())

// Auditoría — debe ir después de express.json() para leer el body
// y después de las rutas lo captura via res.json()
app.use(auditLogger)

// =============================================================================
// RUTAS PÚBLICAS (sin autenticación)
// =============================================================================
app.use('/api/v1/auth', require('./routes/auth.routes'))
app.use('/api/v1/health', (req, res) => res.status(200).json({
  status: 'success',
  message: 'Servidor operativo',
  data: { timestamp: new Date().toISOString() },
}))

// =============================================================================
// MIDDLEWARES GLOBALES PARA RUTAS PRIVADAS
// Todas las rutas debajo de este punto requieren token válido y tenant_id
// =============================================================================
app.use(authenticateToken)
app.use(setTenantContext)

// =============================================================================
// RUTAS PRIVADAS
// =============================================================================
// Notificaciones routes (authenticated)
app.use('/api/v1/notificaciones', require('./routes/notificaciones.routes'))

app.use('/api/v1', routes)

// =============================================================================
// MANEJO GLOBAL DE ERRORES
// =============================================================================

// 404 — ruta no encontrada
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
    statusCode: 404,
  })
})

// Error genérico (debe tener 4 parámetros para que Express lo reconozca como error handler)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Error de CORS
  if (err.message && err.message.startsWith('CORS')) {
    return res.status(403).json({
      status: 'error',
      message: 'Origen no autorizado',
      statusCode: 403,
    })
  }

  // Log interno (nunca exponer al cliente)
  const logger = require('./utils/logger')
  logger.error('[ERROR]', err)

  res.status(err.statusCode || 500).json({
    status: 'error',
    message: err.message || 'Error interno del servidor',
    statusCode: err.statusCode || 500,
  })
})

module.exports = app
