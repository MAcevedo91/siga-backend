const estudiantesService = require('../../services/estudiantesService')
const { supabase } = require('../../utils/db')
const { invalidateEstudiantes } = require('../../utils/cacheInvalidator')

jest.mock('../../utils/db')
jest.mock('../../utils/cacheInvalidator')

describe('estudiantesService — Reasignación de curso durante el año lectivo', () => {
  const mockTenantId = 'tenant-test-uuid'
  const mockEstudianteId = 'est-123'
  const mockNuevoCursoId = 15

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('reasigna el curso exitosamente y sincroniza la matrícula del estudiante', async () => {
    const mockEstudiante = {
      id: mockEstudianteId,
      nombre: 'Lucas',
      apellido: 'Pérez',
      rut: '22.333.444-5',
      curso_id: 10,
      tenant_id: mockTenantId,
    }

    const mockCursoDestino = {
      id: mockNuevoCursoId,
      nombre: '8° Básico B',
      nivel: '8° Básico',
      letra: 'B',
      anio_academico: 2026,
    }

    const mockEstudianteActualizado = {
      id: mockEstudianteId,
      nombre: 'Lucas',
      apellido: 'Pérez',
      rut: '22.333.444-5',
      curso_id: mockNuevoCursoId,
      es_pie: false,
      activo: true,
      cursos: { id: mockNuevoCursoId, nombre: '8° Básico B', nivel: '8° Básico', letra: 'B' },
    }

    // Mock query estudiante
    const mockEstSelectBuilder = {
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: mockEstudiante, error: null }),
    }

    // Mock update estudiante
    const mockEstUpdateBuilder = {
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: mockEstudianteActualizado, error: null }),
      }),
    }

    // Mock query curso destino
    const mockCursoSelectBuilder = {
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: mockCursoDestino, error: null }),
    }

    // Mock matricula
    const mockMatriculaBuilder = {
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [{ id: 'mat-1' }], error: null }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
    }

    supabase.from.mockImplementation((table) => {
      if (table === 'estudiantes') {
        return {
          select: jest.fn().mockReturnValue(mockEstSelectBuilder),
          update: jest.fn().mockReturnValue(mockEstUpdateBuilder),
        }
      }
      if (table === 'cursos') {
        return {
          select: jest.fn().mockReturnValue(mockCursoSelectBuilder),
        }
      }
      if (table === 'matriculas') {
        return {
          select: jest.fn().mockReturnValue(mockMatriculaBuilder),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
          insert: jest.fn().mockResolvedValue({ data: null, error: null }),
        }
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      }
    })

    const resultado = await estudiantesService.cambiarCursoEstudiante(
      mockEstudianteId,
      mockTenantId,
      {
        curso_id: mockNuevoCursoId,
        motivo: 'Resolución de conflicto / Convivencia escolar',
        observacion: 'Se cambia de sección para evitar incidentes reiterados',
      },
      'usuario-convivencia-1'
    )

    expect(resultado.curso_id).toBe(mockNuevoCursoId)
    expect(resultado.curso_anterior_id).toBe(10)
    expect(resultado.motivo_cambio).toBe('Resolución de conflicto / Convivencia escolar')
    expect(invalidateEstudiantes).toHaveBeenCalledWith(mockTenantId)
  })

  it('falla con 404 si el estudiante no existe en el establecimiento', async () => {
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
    })

    await expect(
      estudiantesService.cambiarCursoEstudiante(
        'est-inexistente',
        mockTenantId,
        { curso_id: 15, motivo: 'Cambio de paralelo' },
        'usr-1'
      )
    ).rejects.toThrow('Estudiante no encontrado')
  })

  it('falla con 400 si los parámetros son inválidos', async () => {
    await expect(
      estudiantesService.cambiarCursoEstudiante(
        mockEstudianteId,
        mockTenantId,
        { curso_id: -1, motivo: 'no' },
        'usr-1'
      )
    ).rejects.toThrow()
  })
})
