const {
  registrarAcuerdosMutuos,
  obtenerActaCitacionPDF,
} = require('../../services/citacionesService')
const {
  registrarAcuerdosHandler,
  descargarActaPdfHandler,
} = require('../../controllers/citacionesController')
const { registrarAcuerdosSchema } = require('../../schemas/citacionesValidations')

// Mocks
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}))

jest.mock('../../services/auditoriaService', () => ({
  registrarAuditoria: jest.fn().mockResolvedValue({}),
}))

jest.mock('../../services/emailServiceCitacion', () => ({
  despacharActaOficialCitacion: jest.fn().mockResolvedValue({
    exito: true,
    folio: 'CIT-2026-0088',
    destinatarios: { apoderado: 'apoderado@test.cl' },
  }),
}))

jest.mock('../../services/pdfCitacionActaService', () => ({
  generarActaCitacionPDF: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 test acta')),
  calcularHashActaCitacion: jest.fn().mockReturnValue('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'),
}))

jest.mock('../../utils/db', () => ({
  supabase: {
    from: jest.fn(),
  },
}))

const { supabase: mockSupabase } = require('../../utils/db')
const { despacharActaOficialCitacion } = require('../../services/emailServiceCitacion')
const { generarActaCitacionPDF, calcularHashActaCitacion } = require('../../services/pdfCitacionActaService')
const { registrarAuditoria } = require('../../services/auditoriaService')

const mockTenantId = '11111111-1111-4111-8111-111111111111'
const mockUserId = '22222222-2222-4222-8222-222222222222'
const mockCitacionId = '55555555-5555-4555-8555-555555555555'

