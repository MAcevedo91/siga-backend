const cursosService = require('../../services/cursosService')
const { supabase } = require('../../utils/db')

jest.mock('../../utils/db')

describe('cursosService — Períodos Académicos y Búsqueda en Cascada (HU 5.5 - Tarea 5.5.1)', () => {
  const mockTenantId = 'tenant-test-uuid'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('obtenerPeriodoActivo()', () => {
    it('debe retornar el período académico activo del tenant', async () => {
      const mockPeriodo = [
        {
          id: 'p-2026',
          anio: 2026,
          fecha_inicio: '2026-03-01',
          fecha_fin: '2026-12-31',
          activo: true,
        },
      ]

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: mockPeriodo, error: null }),
      }

      supabase.from = jest.fn().mockReturnValue(mockQuery)

      const result = await cursosService.obtenerPeriodoActivo(mockTenantId)

      expect(result).toEqual(mockPeriodo[0])
      expect(supabase.from).toHaveBeenCalledWith('periodos_academicos')
      expect(mockQuery.eq).toHaveBeenCalledWith('tenant_id', mockTenantId)
      expect(mockQuery.eq).toHaveBeenCalledWith('activo', true)
    })

    it('debe retornar null si no hay período activo', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      }

      supabase.from = jest.fn().mockReturnValue(mockQuery)

      const result = await cursosService.obtenerPeriodoActivo(mockTenantId)

      expect(result).toBeNull()
    })
  })

  describe('obtenerNiveles()', () => {
    it('debe retornar niveles únicos ordenados según la jerarquía pedagógica chilena', async () => {
      // Mock periodo activo
      const mockPeriodoQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [{ id: 'p-2026' }], error: null }),
      }

      // Mock cursos con niveles desordenados y duplicados
      const mockCursosNiveles = [
        { nivel: '2° Medio' },
        { nivel: '1° Básico' },
        { nivel: 'Kínder' },
        { nivel: '8° Básico' },
        { nivel: '1° Básico' }, // duplicado
        { nivel: '1° Medio' },
        { nivel: 'Sin clasificar' }, // debe ser omitido si hay clasificados
      ]

      const mockCursosQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockResolvedValue({ data: mockCursosNiveles, error: null }),
      }

      supabase.from = jest.fn()
        .mockReturnValueOnce(mockPeriodoQuery)
        .mockReturnValueOnce(mockCursosQuery)

      const niveles = await cursosService.obtenerNiveles(mockTenantId)

      expect(niveles).toEqual([
        'Kínder',
        '1° Básico',
        '8° Básico',
        '1° Medio',
        '2° Medio',
      ])
      expect(niveles).not.toContain('Sin clasificar')
    })
  })

  describe('obtenerLetrasPorNivel()', () => {
    it('debe rechazar con 400 si el parámetro nivel no es proporcionado', async () => {
      await expect(
        cursosService.obtenerLetrasPorNivel(mockTenantId, '')
      ).rejects.toThrow("El parámetro 'nivel' es requerido")
    })

    it('debe retornar las letras disponibles y sus IDs para el nivel consultado', async () => {
      const mockPeriodoQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [{ id: 'p-2026' }], error: null }),
      }

      const mockCursos = [
        { id: 'c-1a', nombre: '1° Básico A', nivel: '1° Básico', letra: 'A' },
        { id: 'c-1b', nombre: '1° Básico B', nivel: '1° Básico', letra: 'B' },
      ]

      const mockCursosQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        or: jest.fn().mockResolvedValue({ data: mockCursos, error: null }),
      }

      supabase.from = jest.fn()
        .mockReturnValueOnce(mockPeriodoQuery)
        .mockReturnValueOnce(mockCursosQuery)

      const letras = await cursosService.obtenerLetrasPorNivel(mockTenantId, '1° Básico')

      expect(letras).toHaveLength(2)
      expect(letras[0]).toEqual({
        id: 'c-1a',
        letra: 'A',
        nombre: '1° Básico A',
        nivel: '1° Básico',
      })
      expect(letras[1]).toEqual({
        id: 'c-1b',
        letra: 'B',
        nombre: '1° Básico B',
        nivel: '1° Básico',
      })
    })

    it('debe extraer la letra desde el nombre si la columna letra es null', async () => {
      const mockPeriodoQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [{ id: 'p-2026' }], error: null }),
      }

      const mockCursos = [
        { id: 'c-3c', nombre: '3° Medio C', nivel: '3° Medio', letra: null },
      ]

      const mockCursosQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        or: jest.fn().mockResolvedValue({ data: mockCursos, error: null }),
      }

      supabase.from = jest.fn()
        .mockReturnValueOnce(mockPeriodoQuery)
        .mockReturnValueOnce(mockCursosQuery)

      const letras = await cursosService.obtenerLetrasPorNivel(mockTenantId, '3° Medio')

      expect(letras[0].letra).toBe('C')
    })
  })

  describe('obtenerEstudiantesPorCurso()', () => {
    it('debe rechazar con 400 si cursoId no es proporcionado', async () => {
      await expect(
        cursosService.obtenerEstudiantesPorCurso(mockTenantId, null)
      ).rejects.toThrow('El ID de curso es requerido')
    })

    it('debe rechazar con 404 si el curso no pertenece al tenant', async () => {
      const mockCursoQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      }

      supabase.from = jest.fn().mockReturnValue(mockCursoQuery)

      await expect(
        cursosService.obtenerEstudiantesPorCurso(mockTenantId, 'curso-ajeno')
      ).rejects.toThrow('Curso no encontrado o no pertenece a este establecimiento')
    })

    it('debe retornar nómina de estudiantes activos ordenada alfabéticamente', async () => {
      const mockCurso = {
        id: 'curso-1',
        nombre: '1° Básico A',
        nivel: '1° Básico',
        letra: 'A',
      }

      const mockEstudiantes = [
        { id: 'est-1', nombre: 'Carla', apellido: 'Ahumada', rut: '23.456.789-1', es_pie: true, activo: true },
        { id: 'est-2', nombre: 'Bernardo', apellido: 'Zúñiga', rut: '22.111.222-3', es_pie: false, activo: true },
      ]

      const mockCursoQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockCurso, error: null }),
      }

      const mockEstudiantesQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
      }
      mockEstudiantesQuery.order
        .mockReturnValueOnce(mockEstudiantesQuery)
        .mockResolvedValueOnce({ data: mockEstudiantes, error: null })

      supabase.from = jest.fn()
        .mockReturnValueOnce(mockCursoQuery)
        .mockReturnValueOnce(mockEstudiantesQuery)

      const result = await cursosService.obtenerEstudiantesPorCurso(mockTenantId, 'curso-1')

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        id: 'est-1',
        nombre: 'Carla',
        apellido: 'Ahumada',
        rut: '23.456.789-1',
        es_pie: true,
      })
      expect(result[1].es_pie).toBe(false)
    })
  })
})
