const cacheMiddleware = require('../../../src/middlewares/cache')
const redisClient = require('../../../src/utils/redis')

jest.mock('../../../src/utils/redis', () => ({
  get: jest.fn(),
  setEx: jest.fn()
}))

describe('cacheMiddleware', () => {
  let req, res, next

  beforeEach(() => {
    jest.clearAllMocks()
    req = {
      method: 'GET',
      originalUrl: '/api/v1/estudiantes',
      id: 'test-id',
      user: { tenant_id: 'test-tenant-123' }
    }
    res = {
      locals: {},
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    }
    next = jest.fn()
  })

  it('debe llamar a next() si no es GET', async () => {
    req.method = 'POST'
    const middleware = cacheMiddleware(300)

    await middleware(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(redisClient.get).not.toHaveBeenCalled()
  })

  it('debe retornar cached data si existe', async () => {
    const cachedData = JSON.stringify({ data: 'cached' })
    redisClient.get.mockResolvedValue(cachedData)

    const middleware = cacheMiddleware(300)
    await middleware(req, res, next)

    expect(redisClient.get).toHaveBeenCalledWith('cache:test-tenant-123:/api/v1/estudiantes')
    expect(res.json).toHaveBeenCalledWith({ data: 'cached' })
    expect(next).not.toHaveBeenCalled()
  })

  it('debe llamar a next() si no hay cache', async () => {
    redisClient.get.mockResolvedValue(null)

    const middleware = cacheMiddleware(300)
    await middleware(req, res, next)

    expect(redisClient.get).toHaveBeenCalledWith('cache:test-tenant-123:/api/v1/estudiantes')
    expect(next).toHaveBeenCalled()
  })

  it('debe sobrescribir res.json para cachear la respuesta', async () => {
    redisClient.get.mockResolvedValue(null)
    redisClient.setEx.mockResolvedValue('OK')

    const middleware = cacheMiddleware(300)
    await middleware(req, res, next)

    expect(next).toHaveBeenCalled()

    // Simulate calling res.json after next()
    const testData = { result: 'test' }
    res.json(testData)

    expect(redisClient.setEx).toHaveBeenCalledWith(
      'cache:test-tenant-123:/api/v1/estudiantes',
      300,
      JSON.stringify(testData)
    )
  })

  it('debe almacenar cacheKey en res.locals', async () => {
    redisClient.get.mockResolvedValue(null)

    const middleware = cacheMiddleware(300)
    await middleware(req, res, next)

    // Simulate calling res.json
    res.json({ test: 'data' })

    expect(res.locals.cacheKey).toBe('cache:test-tenant-123:/api/v1/estudiantes')
  })

  it('debe continuar si Redis falla', async () => {
    redisClient.get.mockRejectedValue(new Error('Redis error'))

    const middleware = cacheMiddleware(300)
    await middleware(req, res, next)

    expect(next).toHaveBeenCalled()
  })

  it('debe usar TTL personalizado', async () => {
    redisClient.get.mockResolvedValue(null)
    redisClient.setEx.mockResolvedValue('OK')

    const middleware = cacheMiddleware(600) // 10 minutes
    await middleware(req, res, next)

    // Simulate calling res.json
    res.json({ test: 'data' })

    expect(redisClient.setEx).toHaveBeenCalledWith(
      'cache:test-tenant-123:/api/v1/estudiantes',
      600,
      JSON.stringify({ test: 'data' })
    )
  })
})
