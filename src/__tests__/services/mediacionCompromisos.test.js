const mediacionesService = require('../../services/mediacionesService')
const mediacionesController = require('../../controllers/mediacionesController')
const { supabase } = require('../../utils/db')
const { registrarAuditoria } = require('../../services/auditoriaService')
const {
  crearGuardarCompromisosSchema,
  TIPOS_COMPROMISO,
} = require('../../schemas/mediacionesSchemas')

jest.mock('../../utils/db')
jest.mock('../../services/auditoriaService', () => ({
  registrarAuditoria: jest.fn().mockResolvedValue(true),
}))
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}))

describe('TASK 7.2.2.1 — mediacion_compromisos y Endpoints de Gestión en Express', () => {
  const mockTenantId = '11111111-1111-4111-8111-111111111111'
  const mockUsuarioId = '22222222-2222-4222-8222-222222222222'
  const mockMediacionId = '55555555-5555-4555-8555-555555555555'
  const mockEstudianteId = '33333333-3333-4333-8333-333333333333'
  const fechaMediacion = '2026-10-20T10:00:00.000Z'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ===========================================================================
  // 1. VALIDACIÓN ZOD Y REGLAS DE NEGOCIO
  // ===========================================================================
  describe('Validación Zod: Esquemas de Compromisos', () => {
    it('debe contener los 6 tipos de compromiso regulados por enum', () => {
      expect(TIPOS_COMPROMISO).toEqual([
        'reparacion_relacional',
        'disculpa_comunitaria',
        'cuidado_espacios',
        'actitud_aula',
        'apoyo_academico',
        'otro',
      ])
    })

    it('debe validar exitosamente cuando fecha_limite es posterior o igual a la fecha de la mediación', () => {
      const schema = crearGuardarCompromisosSchema(fechaMediacion)
      const validData = {
        compromisos: [
          {
            estudiante_id: mockEstudianteId,
            tipo_compromiso: 'reparacion_relacional',
            descripcion: 'Ofrecer disculpa reparatoria en privado y acordar trato respetuoso',
            fecha_limite: '2026-10-21',
          },
        ],
        fecha_seguimiento: '2026-10-25',
      }

      const result = schema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('CRITERIO DE ACEPTACIÓN: debe rechazar cuando fecha_limite es anterior a la fecha de la mediación', () => {
      const schema = crearGuardarCompromisosSchema(fechaMediacion)
      const invalidData = {
        compromisos: [
          {
            estudiante_id: mockEstudianteId,
            tipo_compromiso: 'actitud_aula',
            descripcion: 'Compromiso con fecha inválida retroactiva',
            fecha_limite: '2026-10-18', // Anterior al 2026-10-20
          },
        ],
      }

      const result = schema.safeParse(invalidData)
      expect(result.success).toBe(false)
      expect(result.error.issues[0].message).toMatch(/no puede ser anterior a la fecha de la mediación/i)
      expect(result.error.issues[0].path).toEqual(['compromisos', 0, 'fecha_limite'])
    })

    it('debe rechazar si la lista de compromisos viene vacía', () => {
      const schema = crearGuardarCompromisosSchema(fechaMediacion)
      const result = schema.safeParse({ compromisos: [] })
      expect(result.success).toBe(false)
      expect(result.error.issues[0].message).toMatch(/al menos un compromiso/i)
    })

    it('debe rechazar un tipo de compromiso no permitido en el enum', () => {
      const schema = crearGuardarCompromisosSchema(fechaMediacion)
      const result = schema.safeParse({
        compromisos: [
          {
            tipo_compromiso: 'tipo_inexistente_arbitrario',
            descripcion: 'Descripción válida de prueba',
            fecha_limite: '2026-10-25',
          },
        ],
      })
      expect(result.success).toBe(false)
      expect(result.error.issues[0].message).toMatch(/Tipo de compromiso inválido/i)
    })
  })

  // ===========================================================================
  // 2. SERVICIO: guardarCompromisos (ATOMICIDAD Y ROLLBACK)
  // ===========================================================================
  describe('mediacionesService.guardarCompromisos', () => {
    const validBody = {
      compromisos: [
        {
          estudiante_id: mockEstudianteId,
          tipo_compromiso: 'cuidado_espacios',
          descripcion: 'Colaborar en el orden y aseo del espacio común durante la semana',
          fecha_limite: '2026-10-24',
          cumplido: false,
        },
      ],
      fecha_seguimiento: '2026-10-26',
      observaciones_cierre: 'Acuerdos formativos construidos con plena voluntad de las partes',
    }

    it('debe guardar compromisos exitosamente, actualizar estado a acordada y auditar', async () => {
      const mockMediacionDb = {
        id: mockMediacionId,
        folio: 'MED-2026-0005',
        fecha_programada: fechaMediacion,
        estado: 'en_sesion',
      }

      const mockNuevosCompromisos = [
        {
          id: 'c1-uuid',
          mediacion_id: mockMediacionId,
          tenant_id: mockTenantId,
          ...validBody.compromisos[0],
        },
      ]

      supabase.from = jest.fn((table) => {
        if (table === 'mediaciones') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockMediacionDb, error: null }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null }),
              }),
            }),
          }
        }
        if (table === 'mediacion_compromisos') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: [], error: null }), // compromisos previos vacíos
              }),
            }),
            delete: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null }),
              }),
            }),
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({ data: mockNuevosCompromisos, error: null }),
            }),
          }
        }
        return {}
      })

      const respuesta = await mediacionesService.guardarCompromisos(
        mockTenantId,
        mockMediacionId,
        mockUsuarioId,
        validBody
      )

      expect(respuesta).toBeDefined()
      expect(respuesta.mediacion_id).toBe(mockMediacionId)
      expect(respuesta.estado).toBe('acordada')
      expect(respuesta.fecha_seguimiento).toBe('2026-10-26')
      expect(respuesta.total_compromisos).toBe(1)
      expect(registrarAuditoria).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: mockTenantId,
          userId: mockUsuarioId,
          accion: 'UPDATE',
          tabla: 'mediacion_compromisos',
        })
      )
    })

    it('CRITERIO DE ACEPTACIÓN: debe ejecutar rollback compensatorio si falla la inserción de compromisos', async () => {
      const mockMediacionDb = {
        id: mockMediacionId,
        folio: 'MED-2026-0005',
        fecha_programada: fechaMediacion,
        estado: 'en_sesion',
      }

      const mockCompromisosPrevios = [
        { id: 'prev-1', descripcion: 'Acuerdo antiguo que debe restaurarse' },
      ]

      const mockRestoreInsert = jest.fn().mockResolvedValue({ error: null })

      supabase.from = jest.fn((table) => {
        if (table === 'mediaciones') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockMediacionDb, error: null }),
          }
        }
        if (table === 'mediacion_compromisos') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: mockCompromisosPrevios, error: null }),
              }),
            }),
            delete: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null }),
              }),
            }),
            insert: jest.fn((rows) => {
              if (rows === mockCompromisosPrevios) {
                return mockRestoreInsert()
              }
              // Falla intencional en la inserción de nuevos
              return {
                select: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'DB Constraint Violation al guardar compromisos' },
                }),
              }
            }),
          }
        }
        return {}
      })

      await expect(
        mediacionesService.guardarCompromisos(
          mockTenantId,
          mockMediacionId,
          mockUsuarioId,
          validBody
        )
      ).rejects.toThrow(/DB Constraint Violation/i)

      // Verificar que se invocó el restore compensatorio
      expect(mockRestoreInsert).toHaveBeenCalled()
    })

    it('debe retornar 404 si la mediación no existe en el establecimiento', async () => {
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      })

      await expect(
        mediacionesService.guardarCompromisos(
          mockTenantId,
          mockMediacionId,
          mockUsuarioId,
          validBody
        )
      ).rejects.toThrow(/Mediación no encontrada/i)
    })
  })

  // ===========================================================================
  // 3. SERVICIO: listarCompromisos
  // ===========================================================================
  describe('mediacionesService.listarCompromisos', () => {
    it('debe retornar la lista de compromisos de la mediación', async () => {
      const mockCompromisos = [
        {
          id: 'c1',
          tipo_compromiso: 'reparacion_relacional',
          descripcion: 'Disculpa sincera',
          fecha_limite: '2026-10-22',
        },
      ]

      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockCompromisos, error: null }),
      })

      const resultado = await mediacionesService.listarCompromisos(mockTenantId, mockMediacionId)
      expect(resultado).toEqual(mockCompromisos)
    })

    it('debe lanzar error 500 si la base de datos reporta un fallo', async () => {
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: { message: 'Query error' } }),
      })

      await expect(
        mediacionesService.listarCompromisos(mockTenantId, mockMediacionId)
      ).rejects.toThrow(/Error al consultar acuerdos/i)
    })
  })

  // ===========================================================================
  // 4. CONTROLADOR: Handlers Express
  // ===========================================================================
  describe('mediacionesController: Handlers de Compromisos', () => {
    let mockReq, mockRes, mockNext

    beforeEach(() => {
      mockReq = {
        user: { tenant_id: mockTenantId, id: mockUsuarioId },
        params: { id: mockMediacionId },
        body: { compromisos: [{ tipo_compromiso: 'otro', descripcion: 'Prueba', fecha_limite: '2026-10-22' }] },
      }
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      }
      mockNext = jest.fn()
    })

    it('guardarCompromisosHandler debe responder 200 con formato estándar', async () => {
      const mockResultado = { mediacion_id: mockMediacionId, total_compromisos: 1 }
      jest.spyOn(mediacionesService, 'guardarCompromisos').mockResolvedValue(mockResultado)

      await mediacionesController.guardarCompromisosHandler(mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'success',
        message: expect.stringMatching(/exitosamente/i),
        data: mockResultado,
      })
    })

    it('guardarCompromisosHandler debe invocar next con el error capturado', async () => {
      const testError = new Error('Validation error')
      jest.spyOn(mediacionesService, 'guardarCompromisos').mockRejectedValue(testError)

      await mediacionesController.guardarCompromisosHandler(mockReq, mockRes, mockNext)

      expect(mockNext).toHaveBeenCalledWith(testError)
    })

    it('listarCompromisosHandler debe responder 200 con la lista', async () => {
      const mockLista = [{ id: '1', descripcion: 'Acuerdo' }]
      jest.spyOn(mediacionesService, 'listarCompromisos').mockResolvedValue(mockLista)

      await mediacionesController.listarCompromisosHandler(mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'success',
        total: 1,
        data: mockLista,
      })
    })
  })
})
