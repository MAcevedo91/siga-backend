const {
  validarDisponibilidadDocente,
  crearCitacion,
  obtenerCitacionPublicaPorToken,
  responderCitacionPublica,
  listarCitaciones,
} = require('../../services/citacionesService')
const {
  crearCitacionHandler,
  obtenerCitacionPublicaHandler,
  responderCitacionPublicaHandler,
} = require('../../controllers/citacionesController')
const {
  crearCitacionSchema,
  responderCitacionPublicaSchema,
} = require('../../schemas/citacionesValidations')

// Mocks
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}))

jest.mock('../../services/auditoriaService', () => ({
  registrarAuditoria: jest.fn().mockResolvedValue({}),
}))

jest.mock('../../services/emailService', () => ({
  enviarEmail: jest.fn().mockResolvedValue({ id: 'job-123' }),
}))

jest.mock('../../utils/db', () => ({
  supabase: {
    from: jest.fn(),
  },
}))

const { supabase: mockSupabase } = require('../../utils/db')
const emailService = require('../../services/emailService')

const mockTenantId = '11111111-1111-4111-8111-111111111111'
const mockDocenteId = '22222222-2222-4222-8222-222222222222'
const mockEstudianteId = '33333333-3333-4333-8333-333333333333'
const mockApoderadoId = '44444444-4444-4444-8444-444444444444'
const mockCitacionId = '55555555-5555-4555-8555-555555555555'
const mockToken = '66666666-6666-4666-8666-666666666666'

