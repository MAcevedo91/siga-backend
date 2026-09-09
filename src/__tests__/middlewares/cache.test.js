const cacheMiddleware = require('../../middlewares/cache')
const redisClient = require('../../utils/redis')

jest.mock('../../utils/redis')
jest.mock('../../utils/logger')

describe('cache middleware', () => {
  let req, res, next

  beforeEach(() => {
    req = {
      method: 'GET',
      originalUrl: '/api/estudiantes',
      user: { tenant_id: 'test-tenant' },
      id: 'request-123'
    }
    res = {
      json: jest.fn(),
      locals: {}
    }
    next = jest.fn()
    jest.clearAllMocks()
  })

  describe('GET requests', () => {
    it('should return cached data if exists', async () => {
      const cachedData = JSON.stringify({ data: 'cached', students: ['Juan', 'María'] })
      redisClient.get.mockResolvedValue(cachedData)

      const middleware = cacheMiddleware(300)
      await middleware(req, res, next)

      expect(redisClient.get).toHaveBeenCalledWith('cache:test-tenant:/api/estudiantes')
      expect(res.json).toHaveBeenCalledWith({ data: 'cached', students: ['Juan', 'María'] })
      expect(next).not.toHaveBeenCalled()
    })

    it('should call next if no cache exists', async () => {
      redisClient.get.mockResolvedValue(null)

      const middleware = cacheMiddleware(300)
      await middleware(req, res, next)

      expect(redisClient.get).toHaveBeenCalledWith('cache:test-tenant:/api/estudiantes')
      expect(next).toHaveBeenCalled()
      // res.json is overridden but not called by the test
    })

    it('should store cache key in res.locals when caching response', async () => {
      redisClient.get.mockResolvedValue(null)
      redisClient.setEx.mockResolvedValue('OK')

      const middleware = cacheMiddleware(300)
      await middleware(req, res, next)

      // Simulate the controller calling res.json
      const responseData = { success: true, data: ['test'] }
      res.json(responseData)

      expect(res.locals.cacheKey).toBe('cache:test-tenant:/api/estudiantes')
    })

    it('should cache response data with correct TTL', async () => {
      redisClient.get.mockResolvedValue(null)
      redisClient.setEx.mockResolvedValue('OK')

      const ttl = 600
      const middleware = cacheMiddleware(ttl)
      await middleware(req, res, next)

      // Simulate the controller calling res.json
      const responseData = { success: true, data: ['test'] }
      res.json(responseData)

      // Wait for async cache operation
      await new Promise(resolve => setImmediate(resolve))

      expect(redisClient.setEx).toHaveBeenCalledWith(
        'cache:test-tenant:/api/estudiantes',
        ttl,
        JSON.stringify(responseData)
      )
    })

    it('should use default TTL of 300 seconds', async () => {
      redisClient.get.mockResolvedValue(null)
      redisClient.setEx.mockResolvedValue('OK')

      const middleware = cacheMiddleware() // No TTL parameter
      await middleware(req, res, next)

      // Simulate the controller calling res.json
      res.json({ data: 'test' })

      await new Promise(resolve => setImmediate(resolve))

      expect(redisClient.setEx).toHaveBeenCalledWith(
        expect.any(String),
        300,
        expect.any(String)
      )
    })

    it('should handle redis get errors gracefully', async () => {
      redisClient.get.mockRejectedValue(new Error('Redis connection failed'))

      const middleware = cacheMiddleware(300)
      await middleware(req, res, next)

      // Should continue without cache on error
      expect(next).toHaveBeenCalled()
      expect(res.json).not.toHaveBeenCalled()
    })

    it('should handle redis setEx errors gracefully', async () => {
      redisClient.get.mockResolvedValue(null)
      redisClient.setEx.mockRejectedValue(new Error('Redis write failed'))

      const middleware = cacheMiddleware(300)
      await middleware(req, res, next)

      // Simulate the controller calling res.json
      const responseData = { success: true }
      res.json(responseData)

      // Should not throw error even if caching fails
      expect(res.json).toBeDefined()
    })

    it('should generate unique cache keys for different URLs', async () => {
      redisClient.get.mockResolvedValue(null)

      const middleware = cacheMiddleware(300)

      req.originalUrl = '/api/estudiantes?curso=1'
      await middleware(req, res, next)

      expect(redisClient.get).toHaveBeenCalledWith('cache:test-tenant:/api/estudiantes?curso=1')
    })

    it('should generate unique cache keys for different tenants', async () => {
      redisClient.get.mockResolvedValue(null)

      const middleware = cacheMiddleware(300)

      req.user.tenant_id = 'tenant-abc'
      await middleware(req, res, next)

      expect(redisClient.get).toHaveBeenCalledWith('cache:tenant-abc:/api/estudiantes')
    })
  })

  describe('non-GET requests', () => {
    it('should skip caching for POST requests', async () => {
      req.method = 'POST'

      const middleware = cacheMiddleware(300)
      await middleware(req, res, next)

      expect(redisClient.get).not.toHaveBeenCalled()
      expect(next).toHaveBeenCalled()
      expect(res.json).not.toHaveBeenCalled()
    })

    it('should skip caching for PUT requests', async () => {
      req.method = 'PUT'

      const middleware = cacheMiddleware(300)
      await middleware(req, res, next)

      expect(redisClient.get).not.toHaveBeenCalled()
      expect(next).toHaveBeenCalled()
    })

    it('should skip caching for DELETE requests', async () => {
      req.method = 'DELETE'

      const middleware = cacheMiddleware(300)
      await middleware(req, res, next)

      expect(redisClient.get).not.toHaveBeenCalled()
      expect(next).toHaveBeenCalled()
    })

    it('should skip caching for PATCH requests', async () => {
      req.method = 'PATCH'

      const middleware = cacheMiddleware(300)
      await middleware(req, res, next)

      expect(redisClient.get).not.toHaveBeenCalled()
      expect(next).toHaveBeenCalled()
    })
  })

  describe('cache invalidation', () => {
    it('should override res.json to cache future responses', async () => {
      redisClient.get.mockResolvedValue(null)
      redisClient.setEx.mockResolvedValue('OK')

      const originalJsonType = typeof res.json

      const middleware = cacheMiddleware(300)
      await middleware(req, res, next)

      // res.json should still be a function
      expect(typeof res.json).toBe(originalJsonType)

      // Call the overridden json method
      const responseData = { success: true, data: [] }
      res.json(responseData)

      expect(res.locals.cacheKey).toBe('cache:test-tenant:/api/estudiantes')
    })

    it('should preserve original json method behavior', async () => {
      redisClient.get.mockResolvedValue(null)
      redisClient.setEx.mockResolvedValue('OK')

      const originalJsonMock = jest.fn()
      res.json = originalJsonMock

      const middleware = cacheMiddleware(300)
      await middleware(req, res, next)

      const responseData = { success: true }
      res.json(responseData)

      // The original json method should have been called
      expect(originalJsonMock).toHaveBeenCalledWith(responseData)
    })
  })
})
