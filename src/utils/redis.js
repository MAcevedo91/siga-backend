const redis = require('redis')
const logger = require('./logger')

const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        logger.error('Redis reconnection failed after 10 attempts')
        return new Error('Redis reconnection failed')
      }
      return Math.min(retries * 100, 3000)
    }
  }
})

redisClient.on('error', (err) => {
  logger.error('Redis Client Error', { error: err.message })
})

redisClient.on('connect', () => {
  logger.info('Redis Client Connected')
})

redisClient.on('reconnecting', () => {
  logger.warn('Redis Client Reconnecting')
})

// Connect to Redis (async init)
if (process.env.NODE_ENV !== 'test') {
  redisClient.connect().catch((err) => {
    logger.error('Failed to connect to Redis', { error: err.message })
  })
}

module.exports = redisClient
