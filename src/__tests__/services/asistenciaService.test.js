const asistenciaService = require('../../services/asistenciaService')
const { supabase } = require('../../utils/db')
const { registrarAuditoria } = require('../../services/auditoriaService')

jest.mock('../../utils/db')
jest.mock('../../services/auditoriaService')

describe('asistenciaService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('registrarAsistencia', () => {
    it('should bulk insert asistencia records', async () => {
      const mockData = {
        cursoId: '550e8400-e29b-41d4-a716-446655440000',
        fecha: '2026-07-02',
        bloque: 1,
        asistencias: [
          { estudianteId: '550e8400-e29b-41d4-a716-446655440001', estado: 'Presente' },
          { estudianteId: '550e8400-e29b-41d4-a716-446655440002', estado: 'Ausente', observaciones: 'Sin justificar' }
        ]
      }

      const mockQuery = {
        upsert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: [{ id: '1' }, { id: '2' }],
          error: null
        })
      }

      supabase.from = jest.fn().mockReturnValue(mockQuery)
      registrarAuditoria.mockResolvedValue({ id: 'audit-1' })

      const result = await asistenciaService.registrarAsistencia(
        'tenant-uuid',
        mockData,
        'usuario-uuid'
      )

      expect(result.registros).toBe(2)
      expect(supabase.from).toHaveBeenCalledWith('asistencia')
      expect(registrarAuditoria).toHaveBeenCalled()
    })

    it('should throw error if no asistencias provided', async () => {
      const mockData = {
        cursoId: '550e8400-e29b-41d4-a716-446655440000',
        fecha: '2026-07-02',
        asistencias: []
      }

      await expect(
        asistenciaService.registrarAsistencia('tenant-uuid', mockData, 'usuario-uuid')
      ).rejects.toThrow('Debe incluir al menos una asistencia')
    })

    it('should throw error if invalid UUID format', async () => {
      const mockData = {
        cursoId: 'invalid-uuid',
        fecha: '2026-07-02',
        asistencias: [
          { estudianteId: '550e8400-e29b-41d4-a716-446655440001', estado: 'Presente' }
        ]
      }

      await expect(
        asistenciaService.registrarAsistencia('tenant-uuid', mockData, 'usuario-uuid')
      ).rejects.toThrow('cursoId debe ser UUID válido')
    })

    it('should throw error if invalid date format', async () => {
      const mockData = {
        cursoId: '550e8400-e29b-41d4-a716-446655440000',
        fecha: '02-07-2026',
        asistencias: [
          { estudianteId: '550e8400-e29b-41d4-a716-446655440001', estado: 'Presente' }
        ]
      }

      await expect(
        asistenciaService.registrarAsistencia('tenant-uuid', mockData, 'usuario-uuid')
      ).rejects.toThrow('Formato fecha inválido')
    })

    it('should throw error if invalid estado value', async () => {
      const mockData = {
        cursoId: '550e8400-e29b-41d4-a716-446655440000',
        fecha: '2026-07-02',
        asistencias: [
          { estudianteId: '550e8400-e29b-41d4-a716-446655440001', estado: 'NoExiste' }
        ]
      }

      await expect(
        asistenciaService.registrarAsistencia('tenant-uuid', mockData, 'usuario-uuid')
      ).rejects.toThrow()
    })

    it('should handle database errors during insert', async () => {
      const mockData = {
        cursoId: '550e8400-e29b-41d4-a716-446655440000',
        fecha: '2026-07-02',
        asistencias: [
          { estudianteId: '550e8400-e29b-41d4-a716-446655440001', estado: 'Presente' }
        ]
      }

      const mockQuery = {
        upsert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database insert error' }
        })
      }

      supabase.from = jest.fn().mockReturnValue(mockQuery)

      await expect(
        asistenciaService.registrarAsistencia('tenant-uuid', mockData, 'usuario-uuid')
      ).rejects.toThrow('Error al registrar asistencia')
    })
  })

  describe('getAsistenciaCurso', () => {
    it('should return asistencia for a curso with LEFT JOIN', async () => {
      const mockEstudiantes = [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          nombre: 'Juan',
          apellido: 'Pérez',
          asistencia: [
            { fecha: '2026-07-02', estado: 'Presente', bloque: 1, observaciones: null, justificacion_adjunto: null }
          ]
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
          nombre: 'María',
          apellido: 'González',
          asistencia: []
        }
      ]

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockEstudiantes,
          error: null
        })
      }

      supabase.from = jest.fn().mockReturnValue(mockQuery)

      const result = await asistenciaService.getAsistenciaCurso(
        'tenant-uuid',
        '550e8400-e29b-41d4-a716-446655440000',
        '2026-07-02',
        1
      )

      expect(result).toHaveLength(2)
      expect(result[0].estado).toBe('Presente')
      expect(result[1].estado).toBeNull()
      expect(supabase.from).toHaveBeenCalledWith('estudiantes')
    })

    it('should handle database errors gracefully', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' }
        })
      }

      supabase.from = jest.fn().mockReturnValue(mockQuery)

      await expect(
        asistenciaService.getAsistenciaCurso(
          'tenant-uuid',
          '550e8400-e29b-41d4-a716-446655440000',
          '2026-07-02',
          1
        )
      ).rejects.toThrow('Error al obtener asistencia')
    })
  })

  describe('getAsistenciaEstudiante', () => {
    it('should return asistencia history for a student', async () => {
      const mockAsistencias = [
        { fecha: '2026-07-02', estado: 'Presente', bloque: 1, observaciones: null, justificacion_adjunto: null },
        { fecha: '2026-07-01', estado: 'Ausente', bloque: 2, observaciones: 'Sin avisar', justificacion_adjunto: null }
      ]

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockAsistencias,
          error: null
        })
      }

      supabase.from = jest.fn().mockReturnValue(mockQuery)

      const result = await asistenciaService.getAsistenciaEstudiante(
        'tenant-uuid',
        '550e8400-e29b-41d4-a716-446655440001',
        '2026-07-01',
        '2026-07-02'
      )

      expect(result).toHaveLength(2)
      expect(result[0].fecha).toBe('2026-07-02')
      expect(supabase.from).toHaveBeenCalledWith('asistencia')
    })

    it('should handle database errors gracefully', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' }
        })
      }

      supabase.from = jest.fn().mockReturnValue(mockQuery)

      await expect(
        asistenciaService.getAsistenciaEstudiante(
          'tenant-uuid',
          '550e8400-e29b-41d4-a716-446655440001',
          '2026-07-01',
          '2026-07-02'
        )
      ).rejects.toThrow('Error al obtener asistencia')
    })
  })

  describe('calcularPorcentajeAsistencia', () => {
    it('should calculate attendance percentage correctly', async () => {
      const mockAsistencia = [
        { fecha: '2026-06-01', estado: 'Presente', bloque: null },
        { fecha: '2026-06-02', estado: 'Presente', bloque: null },
        { fecha: '2026-06-03', estado: 'Ausente', bloque: null },
        { fecha: '2026-06-04', estado: 'Atrasado', bloque: null },
        { fecha: '2026-06-05', estado: 'Justificado', bloque: null }
      ]

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        is: jest.fn().mockResolvedValue({ data: mockAsistencia, error: null })
      }

      supabase.from = jest.fn().mockReturnValue(mockQuery)

      const result = await asistenciaService.calcularPorcentajeAsistencia(
        'tenant-uuid',
        'est-uuid',
        '2026-06-01',
        '2026-06-05'
      )

      expect(result.totalDias).toBe(5)
      expect(result.presente).toBe(2)
      expect(result.ausente).toBe(1)
      expect(result.atrasado).toBe(1)
      expect(result.justificado).toBe(1)
      expect(result.porcentaje).toBe(40) // 2 presente / 5 total * 100
    })

    it('should return 0% when no attendance records exist', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        is: jest.fn().mockResolvedValue({ data: [], error: null })
      }

      supabase.from = jest.fn().mockReturnValue(mockQuery)

      const result = await asistenciaService.calcularPorcentajeAsistencia(
        'tenant-uuid',
        'est-uuid',
        '2026-06-01',
        '2026-06-05'
      )

      expect(result.totalDias).toBe(0)
      expect(result.porcentaje).toBe(0)
    })

    it('should handle database errors gracefully', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        is: jest.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } })
      }

      supabase.from = jest.fn().mockReturnValue(mockQuery)

      await expect(
        asistenciaService.calcularPorcentajeAsistencia(
          'tenant-uuid',
          'est-uuid',
          '2026-06-01',
          '2026-06-05'
        )
      ).rejects.toThrow('Error al calcular asistencia')
    })
  })

  describe('getEstudiantesEnRiesgo', () => {
    it('should return students with attendance < 85%', async () => {
      const mockEstudiantes = [
        {
          id: 'est1-uuid',
          nombre: 'Juan',
          apellido: 'Pérez',
          curso: { nombre: '8A' },
          asistencia: [
            { estado: 'Presente' },
            { estado: 'Ausente' },
            { estado: 'Ausente' },
            { estado: 'Ausente' },
            { estado: 'Presente' }
          ]
        },
        {
          id: 'est2-uuid',
          nombre: 'María',
          apellido: 'López',
          curso: { nombre: '8B' },
          asistencia: [
            { estado: 'Presente' },
            { estado: 'Presente' },
            { estado: 'Presente' },
            { estado: 'Presente' },
            { estado: 'Presente' }
          ]
        }
      ]

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        is: jest.fn().mockResolvedValue({ data: mockEstudiantes, error: null })
      }

      supabase.from = jest.fn().mockReturnValue(mockQuery)

      const result = await asistenciaService.getEstudiantesEnRiesgo('tenant-uuid')

      expect(result.length).toBe(1)
      expect(result[0].estudianteId).toBe('est1-uuid')
      expect(result[0].porcentajeAsistencia).toBe(40) // 2/5 * 100
      expect(result[0].diasAusente).toBe(3)
    })

    it('should filter by custom porcentajeMinimo threshold', async () => {
      const mockEstudiantes = [
        {
          id: 'est1-uuid',
          nombre: 'Juan',
          apellido: 'Pérez',
          curso: { nombre: '8A' },
          asistencia: [
            { estado: 'Presente' },
            { estado: 'Presente' },
            { estado: 'Presente' },
            { estado: 'Ausente' },
            { estado: 'Presente' }
          ]
        }
      ]

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        is: jest.fn().mockResolvedValue({ data: mockEstudiantes, error: null })
      }

      supabase.from = jest.fn().mockReturnValue(mockQuery)

      const result = await asistenciaService.getEstudiantesEnRiesgo('tenant-uuid', 90)

      expect(result.length).toBe(1)
      expect(result[0].porcentajeAsistencia).toBe(80) // 4/5 * 100
    })

    it('should sort students by porcentajeAsistencia ascending', async () => {
      const mockEstudiantes = [
        {
          id: 'est1-uuid',
          nombre: 'Juan',
          apellido: 'Pérez',
          curso: { nombre: '8A' },
          asistencia: [
            { estado: 'Presente' },
            { estado: 'Presente' },
            { estado: 'Presente' },
            { estado: 'Ausente' },
            { estado: 'Ausente' }
          ]
        },
        {
          id: 'est2-uuid',
          nombre: 'María',
          apellido: 'López',
          curso: { nombre: '8B' },
          asistencia: [
            { estado: 'Presente' },
            { estado: 'Ausente' },
            { estado: 'Ausente' },
            { estado: 'Ausente' },
            { estado: 'Ausente' }
          ]
        }
      ]

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        is: jest.fn().mockResolvedValue({ data: mockEstudiantes, error: null })
      }

      supabase.from = jest.fn().mockReturnValue(mockQuery)

      const result = await asistenciaService.getEstudiantesEnRiesgo('tenant-uuid')

      expect(result.length).toBe(2)
      expect(result[0].porcentajeAsistencia).toBe(20) // Lowest first
      expect(result[1].porcentajeAsistencia).toBe(60)
    })

    it('should handle database errors gracefully', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        is: jest.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } })
      }

      supabase.from = jest.fn().mockReturnValue(mockQuery)

      await expect(
        asistenciaService.getEstudiantesEnRiesgo('tenant-uuid')
      ).rejects.toThrow('Error al obtener estudiantes')
    })
  })
})
