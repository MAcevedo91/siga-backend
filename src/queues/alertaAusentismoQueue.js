const Queue = require('bull')
const logger = require('../utils/logger')

const alertaAusentismoQueue = new Queue('alerta-ausentismo', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000 // 2s, 4s, 8s
    },
    removeOnComplete: true,
    removeOnFail: false
  }
})

// Event listeners for monitoring
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
    error: err.message,
    attempts: job.attemptsMade
  })
})

alertaAusentismoQueue.on('stalled', (job) => {
  logger.warn('[AlertaAusentismo] Job stalled', {
    jobId: job.id,
    tenantId: job.data.tenantId
  })
})

module.exports = alertaAusentismoQueue
