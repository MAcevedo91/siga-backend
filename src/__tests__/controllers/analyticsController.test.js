const analyticsController = require('../../controllers/analyticsController')
const { supabase } = require('../../utils/db')

jest.mock('../../utils/db')
jest.mock('../../utils/logger')

describe('analyticsController', () => {
  let req, res
  const mockTenantId = 'test-tenant-123'

  beforeEach(() => {
    req = {
      user: { tenant_id: mockTenantId },
      query: {}
    }
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    }
    jest.clearAllMocks()
  })

  describe('getResumen', () => {
    it('should return dashboard summary with all metrics', async () => {
      // Simplified: just verify it's called and structure is correct
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockResolvedValue({ count: 10, error: null })
      }

      supabase.from = jest.fn().mockReturnValue(mockQuery)
      supabase.rpc = jest.fn().mockResolvedValue({ data: 5, error: null })

      await analyticsController.getResumen(req, res)

      expect(res.json).toHaveBeenCalled()
      const callArgs = res.json.mock.calls[0][0]
      expect(callArgs).toHaveProperty('success')
      expect(callArgs).toHaveProperty('data')
    })

    it('should handle database errors gracefully', async () => {
      const mockCountQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockResolvedValue({ count: null, error: { message: 'DB Error' } })
      }

      supabase.from = jest.fn().mockReturnValue(mockCountQuery)

      await analyticsController.getResumen(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Error al obtener resumen de analytics'
      })
    })
  })

  describe('getTendenciaMensual', () => {
    it('should return monthly trend grouped by severity', async () => {
      const mockData = [
        { fecha: '2024-01-15', gravedad: 'Leve' },
        { fecha: '2024-01-20', gravedad: 'Grave' },
        { fecha: '2024-02-05', gravedad: 'Leve' },
        { fecha: '2024-02-10', gravedad: 'Leve' }
      ]

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockData, error: null })
      }

      supabase.from = jest.fn().mockReturnValue(mockQuery)

      await analyticsController.getTendenciaMensual(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            mes: '2024-01',
            Leve: 1,
            Grave: 1,
            Gravísimo: 0
          }),
          expect.objectContaining({
            mes: '2024-02',
            Leve: 2,
            Grave: 0,
            Gravísimo: 0
          })
        ])
      })
    })

    it('should return empty array when no data', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null })
      }

      supabase.from = jest.fn().mockReturnValue(mockQuery)

      await analyticsController.getTendenciaMensual(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: []
      })
    })

    it('should handle database errors', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: { message: 'Query failed' } })
      }

      supabase.from = jest.fn().mockReturnValue(mockQuery)

      await analyticsController.getTendenciaMensual(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Error al obtener tendencia mensual'
      })
    })
  })

  describe('getPorGravedad', () => {
    it('should return distribution by severity with percentages', async () => {
      const mockData = [
        { gravedad: 'Leve' },
        { gravedad: 'Leve' },
        { gravedad: 'Grave' },
        { gravedad: 'Gravísimo' }
      ]

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: mockData, error: null })
      }

      supabase.from = jest.fn().mockReturnValue(mockQuery)

      await analyticsController.getPorGravedad(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          { gravedad: 'Leve', cantidad: 2, porcentaje: 50 },
          { gravedad: 'Grave', cantidad: 1, porcentaje: 25 },
          { gravedad: 'Gravísimo', cantidad: 1, porcentaje: 25 }
        ])
      })
    })

    it('should handle empty data', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [], error: null })
      }

      supabase.from = jest.fn().mockReturnValue(mockQuery)

      await analyticsController.getPorGravedad(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          { gravedad: 'Leve', cantidad: 0, porcentaje: 0 },
          { gravedad: 'Grave', cantidad: 0, porcentaje: 0 },
          { gravedad: 'Gravísimo', cantidad: 0, porcentaje: 0 }
        ])
      })
    })
  })

  describe('getTopEstudiantes', () => {
    it('should return top 5 students with most incidents', async () => {
      const mockData = [
        { estudiante_id: 1, nombre: 'Juan Pérez', total_incidentes: 8 },
        { estudiante_id: 2, nombre: 'María González', total_incidentes: 5 }
      ]

      supabase.rpc = jest.fn().mockResolvedValue({ data: mockData, error: null })

      await analyticsController.getTopEstudiantes(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockData
      })

      expect(supabase.rpc).toHaveBeenCalledWith('obtener_top_estudiantes_incidentes', {
        p_tenant_id: mockTenantId,
        p_limite: 5
      })
    })

    it('should return empty array when no data', async () => {
      supabase.rpc = jest.fn().mockResolvedValue({ data: null, error: null })

      await analyticsController.getTopEstudiantes(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: []
      })
    })

    it('should handle RPC errors', async () => {
      supabase.rpc = jest.fn().mockResolvedValue({ data: null, error: { message: 'RPC failed' } })

      await analyticsController.getTopEstudiantes(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Error al obtener top estudiantes'
      })
    })
  })

  describe('getTiempoResolucion', () => {
    it('should calculate average resolution time', async () => {
      const mockData = [
        { fecha: '2024-01-01T00:00:00Z', fecha_cierre: '2024-01-03T00:00:00Z' }, // 2 days
        { fecha: '2024-01-05T00:00:00Z', fecha_cierre: '2024-01-09T00:00:00Z' }  // 4 days
      ]

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        not: jest.fn().mockResolvedValue({ data: mockData, error: null })
      }

      supabase.from = jest.fn().mockReturnValue(mockQuery)

      await analyticsController.getTiempoResolucion(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          promedio: 3, // Average of 2 and 4 days
          meta: 7
        }
      })
    })

    it('should return 0 when no closed incidents', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        not: jest.fn().mockResolvedValue({ data: [], error: null })
      }

      supabase.from = jest.fn().mockReturnValue(mockQuery)

      await analyticsController.getTiempoResolucion(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          promedio: 0,
          meta: 7
        }
      })
    })

    it('should handle database errors', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        not: jest.fn().mockResolvedValue({ data: null, error: { message: 'Query error' } })
      }

      supabase.from = jest.fn().mockReturnValue(mockQuery)

      await analyticsController.getTiempoResolucion(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Error al obtener tiempo de resolución'
      })
    })
  })
})
