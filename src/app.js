const express = require('express')
const cors    = require('cors')
const helmet  = require('helmet')

const routes  = require('./routes')

const app = express()

// =============================================================================
// MIDDLEWARES DE SEGURIDAD
// =============================================================================

// Helmet agrega headers de seguridad automáticamente:
// X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security, etc.
app.use(helmet())

// CORS — solo acepta orígenes explícitamente listados
const ALLOWED_ORIGINS = [
  'http://localhost:5173', // Vite dev server (frontend)
  'http://localhost:4173', // Vite preview
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

// Parseo de JSON en el body de los requests
app.use(express.json())

// =============================================================================
// RUTAS
// =============================================================================
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
  console.error('[ERROR]', err)

  res.status(err.statusCode || 500).json({
    status: 'error',
    message: err.message || 'Error interno del servidor',
    statusCode: err.statusCode || 500,
  })
})

module.exports = app
