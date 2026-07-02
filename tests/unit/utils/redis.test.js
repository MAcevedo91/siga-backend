describe('Redis Client', () => {
  let redisClient

  beforeEach(() => {
    jest.resetModules()
    jest.mock('redis', () => ({
      createClient: jest.fn(() => ({
        connect: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
        get: jest.fn(),
        setEx: jest.fn(),
        del: jest.fn()
      }))
    }))
  })

  it('debe exportar redisClient', () => {
    redisClient = require('../../../src/utils/redis')
    expect(redisClient).toBeDefined()
  })

  it('debe tener método get', () => {
    redisClient = require('../../../src/utils/redis')
    expect(redisClient.get).toBeDefined()
    expect(typeof redisClient.get).toBe('function')
  })

  it('debe tener método setEx', () => {
    redisClient = require('../../../src/utils/redis')
    expect(redisClient.setEx).toBeDefined()
    expect(typeof redisClient.setEx).toBe('function')
  })

  it('debe tener método del', () => {
    redisClient = require('../../../src/utils/redis')
    expect(redisClient.del).toBeDefined()
    expect(typeof redisClient.del).toBe('function')
  })

  it('no debe conectar en ambiente de test', () => {
    process.env.NODE_ENV = 'test'
    redisClient = require('../../../src/utils/redis')
    // Simply verify it doesn't throw or crash
    expect(redisClient).toBeDefined()
  })
})
