const Queue = require('bull')
const logger = require('../utils/logger')

const mensajeOfflineQueue = new Queue('mensaje-offline', {
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
mensajeOfflineQueue.on('completed', (job, result) => {
  logger.info('[MensajeOffline] Job completed', {
    jobId: job.id,
    userId: job.data.userId,
    result
  })
})

mensajeOfflineQueue.on('failed', (job, err) => {
  logger.error('[MensajeOffline] Job failed', {
    jobId: job.id,
    userId: job.data.userId,
    error: err.message,
    attempts: job.attemptsMade
  })
})

mensajeOfflineQueue.on('stalled', (job) => {
  logger.warn('[MensajeOffline] Job stalled', {
    jobId: job.id,
    userId: job.data.userId
  })
})

module.exports = mensajeOfflineQueue
