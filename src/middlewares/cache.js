const redisClient = require('../utils/redis')
const logger = require('../utils/logger')

/**
 * Cache middleware para rutas GET
 * @param {number} ttl - Time to live en segundos
 * @returns {Function} Express middleware
 */
function buildNormalizedCacheKey(req) {
  const [pathname, rawQuery] = (req.originalUrl || '').split('?')
  if (!rawQuery) {
    return `cache:${req.user.tenant_id}:${pathname}`
  }
  const params = new URLSearchParams(rawQuery)
  params.delete('refresh')
  const cleanQuery = params.toString()
  return `cache:${req.user.tenant_id}:${cleanQuery ? `${pathname}?${cleanQuery}` : pathname}`
}

function cacheMiddleware(ttl = 300) {
  return async (req, res, next) => {
    // Solo cachear GET requests
    if (req.method !== 'GET') {
      return next()
    }

    const forceRefresh = req.query?.refresh === 'true'
    const cacheKey = buildNormalizedCacheKey(req)

    try {
      if (!forceRefresh) {
        const cachedData = await redisClient.get(cacheKey)

        if (cachedData) {
          logger.debug('Cache HIT', { requestId: req.id, key: cacheKey })
          return res.json(JSON.parse(cachedData))
        }
      }

      logger.debug(forceRefresh ? 'Cache REFRESH' : 'Cache MISS', { requestId: req.id, key: cacheKey })

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
