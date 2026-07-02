jest.mock('../../../src/utils/db', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn()
  }
}))

const { supabase } = require('../../../src/utils/db')
const analyticsController = require('../../../src/controllers/analyticsController')

describe('Analytics Controller', () => {
  let req, res

  beforeEach(() => {
    req = {
      user: { id: 1, tenant_id: 'tenant-123' },
      query: {}
    }
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('getResumen', () => {
    it('debe retornar resumen de incidentes del mes', async () => {
      // Create separate chains for each query
      const mockChain1 = {
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockResolvedValue({ count: 42, error: null })
      }

      const mockChain2 = {
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockResolvedValue({ count: 30, error: null })
      }

      const mockChain3 = {
        eq: jest.fn().mockReturnThis()
      }
      // Second eq() call returns the final promise
      mockChain3.eq.mockReturnValueOnce(mockChain3).mockResolvedValueOnce({ count: 10, error: null })

      supabase.from
        .mockReturnValueOnce({ select: jest.fn().mockReturnValue(mockChain1) })  // totalIncidentes
        .mockReturnValueOnce({ select: jest.fn().mockReturnValue(mockChain2) })  // totalPrevMonth
        .mockReturnValueOnce({ select: jest.fn().mockReturnValue(mockChain3) })  // abiertos

      // Mock RPC for estudiantes riesgo
      supabase.rpc.mockResolvedValue({ data: 5, error: null })

      await analyticsController.getResumen(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          totalIncidentes: expect.any(Number),
          variacion: expect.any(Number),
          abiertos: expect.any(Number),
          estudiantesRiesgo: expect.any(Number)
        })
      })
    })

    it('debe manejar errores correctamente', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockRejectedValue(new Error('DB error'))
      }

      supabase.from.mockReturnValue(mockChain)

      await analyticsController.getResumen(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Error al obtener resumen de analytics'
      })
    })
  })
})
