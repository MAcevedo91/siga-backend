const {
  obtenerMetricasCitaciones,
  obtenerHistorialCitacionesEstudiante,
} = require('../../services/citacionesService')
const {
  obtenerMetricasHandler,
  obtenerHistorialEstudianteHandler,
} = require('../../controllers/citacionesController')
const {
  metricasFiltrosSchema,
  estudianteIdParamSchema,
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

jest.mock('../../utils/db', () => ({
  supabase: {
    from: jest.fn(),
  },
}))

const { supabase: mockSupabase } = require('../../utils/db')

const mockTenantId = '11111111-1111-4111-8111-111111111111'
const mockEstudianteId = '33333333-3333-4333-8333-333333333333'
const mockDocenteId = '22222222-2222-4222-8222-222222222222'

describe('TASK 10.3.1 — Endpoints de Analítica de Adherencia Parental y Consulta de Historial', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('1. Validaciones de Esquemas Zod', () => {
    it('debe validar exitosamente filtros de métricas válidos', () => {
      const payload = {
        fecha_desde: '2026-11-01',
        fecha_hasta: '2026-11-30',
        docente_id: mockDocenteId,
      }
      const resultado = metricasFiltrosSchema.safeParse(payload)
      expect(resultado.success).toBe(true)
    })

    it('debe permitir filtros de métricas vacíos', () => {
      const resultado = metricasFiltrosSchema.safeParse({})
      expect(resultado.success).toBe(true)
    })

    it('debe rechazar fechas inválidas en filtros de métricas', () => {
      const resultado = metricasFiltrosSchema.safeParse({ fecha_desde: 'fecha-invalida' })
      expect(resultado.success).toBe(false)
      expect(resultado.error.issues[0].message).toContain('fecha válida')
    })

    it('debe validar exitosamente un UUID v4 de estudiante', () => {
      const resultado = estudianteIdParamSchema.safeParse({ estudianteId: mockEstudianteId })
      expect(resultado.success).toBe(true)
    })

    it('debe rechazar un ID de estudiante no UUID', () => {
      const resultado = estudianteIdParamSchema.safeParse({ estudianteId: '123-no-uuid' })
      expect(resultado.success).toBe(false)
      expect(resultado.error.issues[0].message).toContain('UUID válido')
    })
  })

  describe('2. Servicio obtenerMetricasCitaciones', () => {
    it('debe calcular métricas agregadas, tasa de asistencia y distribución de motivos', async () => {
      const mockCitaciones = [
        {
          id: 'cit-1',
          folio: 'CIT-2026-0001',
          estado: 'realizada',
          motivo_categoria: 'refuerzo_academico',
          fecha_hora_programada: '2026-11-05T10:00:00Z',
          fecha_respuesta_apoderado: '2026-11-04T12:00:00Z',
        },
        {
          id: 'cit-2',
          folio: 'CIT-2026-0002',
          estado: 'realizada',
          motivo_categoria: 'habitos_asistencia',
          fecha_hora_programada: '2026-11-06T11:00:00Z',
          fecha_respuesta_apoderado: '2026-11-05T09:00:00Z',
        },
        {
          id: 'cit-3',
          folio: 'CIT-2026-0003',
          estado: 'no_asiste',
          motivo_categoria: 'refuerzo_academico',
          fecha_hora_programada: '2026-11-07T14:00:00Z',
          fecha_respuesta_apoderado: null,
        },
        {
          id: 'cit-4',
          folio: 'CIT-2026-0004',
          estado: 'confirmada',
          motivo_categoria: 'acuerdos_convivencia',
          fecha_hora_programada: '2026-11-12T09:30:00Z',
          fecha_respuesta_apoderado: '2026-11-08T15:00:00Z',
        },
      ]

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        then: (resolve) => resolve({ data: mockCitaciones, error: null }),
      }

      const mockAcuerdosBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: (resolve) => resolve({ count: 2, error: null }),
      }

      mockSupabase.from.mockImplementation((tabla) => {
        if (tabla === 'citaciones_formativas') return mockQueryBuilder
        if (tabla === 'citacion_acuerdos_mutuos') return mockAcuerdosBuilder
        return { select: jest.fn().mockReturnThis() }
      })

      const metricas = await obtenerMetricasCitaciones(mockTenantId, {
        fecha_desde: '2026-11-01',
        fecha_hasta: '2026-11-30',
      })

      // Totales
      expect(metricas.totales.total_convocadas).toBe(4)
      expect(metricas.totales.realizadas).toBe(2)
      expect(metricas.totales.no_asiste).toBe(1)
      expect(metricas.totales.confirmadas).toBe(1)

      // Tasas
      // Asistencia efectiva = 2 / (2 + 1) = 66.7%
      expect(metricas.tasas.asistencia_efectiva).toBe(66.7)
      // Adherencia temprana = 3 respondieron / 4 total = 75.0%
      expect(metricas.tasas.adherencia_parental).toBe(75.0)
      // Efectividad acuerdos = 2 acuerdos / 2 realizadas = 100.0%
      expect(metricas.tasas.efectividad_acuerdos).toBe(100.0)

      // Distribución motivos
      expect(metricas.distribucion_motivos.refuerzo_academico.cantidad).toBe(2)
      expect(metricas.distribucion_motivos.refuerzo_academico.porcentaje).toBe(50.0)
      expect(metricas.distribucion_motivos.habitos_asistencia.cantidad).toBe(1)
      expect(metricas.distribucion_motivos.acuerdos_convivencia.cantidad).toBe(1)
      expect(metricas.ranking_motivos[0].motivo).toBe('refuerzo_academico')
    })

    it('debe manejar grácilmente un colegio con 0 citaciones sin producir NaN o división por cero', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: (resolve) => resolve({ data: [], error: null }),
      }
      const mockAcuerdosBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: (resolve) => resolve({ count: 0, error: null }),
      }

      mockSupabase.from.mockImplementation((tabla) => {
        if (tabla === 'citaciones_formativas') return mockQueryBuilder
        if (tabla === 'citacion_acuerdos_mutuos') return mockAcuerdosBuilder
        return { select: jest.fn().mockReturnThis() }
      })

      const metricas = await obtenerMetricasCitaciones(mockTenantId, {})

      expect(metricas.totales.total_convocadas).toBe(0)
      expect(metricas.tasas.asistencia_efectiva).toBe(0)
      expect(metricas.tasas.adherencia_parental).toBe(0)
      expect(metricas.tasas.efectividad_acuerdos).toBe(0)
      expect(metricas.distribucion_motivos.refuerzo_academico.cantidad).toBe(0)
      expect(metricas.distribucion_motivos.refuerzo_academico.porcentaje).toBe(0)
    })

    it('debe retornar estructura base en cero si la tabla aún no existe (error 42P01)', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: (resolve) => resolve({ data: null, error: { code: '42P01', message: 'relation does not exist' } }),
      }

      mockSupabase.from.mockReturnValue(mockQueryBuilder)

      const metricas = await obtenerMetricasCitaciones(mockTenantId, {})
      expect(metricas.totales.total_convocadas).toBe(0)
      expect(metricas.tasas.asistencia_efectiva).toBe(0)
    })

    it('debe lanzar error 500 ante un fallo inesperado de base de datos', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: (resolve) => resolve({ data: null, error: { code: '50000', message: 'Connection timeout' } }),
      }

      mockSupabase.from.mockReturnValue(mockQueryBuilder)

      await expect(obtenerMetricasCitaciones(mockTenantId, {})).rejects.toThrow(
        'Error al consultar métricas de citaciones'
      )
    })
  })

  describe('3. Servicio obtenerHistorialCitacionesEstudiante', () => {
    it('debe retornar el historial cronológico con actas descargables y métricas del estudiante', async () => {
      const mockEstudiante = {
        id: mockEstudianteId,
        nombre: 'Sofía',
        apellido: 'Valenzuela',
        rut: '22.333.444-5',
        curso_id: 'curso-1',
        cursos: { id: 'curso-1', nombre: '8° Básico A' },
      }

      const mockCitaciones = [
        {
          id: 'cit-10',
          folio: 'CIT-2026-0010',
          motivo_categoria: 'refuerzo_academico',
          motivo_detalle: 'Acuerdos en comprensión lectora',
          fecha_hora_programada: '2026-11-05T10:00:00Z',
          lugar_entrevista: 'Sala Convivencia',
          modalidad: 'presencial',
          enlace_virtual: null,
          estado: 'realizada',
          fecha_respuesta_apoderado: '2026-11-03T11:00:00Z',
          comentario_apoderado: 'Asistiré puntualmente',
          nueva_fecha_solicitada: null,
          conclusiones_entrevista: 'Se establecen compromisos',
          realizada_at: '2026-11-05T10:45:00Z',
          created_at: '2026-11-01T08:00:00Z',
          apoderados: {
            id: 'apo-1',
            nombre: 'Claudia',
            apellido: 'Muñoz',
            email: 'claudia@test.cl',
            telefono: '+56911112222',
          },
          usuarios: {
            id: mockDocenteId,
            nombre: 'Profesor',
            apellido: 'Carlos',
            email: 'docente@test.cl',
          },
          citacion_acuerdos_mutuos: {
            id: 'acu-1',
            compromisos_colegio: ['Guía de ejercicios semanal'],
            compromisos_apoderado: ['Revisión diaria del cuaderno'],
            observaciones_pedagogicas: 'Excelente disposición familiar',
            fecha_proximo_seguimiento: '2026-12-01',
            hash_sha256: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
            creado_en: '2026-11-05T10:45:00Z',
          },
        },
        {
          id: 'cit-11',
          folio: 'CIT-2026-0011',
          motivo_categoria: 'habitos_asistencia',
          motivo_detalle: 'Revisión de atrasos reiterados',
          fecha_hora_programada: '2026-10-15T09:00:00Z',
          lugar_entrevista: 'Inspectoría',
          modalidad: 'presencial',
          enlace_virtual: null,
          estado: 'no_asiste',
          fecha_respuesta_apoderado: null,
          comentario_apoderado: null,
          nueva_fecha_solicitada: null,
          conclusiones_entrevista: null,
          realizada_at: null,
          created_at: '2026-10-10T08:00:00Z',
          apoderados: {
            id: 'apo-1',
            nombre: 'Claudia',
            apellido: 'Muñoz',
            email: 'claudia@test.cl',
          },
          usuarios: {
            id: mockDocenteId,
            nombre: 'Profesor',
            apellido: 'Carlos',
          },
          citacion_acuerdos_mutuos: null,
        },
      ]

      mockSupabase.from.mockImplementation((tabla) => {
        if (tabla === 'estudiantes') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockEstudiante, error: null }),
          }
        }
        if (tabla === 'citaciones_formativas') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({ data: mockCitaciones, error: null }),
          }
        }
        return { select: jest.fn().mockReturnThis() }
      })

      const resultado = await obtenerHistorialCitacionesEstudiante(mockTenantId, mockEstudianteId)

      expect(resultado.estudiante.nombre).toBe('Sofía')
      expect(resultado.metricas_estudiante.total_citaciones).toBe(2)
      expect(resultado.metricas_estudiante.realizadas).toBe(1)
      expect(resultado.metricas_estudiante.no_asiste).toBe(1)
      // Tasa asistencia = 1 / 2 = 50%
      expect(resultado.metricas_estudiante.tasa_asistencia).toBe(50.0)
      expect(resultado.metricas_estudiante.compromisos_vigentes).toBe(1)

      expect(resultado.citaciones.length).toBe(2)

      // Primera citación con acta oficial disponible
      const citConActa = resultado.citaciones[0]
      expect(citConActa.folio).toBe('CIT-2026-0010')
      expect(citConActa.tiene_acta).toBe(true)
      expect(citConActa.acta_pdf_url).toBe('/api/citaciones/cit-10/acta-pdf')
      expect(citConActa.acuerdos.hash_sha256).toBe(
        'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'
      )

      // Segunda citación sin acta
      const citSinActa = resultado.citaciones[1]
      expect(citSinActa.folio).toBe('CIT-2026-0011')
      expect(citSinActa.tiene_acta).toBe(false)
      expect(citSinActa.acta_pdf_url).toBeNull()
    })

    it('debe arrojar error 404 si el estudiante no existe en el establecimiento (tenant)', async () => {
      mockSupabase.from.mockImplementation((tabla) => {
        if (tabla === 'estudiantes') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          }
        }
        return { select: jest.fn().mockReturnThis() }
      })

      await expect(
        obtenerHistorialCitacionesEstudiante(mockTenantId, mockEstudianteId)
      ).rejects.toThrow('Estudiante no encontrado en el establecimiento')
    })

    it('debe arrojar error 400 si el estudianteId es inválido', async () => {
      await expect(
        obtenerHistorialCitacionesEstudiante(mockTenantId, 'id-invalido')
      ).rejects.toThrow('UUID válido')
    })
  })

  describe('4. Controladores HTTP (Handlers)', () => {
    it('obtenerMetricasHandler debe responder HTTP 200 con formato estándar', async () => {
      const mockReq = {
        user: { tenant_id: mockTenantId },
        query: { fecha_desde: '2026-11-01' },
      }
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      }
      const mockNext = jest.fn()

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        then: (resolve) => resolve({ data: [], error: null }),
      }
      mockSupabase.from.mockReturnValue(mockQueryBuilder)

      await obtenerMetricasHandler(mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: expect.any(Object),
        })
      )
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('obtenerHistorialEstudianteHandler debe responder HTTP 200 con formato estándar', async () => {
      const mockReq = {
        user: { tenant_id: mockTenantId },
        params: { estudianteId: mockEstudianteId },
      }
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      }
      const mockNext = jest.fn()

      mockSupabase.from.mockImplementation((tabla) => {
        if (tabla === 'estudiantes') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: mockEstudianteId, nombre: 'Ana' },
              error: null,
            }),
          }
        }
        if (tabla === 'citaciones_formativas') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({ data: [], error: null }),
          }
        }
        return { select: jest.fn().mockReturnThis() }
      })

      await obtenerHistorialEstudianteHandler(mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: expect.any(Object),
        })
      )
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('debe capturar errores y delegarlos al middleware de error vía next', async () => {
      const mockReq = {
        user: { tenant_id: mockTenantId },
        params: { estudianteId: 'formato-invalido' },
      }
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      }
      const mockNext = jest.fn()

      await obtenerHistorialEstudianteHandler(mockReq, mockRes, mockNext)

      expect(mockNext).toHaveBeenCalled()
      const errorPasado = mockNext.mock.calls[0][0]
      expect(errorPasado.statusCode).toBe(400)
    })
  })
})
