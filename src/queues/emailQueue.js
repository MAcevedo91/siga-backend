const Queue = require('bull')
const logger = require('../utils/logger')

const emailQueue = new Queue('email', {
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
emailQueue.on('completed', (job) => {
  logger.info('Email job completed', {
    jobId: job.id,
    to: job.data.to,
    subject: job.data.subject
  })
})

emailQueue.on('failed', (job, err) => {
  logger.error('Email job failed', {
    jobId: job.id,
    to: job.data.to,
    subject: job.data.subject,
    error: err.message,
    attempts: job.attemptsMade
  })
})

emailQueue.on('stalled', (job) => {
  logger.warn('Email job stalled', {
    jobId: job.id,
    to: job.data.to
  })
})

module.exports = emailQueue