describe('TASK 10.2.3 — Endpoints de Acuerdos Mutuos y Cierre de Citación', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('1. Validación de Esquema Zod (registrarAcuerdosSchema)', () => {
    it('debe validar exitosamente un payload correcto de acuerdos mutuos', () => {
      const payload = {
        compromisos_colegio: ['Implementar guía de refuerzo en lectura', 'Evaluación formativa semanal'],
        compromisos_apoderado: ['Establecer rutina de lectura 20 min en el hogar', 'Revisar cuaderno diariamente'],
        fecha_proximo_seguimiento: '2026-11-20',
      }
      const resultado = registrarAcuerdosSchema.safeParse(payload)
      expect(resultado.success).toBe(true)
    })

    it('debe rechazar si falta la lista de compromisos del colegio o apoderado', () => {
      const payload = {
        compromisos_colegio: [],
        compromisos_apoderado: ['Revisar cuaderno'],
      }
      const resultado = registrarAcuerdosSchema.safeParse(payload)
      expect(resultado.success).toBe(false)
      expect(resultado.error.issues[0].message).toContain('al menos un compromiso')
    })

    it('debe validar formato de fecha YYYY-MM-DD para fecha_proximo_seguimiento', () => {
      const payload = {
        compromisos_colegio: ['Refuerzo pedagógico'],
        compromisos_apoderado: ['Rutina de estudio'],
        fecha_proximo_seguimiento: '20-11-2026', // Formato erróneo
      }
      const resultado = registrarAcuerdosSchema.safeParse(payload)
      expect(resultado.success).toBe(false)
    })
  })

  describe('2. Servicio registrarAcuerdosMutuos', () => {
    it('debe registrar acuerdos, actualizar a realizada, generar PDF y disparar despacho', async () => {
      const mockCitacion = {
        id: mockCitacionId,
        tenant_id: mockTenantId,
        folio: 'CIT-2026-0042',
        estado: 'confirmada',
        estudiantes: { nombre: 'Vicente', apellido: 'Pérez', cursos: { nombre: '5° Básico A' } },
        apoderados: { nombre: 'Carla', email: 'carla@familia.cl' },
      }

      const mockAcuerdosGuardados = {
        id: 'acuerdo-uuid-1',
        citacion_id: mockCitacionId,
        tenant_id: mockTenantId,
        compromisos_colegio: ['Tutoría de aula'],
        compromisos_apoderado: ['Acompañamiento en tareas'],
        fecha_proximo_seguimiento: '2026-11-25',
        hash_sha256: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      }

      mockSupabase.from.mockImplementation((tabla) => {
        if (tabla === 'citaciones_formativas') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockCitacion, error: null }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { id: mockCitacionId, folio: 'CIT-2026-0042', estado: 'realizada' },
                error: null,
              }),
            }),
          }
        }
        if (tabla === 'citacion_acuerdos_mutuos') {
          return {
            upsert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: mockAcuerdosGuardados, error: null }),
            }),
          }
        }
        return { select: jest.fn().mockReturnThis() }
      })

      const body = {
        compromisos_colegio: ['Tutoría de aula'],
        compromisos_apoderado: ['Acompañamiento en tareas'],
        fecha_proximo_seguimiento: '2026-11-25',
      }

      const res = await registrarAcuerdosMutuos(mockTenantId, mockCitacionId, mockUserId, body)

      expect(res.acuerdos).toEqual(mockAcuerdosGuardados)
      expect(res.citacion.estado).toBe('realizada')
      expect(calcularHashActaCitacion).toHaveBeenCalled()
      expect(generarActaCitacionPDF).toHaveBeenCalled()
      expect(despacharActaOficialCitacion).toHaveBeenCalledWith(
        mockCitacionId,
        mockTenantId,
        expect.any(Buffer),
        mockAcuerdosGuardados
      )
      expect(registrarAuditoria).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'CIERRE_CITACION_ACUERDOS',
          tabla: 'citacion_acuerdos_mutuos',
        })
      )
    })

    it('debe arrojar 404 si la citación no existe en el tenant', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      })

      await expect(
        registrarAcuerdosMutuos(mockTenantId, 'cit-inexistente', mockUserId, {
          compromisos_colegio: ['Compromiso 1'],
          compromisos_apoderado: ['Compromiso 2'],
        })
      ).rejects.toThrow('Citación no encontrada en este establecimiento')
    })

    it('debe arrojar 400 si la citación se encuentra cancelada', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockCitacionId, estado: 'cancelada' },
          error: null,
        }),
      })

      await expect(
        registrarAcuerdosMutuos(mockTenantId, mockCitacionId, mockUserId, {
          compromisos_colegio: ['Compromiso 1'],
          compromisos_apoderado: ['Compromiso 2'],
        })
      ).rejects.toThrow('No se pueden registrar acuerdos para una citación cancelada')
    })
  })

  describe('3. Servicio obtenerActaCitacionPDF', () => {
    it('debe retornar el buffer binario y el folio del acta de citación', async () => {
      const mockCitacion = {
        id: mockCitacionId,
        folio: 'CIT-2026-0042',
      }
      const mockAcuerdos = {
        id: 'acuerdo-1',
        compromisos_colegio: ['Refuerzo'],
        compromisos_apoderado: ['Hábitos'],
      }

      mockSupabase.from.mockImplementation((tabla) => {
        if (tabla === 'citaciones_formativas') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockCitacion, error: null }),
          }
        }
        if (tabla === 'citacion_acuerdos_mutuos') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockAcuerdos, error: null }),
          }
        }
      })

      const resultado = await obtenerActaCitacionPDF(mockTenantId, mockCitacionId)

      expect(resultado.folio).toBe('CIT-2026-0042')
      expect(resultado.pdfBuffer).toBeInstanceOf(Buffer)
      expect(generarActaCitacionPDF).toHaveBeenCalledWith(mockCitacion, mockAcuerdos)
    })

    it('debe arrojar 404 si la citación aún no tiene acuerdos registrados', async () => {
      mockSupabase.from.mockImplementation((tabla) => {
        if (tabla === 'citaciones_formativas') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: { id: mockCitacionId }, error: null }),
          }
        }
        if (tabla === 'citacion_acuerdos_mutuos') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          }
        }
      })

      await expect(obtenerActaCitacionPDF(mockTenantId, mockCitacionId)).rejects.toThrow(
        'Esta citación no cuenta con acuerdos registrados ni acta oficial emitida'
      )
    })
  })

  describe('4. Controladores HTTP (citacionesController.js)', () => {
    it('registrarAcuerdosHandler debe responder con código 201 y mensaje formal', async () => {
      const req = {
        user: { tenant_id: mockTenantId, id: mockUserId },
        params: { id: mockCitacionId },
        body: {
          compromisos_colegio: ['Refuerzo'],
          compromisos_apoderado: ['Rutina'],
        },
      }
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      }
      const next = jest.fn()

      mockSupabase.from.mockImplementation((tabla) => {
        if (tabla === 'citaciones_formativas') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: mockCitacionId, folio: 'CIT-2026-0099', estado: 'confirmada' },
              error: null,
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { id: mockCitacionId, folio: 'CIT-2026-0099', estado: 'realizada' },
                error: null,
              }),
            }),
          }
        }
        if (tabla === 'citacion_acuerdos_mutuos') {
          return {
            upsert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { id: 'ac-1', citacion_id: mockCitacionId },
                error: null,
              }),
            }),
          }
        }
      })

      await registrarAcuerdosHandler(req, res, next)

      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          message: 'Acuerdos mutuos registrados y acta oficial emitida exitosamente',
        })
      )
      expect(next).not.toHaveBeenCalled()
    })

    it('descargarActaPdfHandler debe enviar el PDF con cabeceras correctas', async () => {
      const req = {
        user: { tenant_id: mockTenantId },
        params: { id: mockCitacionId },
      }
      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      }
      const next = jest.fn()

      mockSupabase.from.mockImplementation((tabla) => {
        if (tabla === 'citaciones_formativas') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: mockCitacionId, folio: 'CIT-2026-0042' },
              error: null,
            }),
          }
        }
        if (tabla === 'citacion_acuerdos_mutuos') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: 'ac-1', citacion_id: mockCitacionId },
              error: null,
            }),
          }
        }
      })

      await descargarActaPdfHandler(req, res, next)

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf')
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'inline; filename="Acta_Citacion_CIT-2026-0042.pdf"'
      )
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.send).toHaveBeenCalledWith(expect.any(Buffer))
      expect(next).not.toHaveBeenCalled()
    })
  })
})
