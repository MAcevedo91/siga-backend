require('dotenv').config()

// Must be first import - Initialize Sentry before anything else
const { initSentry } = require('./utils/sentry')
initSentry()

const http       = require('http')
const app        = require('./app')
const logger     = require('./utils/logger')
const { testConnection, supabase } = require('./utils/db')
const { initSocketServer } = require('./sockets')
const Queue = require('bull')
const cron = require('node-cron')
const { procesarAlertaAusentismo } = require('./jobs/alertaAusentismoJob')

// Initialize email worker
if (process.env.ENABLE_EMAIL_WORKER !== 'false') {
  require('./workers/emailWorker')
  logger.info('Email worker enabled')
}

// Initialize alerta ausentismo queue
const alertaAusentismoQueue = new Queue('alerta-ausentismo', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  }
})

// Process alerta ausentismo queue
alertaAusentismoQueue.process(async (job) => {
  return await procesarAlertaAusentismo(job)
})

// Event listeners
alertaAusentismoQueue.on('completed', (job, result) => {
  logger.info('[AlertaAusentismo] Job completed', {
    jobId: job.id,
    tenantId: job.data.tenantId,
    result
  })
})

alertaAusentismoQueue.on('failed', (job, err) => {
  logger.error('[AlertaAusentismo] Job failed', {
    jobId: job.id,
    tenantId: job.data.tenantId,
    error: err.message
  })
})

// Schedule daily at 9 AM for all tenants
cron.schedule('0 9 * * *', async () => {
  logger.info('[Cron] Iniciando alerta de ausentismo diaria')

  try {
    // Get all tenants
    const { data: tenants, error } = await supabase
      .from('tenants')
      .select('id')

    if (error) {
      logger.error('[Cron] Error obteniendo tenants:', error)
      return
    }

    // Enqueue job for each tenant
    for (const tenant of tenants) {
      await alertaAusentismoQueue.add(
        { tenantId: tenant.id },
        { priority: 2 } // Priority: Alta
      )
    }

    logger.info(`[Cron] ${tenants.length} jobs de alerta de ausentismo encolados`)
  } catch (error) {
    logger.error('[Cron] Error en cron de ausentismo:', error)
  }
})

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
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, closing servers gracefully')
    httpServer.close()
    socketHttpServer.close()
    await alertaAusentismoQueue.close()
  })
}

start()
