const estudiantesService = require('../../services/estudiantesService')
const { supabase } = require('../../utils/db')
const { invalidateEstudiantes } = require('../../utils/cacheInvalidator')

jest.mock('../../utils/db')
jest.mock('../../utils/cacheInvalidator')

describe('estudiantesService — Condición PIE y Domicilios (HU 5.4 - Tarea 5.4.1)', () => {
  const mockTenantId = 'tenant-test-uuid'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('obtenerPerfil() con es_pie y direccion', () => {
    it('debe retornar es_pie y direccion del estudiante y direccion de sus apoderados', async () => {
      const mockEstudiante = {
        id: 'est-1',
        rut: '12.345.678-5',
        nombre: 'Matías',
        apellido: 'González',
        es_pie: true,
        direccion: 'Av. El Salvador 450, El Salvador',
        activo: true,
        cursos: { id: 'c-1', nombre: '6° Básico B', nivel: 'Básica', anio_academico: 2026 },
      }

      const mockApoderados = [
        {
          id: 'apod-1',
          nombre: 'Claudia',
          apellido: 'Soto',
          rut: '11.111.111-1',
          email: 'claudia@example.com',
          telefono: '+56912345678',
          es_titular: true,
          direccion: 'Av. El Salvador 450, El Salvador',
        },
      ]

      const mockIncidentes = []

      const mockStudentQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockEstudiante, error: null }),
      }

      const mockApoderadosQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn(),
      }
      mockApoderadosQuery.eq
        .mockReturnValueOnce(mockApoderadosQuery)
        .mockResolvedValueOnce({ data: mockApoderados, error: null })

      const mockIncidentesQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockIncidentes, error: null }),
      }

      supabase.from = jest.fn()
        .mockReturnValueOnce(mockStudentQuery)
        .mockReturnValueOnce(mockApoderadosQuery)
        .mockReturnValueOnce(mockIncidentesQuery)

      const perfil = await estudiantesService.obtenerPerfil('est-1', mockTenantId)

      expect(perfil).toBeDefined()
      expect(perfil.id).toBe('est-1')
      expect(perfil.es_pie).toBe(true)
      expect(perfil.direccion).toBe('Av. El Salvador 450, El Salvador')
      expect(perfil.apoderado).toBeDefined()
      expect(perfil.apoderado.nombre).toBe('Claudia')
      expect(perfil.apoderado.es_titular).toBe(true)
      expect(perfil.apoderados).toHaveLength(1)
      expect(perfil.apoderados[0].direccion).toBe('Av. El Salvador 450, El Salvador')
    })
  })

  describe('crearEstudiante() con validación Zod de es_pie, direccion y apoderado', () => {
    it('debe crear un estudiante con es_pie: true y direccion correctamente', async () => {
      const nuevoPayload = {
        rut: '12.345.678-5',
        nombre: 'Ignacio',
        apellido: 'Paredes',
        es_pie: true,
        direccion: 'Calle Los Pinos 123',
        curso_id: 'curso-uuid-1',
      }

      const mockCreated = {
        id: 'est-nuevo',
        tenant_id: mockTenantId,
        ...nuevoPayload,
        activo: true,
      }

      const mockQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockCreated, error: null }),
      }

      supabase.from = jest.fn().mockReturnValue(mockQuery)
      invalidateEstudiantes.mockResolvedValue(true)

      const res = await estudiantesService.crearEstudiante(mockTenantId, nuevoPayload)

      expect(res.es_pie).toBe(true)
      expect(res.direccion).toBe('Calle Los Pinos 123')
      expect(mockQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          es_pie: true,
          direccion: 'Calle Los Pinos 123',
        })
      )
    })

    it('debe rechazar con 400 si la direccion excede 255 caracteres', async () => {
      const payloadExcesivo = {
        rut: '12.345.678-5',
        nombre: 'Ana',
        apellido: 'Gómez',
        direccion: 'A'.repeat(256),
      }

      await expect(
        estudiantesService.crearEstudiante(mockTenantId, payloadExcesivo)
      ).rejects.toThrow('La dirección no puede exceder 255 caracteres')
    })

    it('debe insertar apoderado si viene incluido en el payload de creación', async () => {
      const payloadConApoderado = {
        rut: '12.345.678-5',
        nombre: 'Sofía',
        apellido: 'Araya',
        es_pie: false,
        direccion: 'Pasaje Las Flores 45',
        apoderado: {
          nombre: 'Marcela',
          apellido: 'Reyes',
          direccion: 'Pasaje Las Flores 45',
          email: 'marcela@correo.cl',
        },
      }

      const mockEstudianteCreado = {
        id: 'est-sofia',
        tenant_id: mockTenantId,
        ...payloadConApoderado,
      }

      const mockEstQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockEstudianteCreado, error: null }),
      }

      const mockApodQuery = {
        insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
      }

      supabase.from = jest.fn()
        .mockReturnValueOnce(mockEstQuery)
        .mockReturnValueOnce(mockApodQuery)

      const res = await estudiantesService.crearEstudiante(mockTenantId, payloadConApoderado)

      expect(res.id).toBe('est-sofia')
      expect(supabase.from).toHaveBeenCalledWith('apoderados')
      expect(mockApodQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          estudiante_id: 'est-sofia',
          direccion: 'Pasaje Las Flores 45',
          nombre: 'Marcela',
        })
      )
    })
  })

  describe('actualizarEstudiante() con es_pie y domicilios', () => {
    it('debe actualizar es_pie y direccion en estudiantes', async () => {
      const updateData = {
        es_pie: true,
        direccion: 'Nueva Alameda 999',
      }

      const mockUpdated = {
        id: 'est-1',
        tenant_id: mockTenantId,
        es_pie: true,
        direccion: 'Nueva Alameda 999',
      }

      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockUpdated, error: null }),
      }

      supabase.from = jest.fn().mockReturnValue(mockQuery)

      const res = await estudiantesService.actualizarEstudiante('est-1', mockTenantId, updateData)

      expect(res.es_pie).toBe(true)
      expect(res.direccion).toBe('Nueva Alameda 999')
      expect(mockQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          es_pie: true,
          direccion: 'Nueva Alameda 999',
        })
      )
    })

    it('debe actualizar la dirección del apoderado si se provee direccion_apoderado', async () => {
      const updateData = {
        direccion_apoderado: 'Av. Copayapu 1500',
      }

      const mockEstUpdated = {
        id: 'est-1',
        tenant_id: mockTenantId,
      }

      const mockEstQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockEstUpdated, error: null }),
      }

      const mockApodSelectQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [{ id: 'apod-1' }], error: null }),
      }

      const mockApodUpdateQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: {}, error: null }),
      }

      supabase.from = jest.fn()
        .mockReturnValueOnce(mockEstQuery)
        .mockReturnValueOnce(mockApodSelectQuery)
        .mockReturnValueOnce(mockApodUpdateQuery)

      await estudiantesService.actualizarEstudiante('est-1', mockTenantId, updateData)

      expect(supabase.from).toHaveBeenCalledWith('apoderados')
      expect(mockApodUpdateQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({ direccion: 'Av. Copayapu 1500' })
      )
    })
  })

  describe('importarEstudiantes() con reconocimiento de PIE y domicilios', () => {
    it('debe reconocer columna pie (si, 1, true, s) y guardar es_pie: true y domicilios', async () => {
      const mockFilas = [
        {
          rut: '12.345.678-5',
          nombre: 'Camila',
          apellido: 'Torres',
          curso: '8° Básico A',
          pie: 'si',
          domicilio: 'Pje Las Lilas 12',
          domicilio_apoderado: 'Pje Las Lilas 12',
          apoderado_nombre: 'Roberto',
          apoderado_telefono: '+56987654321',
        },
      ]

      // 1. buscarOCrearCurso: buscar
      const mockCursoQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { id: 'curso-8a' }, error: null }),
      }

      // 2. estudiantes check exist
      const mockEstSelectQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }), // no existe -> insert
      }

      // 3. estudiantes insert
      const mockEstInsertQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { id: 'est-camila' }, error: null }),
      }

      // 4. apoderados check exist
      const mockApodSelectQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null }), // no existe -> insert
      }

      // 5. apoderados insert
      const mockApodInsertQuery = {
        insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
      }

      supabase.from = jest.fn()
        .mockReturnValueOnce(mockCursoQuery)
        .mockReturnValueOnce(mockEstSelectQuery)
        .mockReturnValueOnce(mockEstInsertQuery)
        .mockReturnValueOnce(mockApodSelectQuery)
        .mockReturnValueOnce(mockApodInsertQuery)

      const resumen = await estudiantesService.importarEstudiantes(mockFilas, mockTenantId)

      expect(resumen.importados).toBe(1)
      expect(resumen.errores).toHaveLength(0)

      expect(mockEstInsertQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: 'Camila',
          es_pie: true,
          direccion: 'Pje Las Lilas 12',
        })
      )

      expect(mockApodInsertQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          estudiante_id: 'est-camila',
          nombre: 'Roberto',
          direccion: 'Pje Las Lilas 12',
          telefono: '+56987654321',
        })
      )
    })
  })
})
