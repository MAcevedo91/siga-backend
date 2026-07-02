const riesgoService = require('../../../src/services/riesgoService')

jest.mock('../../../src/utils/db', () => ({
  supabase: {
    from: jest.fn()
  }
}))

const { supabase } = require('../../../src/utils/db')

describe('Riesgo Service', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('calcularRiesgoEstudiante', () => {
    it('debe retornar score 0 y nivel Bajo cuando no hay incidentes', async () => {
      const mockOrder = jest.fn().mockResolvedValue({
        data: [],
        error: null
      })

      const mockGte = jest.fn().mockReturnValue({
        order: mockOrder
      })

      const mockEq2 = jest.fn().mockReturnValue({
        gte: mockGte
      })

      const mockEq1 = jest.fn().mockReturnValue({
        eq: mockEq2
      })

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: mockEq1
        })
      })

      const result = await riesgoService.calcularRiesgoEstudiante(1, 'tenant-1')

      expect(result).toEqual({
        score: 0,
        level: 'Bajo',
        details: { total: 0, recent: 0 }
      })
    })

    it('debe calcular score correcto con 1 incidente Leve reciente', async () => {
      const sevenDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()

      const mockIncidentes = [
        { id: 1, gravedad: 'Leve', fecha: sevenDaysAgo }
      ]

      const mockOrder = jest.fn().mockResolvedValue({
        data: mockIncidentes,
        error: null
      })

      const mockGte = jest.fn().mockReturnValue({
        order: mockOrder
      })

      const mockEq2 = jest.fn().mockReturnValue({
        gte: mockGte
      })

      const mockEq1 = jest.fn().mockReturnValue({
        eq: mockEq2
      })

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: mockEq1
        })
      })

      const result = await riesgoService.calcularRiesgoEstudiante(1, 'tenant-1')

      // Frequency: 1 * 2 = 2 points
      // Severity: 5 (Leve) * 1.5 (recent multiplier) = 7.5 points
      // Total: 2 + 7.5 = 9.5 → rounded to 10
      expect(result.score).toBe(10)
      expect(result.level).toBe('Bajo')
      expect(result.details.total).toBe(1)
      expect(result.details.recent).toBe(1)
      expect(result.details.frequencyScore).toBe(2)
    })

    it('debe calcular score correcto con múltiples incidentes Grave', async () => {
      const recentDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
      const olderDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()

      const mockIncidentes = [
        { id: 1, gravedad: 'Grave', fecha: recentDate },
        { id: 2, gravedad: 'Grave', fecha: recentDate },
        { id: 3, gravedad: 'Grave', fecha: olderDate }
      ]

      const mockOrder = jest.fn().mockResolvedValue({
        data: mockIncidentes,
        error: null
      })

      const mockGte = jest.fn().mockReturnValue({
        order: mockOrder
      })

      const mockEq2 = jest.fn().mockReturnValue({
        gte: mockGte
      })

      const mockEq1 = jest.fn().mockReturnValue({
        eq: mockEq2
      })

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: mockEq1
        })
      })

      const result = await riesgoService.calcularRiesgoEstudiante(1, 'tenant-1')

      // Frequency: 3 * 2 = 6 points
      // Severity: 15 * 1.5 + 15 * 1.5 + 15 * 1.0 = 22.5 + 22.5 + 15 = 60 points
      // Total: 6 + 60 = 66 → Alto level
      expect(result.score).toBe(66)
      expect(result.level).toBe('Alto')
      expect(result.details.total).toBe(3)
      expect(result.details.recent).toBe(2)
    })

    it('debe asignar nivel Crítico para score >= 76', async () => {
      const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()

      const mockIncidentes = [
        { id: 1, gravedad: 'Gravísimo', fecha: recentDate },
        { id: 2, gravedad: 'Gravísimo', fecha: recentDate }
      ]

      const mockOrder = jest.fn().mockResolvedValue({
        data: mockIncidentes,
        error: null
      })

      const mockGte = jest.fn().mockReturnValue({
        order: mockOrder
      })

      const mockEq2 = jest.fn().mockReturnValue({
        gte: mockGte
      })

      const mockEq1 = jest.fn().mockReturnValue({
        eq: mockEq2
      })

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: mockEq1
        })
      })

      const result = await riesgoService.calcularRiesgoEstudiante(1, 'tenant-1')

      // Frequency: 2 * 2 = 4 points
      // Severity: 30 * 1.5 + 30 * 1.5 = 45 + 45 = 90 points
      // Total: 4 + 90 = 94 → capped at 100
      expect(result.score).toBe(94)
      expect(result.level).toBe('Crítico')
    })

    it('debe limitar frequency score a máximo 20 puntos', async () => {
      const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()

      // 15 incidentes = 30 points sin límite, pero máximo es 20
      const mockIncidentes = Array(15).fill(null).map((_, i) => ({
        id: i,
        gravedad: 'Leve',
        fecha: recentDate
      }))

      const mockOrder = jest.fn().mockResolvedValue({
        data: mockIncidentes,
        error: null
      })

      const mockGte = jest.fn().mockReturnValue({
        order: mockOrder
      })

      const mockEq2 = jest.fn().mockReturnValue({
        gte: mockGte
      })

      const mockEq1 = jest.fn().mockReturnValue({
        eq: mockEq2
      })

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: mockEq1
        })
      })

      const result = await riesgoService.calcularRiesgoEstudiante(1, 'tenant-1')

      expect(result.details.frequencyScore).toBe(20)
    })

    it('debe lanzar error si falla la consulta', async () => {
      const mockOrder = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      })

      const mockGte = jest.fn().mockReturnValue({
        order: mockOrder
      })

      const mockEq2 = jest.fn().mockReturnValue({
        gte: mockGte
      })

      const mockEq1 = jest.fn().mockReturnValue({
        eq: mockEq2
      })

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: mockEq1
        })
      })

      await expect(
        riesgoService.calcularRiesgoEstudiante(1, 'tenant-1')
      ).rejects.toThrow('Database error')
    })
  })

  describe('getEstudiantesConRiesgo', () => {
    it('debe retornar lista de estudiantes con sus scores ordenados', async () => {
      const mockEstudiantes = [
        { id: 1, nombre: 'Juan', apellido: 'Pérez', rut: '11111111-1' },
        { id: 2, nombre: 'María', apellido: 'González', rut: '22222222-2' }
      ]

      const mockEqEstudiantes = jest.fn().mockResolvedValue({
        data: mockEstudiantes,
        error: null
      })

      // Mock ALL incidents for ALL students (batched query)
      const mockAllIncidentes = [
        { id: 1, estudiante_id: 1, gravedad: 'Grave', fecha: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
        { id: 2, estudiante_id: 1, gravedad: 'Grave', fecha: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
        { id: 3, estudiante_id: 2, gravedad: 'Leve', fecha: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString() }
      ]

      supabase.from.mockImplementation((table) => {
        if (table === 'estudiantes') {
          return {
            select: jest.fn().mockReturnValue({
              eq: mockEqEstudiantes
            })
          }
        } else if (table === 'incidentes') {
          const mockOrder = jest.fn().mockResolvedValue({
            data: mockAllIncidentes,
            error: null
          })

          const mockGte = jest.fn().mockReturnValue({
            order: mockOrder
          })

          const mockIn = jest.fn().mockReturnValue({
            gte: mockGte
          })

          const mockEq = jest.fn().mockReturnValue({
            in: mockIn
          })

          return {
            select: jest.fn().mockReturnValue({
              eq: mockEq
            })
          }
        }
      })

      const result = await riesgoService.getEstudiantesConRiesgo('tenant-1')

      expect(result).toHaveLength(2)
      // Debe estar ordenado por score descendente
      expect(result[0].id).toBe(1) // Juan con más incidentes graves
      expect(result[0].riesgo.score).toBeGreaterThan(result[1].riesgo.score)
    })

    it('debe filtrar por minScore', async () => {
      const mockEstudiantes = [
        { id: 1, nombre: 'Juan', apellido: 'Pérez', rut: '11111111-1' }
      ]

      const mockEqEstudiantes = jest.fn().mockResolvedValue({
        data: mockEstudiantes,
        error: null
      })

      // Estudiante con score bajo (batched query)
      const mockIncidentes = [
        { id: 1, estudiante_id: 1, gravedad: 'Leve', fecha: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString() }
      ]

      supabase.from.mockImplementation((table) => {
        if (table === 'estudiantes') {
          return {
            select: jest.fn().mockReturnValue({
              eq: mockEqEstudiantes
            })
          }
        } else if (table === 'incidentes') {
          const mockOrder = jest.fn().mockResolvedValue({
            data: mockIncidentes,
            error: null
          })

          const mockGte = jest.fn().mockReturnValue({
            order: mockOrder
          })

          const mockIn = jest.fn().mockReturnValue({
            gte: mockGte
          })

          const mockEq = jest.fn().mockReturnValue({
            in: mockIn
          })

          return {
            select: jest.fn().mockReturnValue({
              eq: mockEq
            })
          }
        }
      })

      // Solicitar estudiantes con score mínimo 50
      const result = await riesgoService.getEstudiantesConRiesgo('tenant-1', 50)

      // El estudiante con score bajo no debe aparecer
      expect(result).toHaveLength(0)
    })

    it('debe lanzar error si falla la consulta de estudiantes', async () => {
      const mockEqEstudiantes = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      })

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: mockEqEstudiantes
        })
      })

      await expect(
        riesgoService.getEstudiantesConRiesgo('tenant-1')
      ).rejects.toThrow('Database error')
    })
  })
})
