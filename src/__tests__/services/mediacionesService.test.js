const mediacionesService = require('../../services/mediacionesService')
const { supabase } = require('../../utils/db')
const emailService = require('../../services/emailService')
const { registrarAuditoria } = require('../../services/auditoriaService')

jest.mock('../../utils/db')
jest.mock('../../services/emailService')
jest.mock('../../services/auditoriaService', () => ({
  registrarAuditoria: jest.fn().mockResolvedValue(true),
}))
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}))

describe('mediacionesService (Sprint 7 / Épica 7.2 - Task 7.2.1.2)', () => {
  const mockTenantId = '11111111-1111-4111-8111-111111111111'
  const mockMediadorId = '22222222-2222-4222-8222-222222222222'
  const mockEstudiante1 = '33333333-3333-4333-8333-333333333333'
  const mockEstudiante2 = '44444444-4444-4444-8444-444444444444'
  const mockMediacionId = '55555555-5555-4555-8555-555555555555'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('crearMediacion', () => {
    const validPayload = {
      tipo_origen: 'preventiva_convivencia',
      motivo: 'Diferencias reiteradas durante el recreo respecto al uso del patio central',
      fecha_programada: '2026-10-20T10:30:00.000Z',
      lugar_sesion: 'Sala de Mediación y Convivencia',
      participantes: [
        { estudiante_id: mockEstudiante1, rol_participante: 'parte_1' },
        { estudiante_id: mockEstudiante2, rol_participante: 'parte_2' },
      ],
    }

    it('debe registrar exitosamente una mediación y sus participantes con folio asignado', async () => {
      const mockCreatedMediacion = {
        id: mockMediacionId,
        folio: 'MED-2026-0001',
        tenant_id: mockTenantId,
        mediador_id: mockMediadorId,
        estado: 'programada',
        ...validPayload,
      }

      const mockInsertHead = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockCreatedMediacion, error: null }),
      }

      const mockInsertParts = {
        insert: jest.fn().mockResolvedValue({ error: null }),
      }

      const mockGetSingle = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            ...mockCreatedMediacion,
            usuarios: { nombre: 'María', apellido: 'Pérez' },
            mediacion_participantes: [
              { id: 'p1', estudiante_id: mockEstudiante1, rol_participante: 'parte_1' },
              { id: 'p2', estudiante_id: mockEstudiante2, rol_participante: 'parte_2' },
            ],
          },
          error: null,
        }),
      }

      supabase.from = jest.fn((table) => {
        if (table === 'mediaciones') {
          return {
            insert: mockInsertHead.insert,
            select: mockGetSingle.select,
            eq: mockGetSingle.eq,
            single: mockGetSingle.single,
          }
        }
        if (table === 'mediacion_participantes') {
          return mockInsertParts
        }
        return {}
      })

      const resultado = await mediacionesService.crearMediacion(mockTenantId, mockMediadorId, validPayload)

      expect(resultado).toBeDefined()
      expect(resultado.id).toBe(mockMediacionId)
      expect(resultado.folio).toBe('MED-2026-0001')
      expect(registrarAuditoria).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: mockTenantId,
          userId: mockMediadorId,
          accion: 'CREATE',
          tabla: 'mediaciones',
        })
      )
    })

    it('debe tolerar fallo de auditoría y continuar retornando la mediación', async () => {
      const mockCreatedMediacion = {
        id: mockMediacionId,
        folio: 'MED-2026-0001',
        tenant_id: mockTenantId,
        mediador_id: mockMediadorId,
        estado: 'programada',
        ...validPayload,
      }

      registrarAuditoria.mockRejectedValueOnce(new Error('Audit DB offline'))

      supabase.from = jest.fn((table) => {
        if (table === 'mediaciones') {
          return {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockCreatedMediacion, error: null }),
            eq: jest.fn().mockReturnThis(),
          }
        }
        if (table === 'mediacion_participantes') {
          return { insert: jest.fn().mockResolvedValue({ error: null }) }
        }
        return {}
      })

      const resultado = await mediacionesService.crearMediacion(mockTenantId, mockMediadorId, validPayload)
      expect(resultado).toBeDefined()
    })

    it('debe lanzar error 500 si falla la inserción de la cabecera de mediaciones', async () => {
      supabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB connection error' } }),
      })

      await expect(
        mediacionesService.crearMediacion(mockTenantId, mockMediadorId, validPayload)
      ).rejects.toThrow(/DB connection error/i)
    })

    it('debe rechazar la mediación si incluye menos de 2 participantes distintos', async () => {
      const payloadInvalido = {
        ...validPayload,
        participantes: [
          { estudiante_id: mockEstudiante1, rol_participante: 'parte_1' },
        ],
      }

      await expect(
        mediacionesService.crearMediacion(mockTenantId, mockMediadorId, payloadInvalido)
      ).rejects.toThrow(/al menos 2 estudiantes participantes distintos/i)
    })

    it('debe rechazar la mediación si contiene estudiantes duplicados', async () => {
      const payloadDuplicado = {
        ...validPayload,
        participantes: [
          { estudiante_id: mockEstudiante1, rol_participante: 'parte_1' },
          { estudiante_id: mockEstudiante1, rol_participante: 'parte_2' },
        ],
      }

      await expect(
        mediacionesService.crearMediacion(mockTenantId, mockMediadorId, payloadDuplicado)
      ).rejects.toThrow(/No se permiten estudiantes duplicados/i)
    })

    it('debe ejecutar rollback compensatorio si falla la inserción de participantes', async () => {
      const mockCreatedMediacion = { id: mockMediacionId, folio: 'MED-2026-0001' }
      const mockDeleteQuery = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      }

      supabase.from = jest.fn((table) => {
        if (table === 'mediaciones') {
          return {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockCreatedMediacion, error: null }),
            delete: mockDeleteQuery.delete,
            eq: mockDeleteQuery.eq,
          }
        }
        if (table === 'mediacion_participantes') {
          return {
            insert: jest.fn().mockResolvedValue({
              error: { message: 'FK violation on estudiante_id' },
            }),
          }
        }
        return {}
      })

      await expect(
        mediacionesService.crearMediacion(mockTenantId, mockMediadorId, validPayload)
      ).rejects.toThrow(/FK violation on estudiante_id/i)

      expect(mockDeleteQuery.delete).toHaveBeenCalled()
      expect(mockDeleteQuery.eq).toHaveBeenCalledWith('id', mockMediacionId)
    })
  })

  describe('listarMediaciones', () => {
    it('debe retornar lista paginada de mediaciones del tenant con filtros de fecha y estado', async () => {
      const mockList = [
        {
          id: mockMediacionId,
          folio: 'MED-2026-0001',
          estado: 'programada',
          tipo_origen: 'preventiva_convivencia',
        },
      ]

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: mockList, count: 1, error: null }),
      }

      supabase.from = jest.fn().mockReturnValue(mockQuery)

      const resultado = await mediacionesService.listarMediaciones(mockTenantId, {
        page: 1,
        limit: 10,
        estado: 'programada',
        tipo_origen: 'preventiva_convivencia',
        fecha_desde: '2026-10-01',
        fecha_hasta: '2026-10-31',
      })

      expect(resultado.data).toHaveLength(1)
      expect(resultado.total).toBe(1)
      expect(resultado.page).toBe(1)
      expect(resultado.totalPages).toBe(1)
    })

    it('debe filtrar correctamente por estudiante_id o curso_id', async () => {
      const mockPartData = [{ mediacion_id: mockMediacionId }]
      const createPartQuery = (resData) => {
        const q = {
          select: jest.fn(() => q),
          eq: jest.fn(() => q),
          then: jest.fn((resolve) => resolve({ data: resData, error: null })),
        }
        return q
      }
      const mockPartQuery = createPartQuery(mockPartData)

      const mockMainQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: [{ id: mockMediacionId, folio: 'MED-2026-0001' }],
          count: 1,
          error: null,
        }),
      }

      supabase.from = jest.fn((table) => {
        if (table === 'mediacion_participantes') return mockPartQuery
        return mockMainQuery
      })

      const resultado = await mediacionesService.listarMediaciones(mockTenantId, {
        estudiante_id: mockEstudiante1,
        curso_id: 'curso-uuid-1',
      })

      expect(resultado.data).toHaveLength(1)
      expect(resultado.total).toBe(1)
    })

    it('debe retornar lista vacía si el filtro de estudiante/curso no arroja coincidencias', async () => {
      const qEmpty = {
        select: jest.fn(() => qEmpty),
        eq: jest.fn(() => qEmpty),
        then: jest.fn((resolve) => resolve({ data: [], error: null })),
      }

      supabase.from = jest.fn().mockReturnValue(qEmpty)

      const resultado = await mediacionesService.listarMediaciones(mockTenantId, {
        estudiante_id: mockEstudiante1,
      })

      expect(resultado.data).toEqual([])
      expect(resultado.total).toBe(0)

    })

    it('debe rechazar con 400 si los filtros son inválidos (ej. fecha mal formada)', async () => {
      await expect(
        mediacionesService.listarMediaciones(mockTenantId, { fecha_desde: '01-10-2026' })
      ).rejects.toThrow(/fecha_desde debe tener formato YYYY-MM-DD/i)
    })

    it('debe lanzar error 500 si la base de datos falla al listar', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: null, error: { message: 'Read error' } }),
      }

      supabase.from = jest.fn().mockReturnValue(mockQuery)

      await expect(
        mediacionesService.listarMediaciones(mockTenantId, {})
      ).rejects.toThrow(/Error al consultar listado de mediaciones/i)
    })
  })

  describe('obtenerMediacionPorId', () => {
    it('debe retornar el expediente de una mediación por ID', async () => {
      const mockMediacion = {
        id: mockMediacionId,
        folio: 'MED-2026-0001',
        motivo: 'Resolución pacífica',
      }

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockMediacion, error: null }),
      }

      supabase.from = jest.fn().mockReturnValue(mockQuery)

      const resultado = await mediacionesService.obtenerMediacionPorId(mockTenantId, mockMediacionId)

      expect(resultado).toBeDefined()
      expect(resultado.id).toBe(mockMediacionId)
    })

    it('debe lanzar error 404 si la mediación no existe', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found', code: 'PGRST116' } }),

      }

      supabase.from = jest.fn().mockReturnValue(mockQuery)

      await expect(
        mediacionesService.obtenerMediacionPorId(mockTenantId, mockMediacionId)
      ).rejects.toThrow(/Mediación no encontrada/i)
    })
  })

  describe('notificarApoderados', () => {
    it('debe enviar correos informativos y actualizar marcas temporales en participantes', async () => {
      const mockMediacionConApoderados = {
        id: mockMediacionId,
        folio: 'MED-2026-0001',
        motivo: 'Acuerdo formativo por convivencia',
        fecha_programada: '2026-10-25T11:00:00.000Z',
        lugar_sesion: 'Oficina de Convivencia',
        usuarios: { nombre: 'Rodrigo', apellido: 'Inspector' },
        mediacion_participantes: [
          {
            id: 'part-1',
            estudiante_id: mockEstudiante1,
            estudiantes: {
              nombre: 'Juan',
              apellido: 'Pérez',
              apoderados: [
                { id: 'apod-1', nombre: 'Carlos', apellido: 'Pérez', email: 'carlos@test.com', es_titular: true },
              ],
            },
          },
        ],
      }

      const mockQueryGet = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockMediacionConApoderados, error: null }),
      }

      const mockQueryUpdate = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockImplementation(() => ({
          eq: jest.fn().mockResolvedValue({ error: null }),
        })),
      }

      supabase.from = jest.fn((table) => {
        if (table === 'mediaciones') return mockQueryGet
        if (table === 'mediacion_participantes') return mockQueryUpdate
        return {}
      })

      emailService.enviarEmail = jest.fn().mockResolvedValue({ id: 'job-123' })

      const resultado = await mediacionesService.notificarApoderados(
        mockTenantId,
        mockMediacionId,
        mockMediadorId,
        { medio_aviso: 'correo', mensaje_personalizado: 'Favor confirmar asistencia presencial.' }
      )

      expect(resultado).toBeDefined()
      expect(resultado.total_notificados).toBe(1)
      expect(resultado.notificados[0].apoderado_email).toBe('carlos@test.com')
      expect(emailService.enviarEmail).toHaveBeenCalledTimes(1)
      expect(emailService.enviarEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'carlos@test.com',
          subject: expect.stringContaining('MED-2026-0001'),
        })
      )
      expect(registrarAuditoria).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'UPDATE',
          tabla: 'mediacion_participantes',
        })
      )
    })

    it('debe permitir medios de aviso alternativos como llamada o comunicación escrita', async () => {
      const mockMediacionSinEmail = {
        id: mockMediacionId,
        folio: 'MED-2026-0001',
        fecha_programada: '2026-10-25T11:00:00.000Z',
        mediacion_participantes: [
          {
            id: 'part-1',
            estudiante_id: mockEstudiante1,
            estudiantes: { nombre: 'Ana', apellido: 'Gómez', apoderados: [] },
          },
        ],
      }

      supabase.from = jest.fn((table) => {
        if (table === 'mediaciones') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockMediacionSinEmail, error: null }),
          }
        }
        return {
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockImplementation(() => ({
            eq: jest.fn().mockResolvedValue({ error: null }),
          })),
        }
      })

      const resultado = await mediacionesService.notificarApoderados(
        mockTenantId,
        mockMediacionId,
        mockMediadorId,
        { medio_aviso: 'llamada_telefonica' }
      )

      expect(resultado.total_notificados).toBe(1)
      expect(resultado.notificados[0].medio_aviso).toBe('llamada_telefonica')
      expect(emailService.enviarEmail).not.toHaveBeenCalled()
    })

    it('debe rechazar con 400 si los filtros de estudiante_ids no coinciden con ningún participante', async () => {
      const mockMediacion = {
        id: mockMediacionId,
        mediacion_participantes: [
          { id: 'part-1', estudiante_id: mockEstudiante1 },
        ],
      }

      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockMediacion, error: null }),
      })

      await expect(
        mediacionesService.notificarApoderados(mockTenantId, mockMediacionId, mockMediadorId, {
          estudiante_ids: ['99999999-9999-4999-8999-999999999999'],
        })
      ).rejects.toThrow(/No se encontraron participantes válidos para notificar/i)
    })

    it('debe tolerar fallo de envío de email y registrar la marca temporal de todas formas', async () => {
      const mockMediacion = {
        id: mockMediacionId,
        folio: 'MED-2026-0001',
        fecha_programada: '2026-10-25T11:00:00.000Z',
        mediacion_participantes: [
          {
            id: 'part-1',
            estudiante_id: mockEstudiante1,
            estudiantes: {
              nombre: 'Juan',
              apellido: 'Pérez',
              apoderados: [{ email: 'carlos@test.com' }],
            },
          },
        ],
      }

      supabase.from = jest.fn((table) => {
        if (table === 'mediaciones') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockMediacion, error: null }),
          }
        }
        return {
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockImplementation(() => ({
            eq: jest.fn().mockResolvedValue({ error: null }),
          })),
        }
      })

      emailService.enviarEmail.mockRejectedValueOnce(new Error('SMTP service unavailable'))

      const resultado = await mediacionesService.notificarApoderados(
        mockTenantId,
        mockMediacionId,
        mockMediadorId,
        { medio_aviso: 'correo' }
      )

      expect(resultado.total_notificados).toBe(1)
    })
  })
})
