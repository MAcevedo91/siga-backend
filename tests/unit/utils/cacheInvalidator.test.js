const { invalidateCache, invalidateEstudiantes, invalidateIncidentes, invalidateDashboard } = require('../../../src/utils/cacheInvalidator')
const redisClient = require('../../../src/utils/redis')

jest.mock('../../../src/utils/redis', () => ({
  keys: jest.fn(),
  del: jest.fn()
}))

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn()
}))

describe('Cache Invalidator', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('invalidateCache', () => {
    it('debe eliminar keys que coincidan con patterns', async () => {
      redisClient.keys.mockResolvedValue(['cache:key1', 'cache:key2'])
      redisClient.del.mockResolvedValue(2)

      const result = await invalidateCache(['cache:*'])

      expect(redisClient.keys).toHaveBeenCalledWith('cache:*')
      expect(redisClient.del).toHaveBeenCalledWith(['cache:key1', 'cache:key2'])
      expect(result).toBe(2)
    })

    it('debe retornar 0 cuando no hay keys que eliminar', async () => {
      redisClient.keys.mockResolvedValue([])
      redisClient.del.mockResolvedValue(0)

      const result = await invalidateCache(['cache:*'])

      expect(redisClient.keys).toHaveBeenCalledWith('cache:*')
      expect(redisClient.del).not.toHaveBeenCalled()
      expect(result).toBe(0)
    })

    it('debe procesar múltiples patterns', async () => {
      redisClient.keys.mockResolvedValueOnce(['cache:key1', 'cache:key2'])
      redisClient.keys.mockResolvedValueOnce(['dashboard:key1'])
      redisClient.del.mockResolvedValue(3)

      const result = await invalidateCache(['cache:*', 'dashboard:*'])

      expect(redisClient.keys).toHaveBeenCalledTimes(2)
      expect(redisClient.keys).toHaveBeenNthCalledWith(1, 'cache:*')
      expect(redisClient.keys).toHaveBeenNthCalledWith(2, 'dashboard:*')
      expect(redisClient.del).toHaveBeenCalledWith(['cache:key1', 'cache:key2', 'dashboard:key1'])
      expect(result).toBe(3)
    })

    it('debe manejar errores y retornar 0', async () => {
      const logger = require('../../../src/utils/logger')
      redisClient.keys.mockRejectedValue(new Error('Redis error'))

      const result = await invalidateCache(['cache:*'])

      expect(logger.error).toHaveBeenCalled()
      expect(result).toBe(0)
    })
  })

  describe('invalidateEstudiantes', () => {
    it('debe invalidar estudiantes y dashboard', async () => {
      redisClient.keys.mockResolvedValueOnce([])
      redisClient.keys.mockResolvedValueOnce([])

      await invalidateEstudiantes('tenant-123')

      expect(redisClient.keys).toHaveBeenCalledWith('cache:tenant-123:/api/v1/estudiantes*')
      expect(redisClient.keys).toHaveBeenCalledWith('cache:tenant-123:/api/v1/dashboard*')
    })
  })

  describe('invalidateIncidentes', () => {
    it('debe invalidar incidentes y dashboard', async () => {
      redisClient.keys.mockResolvedValueOnce([])
      redisClient.keys.mockResolvedValueOnce([])

      await invalidateIncidentes('tenant-123')

      expect(redisClient.keys).toHaveBeenCalledWith('cache:tenant-123:/api/v1/incidentes*')
      expect(redisClient.keys).toHaveBeenCalledWith('cache:tenant-123:/api/v1/dashboard*')
    })
  })

  describe('invalidateDashboard', () => {
    it('debe invalidar solo dashboard', async () => {
      redisClient.keys.mockResolvedValueOnce([])

      await invalidateDashboard('tenant-123')

      expect(redisClient.keys).toHaveBeenCalledWith('cache:tenant-123:/api/v1/dashboard*')
      expect(redisClient.keys).toHaveBeenCalledTimes(1)
    })
  })
})
