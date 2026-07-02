const redisClient = require('../utils/redis')
const logger = require('../utils/logger')

/**
 * Cache middleware para rutas GET
 * @param {number} ttl - Time to live en segundos
 * @returns {Function} Express middleware
 */
function cacheMiddleware(ttl = 300) {
  return async (req, res, next) => {
    // Solo cachear GET requests
    if (req.method !== 'GET') {
      return next()
    }

    const cacheKey = `cache:${req.originalUrl}`

    try {
      const cachedData = await redisClient.get(cacheKey)

      if (cachedData) {
        logger.debug('Cache HIT', { requestId: req.id, key: cacheKey })
        return res.json(JSON.parse(cachedData))
      }

      logger.debug('Cache MISS', { requestId: req.id, key: cacheKey })

      // Store original json method
      const originalJson = res.json.bind(res)

      // Override json method to cache response
      res.json = (data) => {
        // Store cache key for later invalidation
        res.locals.cacheKey = cacheKey

        // Cache the response
        redisClient.setEx(cacheKey, ttl, JSON.stringify(data)).catch((err) => {
          logger.error('Redis setEx failed', { error: err.message, key: cacheKey })
        })

        return originalJson(data)
      }

      next()
    } catch (err) {
      logger.error('Cache middleware error', { error: err.message, requestId: req.id })
      // Continue without cache on error
      next()
    }
  }
}

module.exports = cacheMiddleware
