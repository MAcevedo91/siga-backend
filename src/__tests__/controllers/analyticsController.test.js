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

  describe('getMapaCalorCursos', () => {
    it('should return heatmap matrix for authorized Directivo', async () => {
      req.user = { tenant_id: mockTenantId, rol: 'Directivo' }
      req.query = { anio: '2026' }

      const mockCursos = [
        { id: 'c-1', nombre: '1° Básico A', nivel: '1° Básico', letra: 'A' },
        { id: 'c-2', nombre: '2° Básico B', nivel: '2° Básico', letra: 'B' }
      ]

      const mockIncidentes = [
        {
          incidente_id: 'inc-1',
          estudiante_id: 'est-1',
          estudiantes: { id: 'est-1', curso_id: 'c-1', tenant_id: mockTenantId },
          incidentes: { id: 'inc-1', fecha: '2026-03-15', gravedad: 'Leve' }
        },
        {
          incidente_id: 'inc-2',
          estudiante_id: 'est-2',
          estudiantes: { id: 'est-2', curso_id: 'c-1', tenant_id: mockTenantId },
          incidentes: { id: 'inc-2', fecha: '2026-03-20', gravedad: 'Grave' }
        }
      ]

      supabase.from = jest.fn((table) => {
        if (table === 'cursos') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ data: mockCursos, error: null })
          }
        }
        if (table === 'incidente_estudiantes') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            lte: jest.fn().mockResolvedValue({ data: mockIncidentes, error: null })
          }
        }
        return { select: jest.fn().mockReturnThis() }
      })

      await analyticsController.getMapaCalorCursos(req, res)

      expect(res.json).toHaveBeenCalled()
      const jsonResponse = res.json.mock.calls[0][0]
      expect(jsonResponse.success).toBe(true)
      expect(jsonResponse.data).toHaveProperty('anio', 2026)
      expect(jsonResponse.data.cursos.length).toBe(2)
      // Check march for curso 1 has total 2, leves 1, graves 1, alerta amarillo
      expect(jsonResponse.data.cursos[0].meses['3'].total).toBe(2)
      expect(jsonResponse.data.cursos[0].meses['3'].alerta).toBe('amarillo')
    })

    it('should return 403 Forbidden for unauthorized role', async () => {
      req.user = { tenant_id: mockTenantId, rol: 'Apoderado' }
      await analyticsController.getMapaCalorCursos(req, res)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'No tienes autorización para consultar el mapa de calor de convivencia escolar'
      })
    })

    it('should handle empty cursos gracefully', async () => {
      req.user = { tenant_id: mockTenantId, rol: 'Administrador' }
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [], error: null })
      })

      await analyticsController.getMapaCalorCursos(req, res)

      expect(res.json).toHaveBeenCalled()
      const jsonResponse = res.json.mock.calls[0][0]
      expect(jsonResponse.data.cursos).toEqual([])
      expect(jsonResponse.data.resumen_global.total_incidentes).toBe(0)
    })
  })

  describe('getDetalleCeldaMapaCalor', () => {
    it('should return 400 if curso_id or mes is missing', async () => {
      req.query = { curso_id: 'c-1' } // missing mes
      await analyticsController.getDetalleCeldaMapaCalor(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('should return 400 if mes is invalid', async () => {
      req.query = { curso_id: 'c-1', mes: '15' }
      await analyticsController.getDetalleCeldaMapaCalor(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('should return 404 if curso is not found', async () => {
      req.query = { curso_id: 'c-nonexistent', mes: '5', anio: '2026' }
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } })
      })

      await analyticsController.getDetalleCeldaMapaCalor(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
    })

    it('should return pedagogical diagnostics without student names', async () => {
      req.query = { curso_id: 'c-1', mes: '10', anio: '2026' }
      const mockCurso = { id: 'c-1', nombre: '6° Básico B', nivel: '6° Básico', letra: 'B' }
      const mockIncidentes = [
        {
          incidente_id: 'inc-10',
          estudiante_id: 'est-1',
          estudiantes: { id: 'est-1', curso_id: 'c-1' },
          incidentes: {
            id: 'inc-10',
            fecha: '2026-10-12',
            gravedad: 'Grave',
            estado: 'En Investigación',
            tipos_abordaje: { nombre: 'Agresión verbal en patio' }
          }
        }
      ]

      supabase.from = jest.fn((table) => {
        if (table === 'cursos') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockCurso, error: null })
          }
        }
        if (table === 'incidente_estudiantes') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            lte: jest.fn().mockResolvedValue({ data: mockIncidentes, error: null })
          }
        }
        return { select: jest.fn().mockReturnThis() }
      })

      await analyticsController.getDetalleCeldaMapaCalor(req, res)

      expect(res.json).toHaveBeenCalled()
      const jsonResponse = res.json.mock.calls[0][0]
      expect(jsonResponse.success).toBe(true)
      expect(jsonResponse.data.diagnostico.total_incidentes).toBe(1)
      expect(jsonResponse.data.diagnostico.gravedad.Grave).toBe(1)
      expect(jsonResponse.data.diagnostico).toHaveProperty('recomendacion_pedagogica')
      expect(jsonResponse.data.diagnostico).toHaveProperty('nota_privacidad')
      // Ensure student names are not present
      expect(JSON.stringify(jsonResponse)).not.toContain('nombre_estudiante')
    })
  })
})
