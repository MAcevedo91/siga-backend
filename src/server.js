require('dotenv').config()

// Must be first import - Initialize Sentry before anything else
const { initSentry } = require('./utils/sentry')
initSentry()

const http       = require('http')
const app        = require('./app')
const logger     = require('./utils/logger')
const { testConnection } = require('./utils/db')
const { initSocketServer } = require('./sockets')

// Initialize email worker
if (process.env.ENABLE_EMAIL_WORKER !== 'false') {
  require('./workers/emailWorker')
  logger.info('Email worker enabled')
}

const PORT = process.env.PORT || 3000
const SOCKET_PORT = process.env.SOCKET_PORT || 3001

const start = async () => {
  // Verificar conexión a Supabase antes de levantar el servidor
  await testConnection()

  // Create HTTP server for Express
  const httpServer = http.createServer(app)

  // Create separate HTTP server for Socket.io
  const socketHttpServer = http.createServer()
  initSocketServer(socketHttpServer)

  // Start both servers
  httpServer.listen(PORT, () => {
    logger.info('Server started', {
      port: PORT,
      environment: process.env.NODE_ENV,
      healthCheck: `http://localhost:${PORT}/api/v1/health`
    })
  })

  socketHttpServer.listen(SOCKET_PORT, () => {
    logger.info(`WebSocket server running on port ${SOCKET_PORT}`)
  })

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, closing servers gracefully')
    httpServer.close()
    socketHttpServer.close()
  })
}

start()