describe('TASK 10.1.2 — Endpoints de Programación y Confirmación Móvil sin Login', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('1. Validación de Esquemas Zod (citacionesValidations.js)', () => {
    it('debe validar exitosamente un payload correcto de citación', () => {
      const validPayload = {
        estudiante_id: mockEstudianteId,
        apoderado_id: mockApoderadoId,
        motivo_categoria: 'refuerzo_academico',
        motivo_detalle: 'Revisión colaborativa de avances pedagógicos en lenguaje',
        fecha_hora_programada: '2026-11-10T10:30:00.000Z',
        lugar_entrevista: 'Oficina de Coordinación',
        modalidad: 'presencial',
      }
      const parsed = crearCitacionSchema.safeParse(validPayload)
      expect(parsed.success).toBe(true)
    })

    it('debe rechazar categoría de motivo no válida o motivo demasiado breve', () => {
      const invalidPayload = {
        estudiante_id: mockEstudianteId,
        apoderado_id: mockApoderadoId,
        motivo_categoria: 'categoria_inexistente',
        motivo_detalle: 'corto',
        fecha_hora_programada: '2026-11-10T10:30:00.000Z',
      }
      const parsed = crearCitacionSchema.safeParse(invalidPayload)
      expect(parsed.success).toBe(false)
      const issues = parsed.error.issues || parsed.error.errors || []
      expect(issues.some((e) => e.path.includes('motivo_categoria'))).toBe(true)
      expect(issues.some((e) => e.path.includes('motivo_detalle'))).toBe(true)
    })

    it('debe validar la respuesta del apoderado y exigir motivo si justifica o reprograma', () => {
      const validConfirmar = {
        token: mockToken,
        accion: 'confirmar',
      }
      expect(responderCitacionPublicaSchema.safeParse(validConfirmar).success).toBe(true)

      const invalidJustificar = {
        token: mockToken,
        accion: 'justificar',
        comentario: '',
      }
      expect(responderCitacionPublicaSchema.safeParse(invalidJustificar).success).toBe(false)
    })
  })

  describe('2. Validación de Disponibilidad Horaria del Docente', () => {
    it('debe permitir agendar si el docente no tiene citaciones en el bloque horario', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              in: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  lte: jest.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        }),
      })

      const disponible = await validarDisponibilidadDocente(
        mockTenantId,
        mockDocenteId,
        '2026-11-10T11:00:00.000Z'
      )
      expect(disponible).toBe(true)
    })

    it('debe arrojar 409 Conflict si el docente tiene una citación con traslape (<45 min)', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              in: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  lte: jest.fn().mockResolvedValue({
                    data: [{ id: 'colision-1', folio: 'CIT-2026-0005', estado: 'programada' }],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      })

      await expect(
        validarDisponibilidadDocente(mockTenantId, mockDocenteId, '2026-11-10T11:15:00.000Z')
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'DOCENTE_HORARIO_OCUPADO',
        message: expect.stringMatching(/CIT-2026-0005/i),
      })
    })
  })

  describe('3. Programación de Citación (crearCitacion)', () => {
    it('debe registrar citación, generar token a 72h y encolar email al apoderado', async () => {
      mockSupabase.from.mockImplementation((tabla) => {
        if (tabla === 'citaciones_formativas') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  in: jest.fn().mockReturnValue({
                    gte: jest.fn().mockReturnValue({
                      lte: jest.fn().mockResolvedValue({ data: [], error: null }),
                    }),
                  }),
                }),
              }),
            }),
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: mockCitacionId,
                    folio: 'CIT-2026-0001',
                    motivo_categoria: 'refuerzo_academico',
                    motivo_detalle: 'Revisión colaborativa de avances pedagógicos',
                    fecha_hora_programada: '2026-11-10T10:00:00.000Z',
                    token_confirmacion: mockToken,
                    token_expira_at: '2026-11-13T10:00:00.000Z',
                    estado: 'programada',
                  },
                  error: null,
                }),
              }),
            }),
          }
        }
        if (tabla === 'estudiantes') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { id: mockEstudianteId, nombre: 'Matías', apellido: 'Pérez' },
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }
        if (tabla === 'apoderados') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: mockApoderadoId, nombre: 'Carlos', apellido: 'Pérez', email: 'carlos@ejemplo.com' },
                  error: null,
                }),
              }),
            }),
          }
        }
      })

      const resultado = await crearCitacion(mockTenantId, mockDocenteId, {
        estudiante_id: mockEstudianteId,
        apoderado_id: mockApoderadoId,
        motivo_categoria: 'refuerzo_academico',
        motivo_detalle: 'Revisión colaborativa de avances pedagógicos',
        fecha_hora_programada: '2026-11-10T10:00:00.000Z',
      })

      expect(resultado).toBeDefined()
      expect(resultado.folio).toBe('CIT-2026-0001')
      expect(resultado.token_confirmacion).toBe(mockToken)
      expect(emailService.enviarEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'carlos@ejemplo.com',
          subject: expect.stringMatching(/Convocatoria a Entrevista Formativa/i),
        })
      )
    })
  })

  describe('4. Consulta Pública por Token (obtenerCitacionPublicaPorToken)', () => {
    it('debe retornar datos sanitizados protegidos de la citación para el móvil del apoderado', async () => {
      const fechaFutura72h = new Date(Date.now() + 48 * 3600 * 1000).toISOString()
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: mockCitacionId,
                folio: 'CIT-2026-0001',
                motivo_categoria: 'refuerzo_academico',
                motivo_detalle: 'Revisión formativa',
                fecha_hora_programada: '2026-11-10T10:00:00.000Z',
                lugar_entrevista: 'Sala de Convivencia',
                modalidad: 'presencial',
                estado: 'programada',
                token_expira_at: fechaFutura72h,
                estudiantes: { nombre: 'Matías', apellido: 'Pérez', cursos: { nombre: '7° Básico A' } },
                apoderados: { nombre: 'Carlos', apellido: 'Pérez' },
                usuarios: { nombre: 'Profesor', apellido: 'González' },
              },
              error: null,
            }),
          }),
        }),
      })

      const citacion = await obtenerCitacionPublicaPorToken(mockToken)
      expect(citacion.folio).toBe('CIT-2026-0001')
      expect(citacion.estudiante.nombre).toBe('Matías')
      expect(citacion.estudiante.curso).toBe('7° Básico A')
      // Verifica que no se expone RUT ni datos sensibles
      expect(citacion.estudiante.rut).toBeUndefined()
    })

    it('debe arrojar 404 si el token no existe', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          }),
        }),
      })

      await expect(obtenerCitacionPublicaPorToken(mockToken)).rejects.toMatchObject({
        statusCode: 404,
      })
    })

    it('debe arrojar 410 si el token ha expirado (más de 72 horas)', async () => {
      const fechaPasada = new Date(Date.now() - 5 * 3600 * 1000).toISOString()
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: mockCitacionId,
                token_expira_at: fechaPasada,
                estado: 'programada',
              },
              error: null,
            }),
          }),
        }),
      })

      await expect(obtenerCitacionPublicaPorToken(mockToken)).rejects.toMatchObject({
        statusCode: 410,
        code: 'TOKEN_EXPIRADO',
      })
    })
  })

  describe('5. Respuesta Pública del Apoderado (responderCitacionPublica)', () => {
    it('debe confirmar asistencia en 1-clic y actualizar estado a confirmada', async () => {
      const fechaFutura72h = new Date(Date.now() + 48 * 3600 * 1000).toISOString()
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: mockCitacionId,
                tenant_id: mockTenantId,
                folio: 'CIT-2026-0001',
                estado: 'programada',
                token_expira_at: fechaFutura72h,
                docente_id: mockDocenteId,
              },
              error: null,
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: mockCitacionId,
                  folio: 'CIT-2026-0001',
                  estado: 'confirmada',
                  fecha_respuesta_apoderado: new Date().toISOString(),
                },
                error: null,
              }),
            }),
          }),
        }),
      })

      const res = await responderCitacionPublica({
        token: mockToken,
        accion: 'confirmar',
      })

      expect(res.mensaje).toMatch(/confirmada exitosamente/i)
      expect(res.citacion.estado).toBe('confirmada')
    })

    it('debe registrar solicitud de reprogramación con nueva fecha propuesta', async () => {
      const fechaFutura72h = new Date(Date.now() + 48 * 3600 * 1000).toISOString()
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: mockCitacionId,
                tenant_id: mockTenantId,
                folio: 'CIT-2026-0001',
                estado: 'programada',
                token_expira_at: fechaFutura72h,
                docente_id: mockDocenteId,
              },
              error: null,
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: mockCitacionId,
                  folio: 'CIT-2026-0001',
                  estado: 'reprogramacion_solicitada',
                  nueva_fecha_solicitada: '2026-11-12T15:00:00.000Z',
                  comentario_apoderado: 'Trabajo hasta las 14:00',
                },
                error: null,
              }),
            }),
          }),
        }),
      })

      const res = await responderCitacionPublica({
        token: mockToken,
        accion: 'reprogramar',
        nueva_fecha_solicitada: '2026-11-12T15:00:00.000Z',
        comentario: 'Trabajo hasta las 14:00',
      })

      expect(res.mensaje).toMatch(/reprogramación/i)
      expect(res.citacion.estado).toBe('reprogramacion_solicitada')
    })

    it('debe rechazar respuesta si la citación ya fue realizada o cancelada', async () => {
      const fechaFutura72h = new Date(Date.now() + 48 * 3600 * 1000).toISOString()
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: mockCitacionId,
                estado: 'realizada',
                token_expira_at: fechaFutura72h,
              },
              error: null,
            }),
          }),
        }),
      })

      await expect(
        responderCitacionPublica({
          token: mockToken,
          accion: 'confirmar',
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringMatching(/no admite/i),
      })
    })
  })

  describe('6. Controladores Express', () => {
    it('crearCitacionHandler debe responder HTTP 201', async () => {
      mockSupabase.from.mockImplementation((tabla) => {
        if (tabla === 'citaciones_formativas') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  in: jest.fn().mockReturnValue({
                    gte: jest.fn().mockReturnValue({
                      lte: jest.fn().mockResolvedValue({ data: [], error: null }),
                    }),
                  }),
                }),
              }),
            }),
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: mockCitacionId, folio: 'CIT-2026-0001', estado: 'programada' },
                  error: null,
                }),
              }),
            }),
          }
        }
        if (tabla === 'estudiantes') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: { id: mockEstudianteId }, error: null }),
                }),
              }),
            }),
          }
        }
        if (tabla === 'apoderados') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: { id: mockApoderadoId, email: null }, error: null }),
              }),
            }),
          }
        }
      })

      const req = {
        user: { tenant_id: mockTenantId, id: mockDocenteId },
        body: {
          estudiante_id: mockEstudianteId,
          apoderado_id: mockApoderadoId,
          motivo_categoria: 'refuerzo_academico',
          motivo_detalle: 'Revisión colaborativa de avances pedagógicos',
          fecha_hora_programada: '2026-11-10T10:00:00.000Z',
        },
      }
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      }
      const next = jest.fn()

      await crearCitacionHandler(req, res, next)
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success', data: expect.objectContaining({ id: mockCitacionId }) })
      )
    })

    it('obtenerCitacionPublicaHandler debe responder HTTP 200 con datos sanitizados', async () => {
      const fechaFutura72h = new Date(Date.now() + 48 * 3600 * 1000).toISOString()
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: mockCitacionId,
                folio: 'CIT-2026-0001',
                motivo_categoria: 'refuerzo_academico',
                motivo_detalle: 'Revisión formativa',
                fecha_hora_programada: '2026-11-10T10:00:00.000Z',
                estado: 'programada',
                token_expira_at: fechaFutura72h,
                estudiantes: { nombre: 'Matías', apellido: 'Pérez' },
                apoderados: { nombre: 'Carlos' },
                usuarios: { nombre: 'Profesor' },
              },
              error: null,
            }),
          }),
        }),
      })

      const req = { params: { token: mockToken } }
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      }
      const next = jest.fn()

      await obtenerCitacionPublicaHandler(req, res, next)
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success', data: expect.objectContaining({ folio: 'CIT-2026-0001' }) })
      )
    })

    it('responderCitacionPublicaHandler debe responder HTTP 200', async () => {
      const fechaFutura72h = new Date(Date.now() + 48 * 3600 * 1000).toISOString()
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: mockCitacionId,
                tenant_id: mockTenantId,
                folio: 'CIT-2026-0001',
                estado: 'programada',
                token_expira_at: fechaFutura72h,
                docente_id: mockDocenteId,
              },
              error: null,
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: mockCitacionId, estado: 'confirmada' },
                error: null,
              }),
            }),
          }),
        }),
      })

      const req = {
        body: { token: mockToken, accion: 'confirmar' },
      }
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      }
      const next = jest.fn()

      await responderCitacionPublicaHandler(req, res, next)
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success' })
      )
    })
  })
})
