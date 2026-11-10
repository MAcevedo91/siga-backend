jest.mock('../../../src/utils/db', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn()
  }
}))

jest.mock('../../../src/services/reporteMensualPdfService', () => ({
  compilarReporteMensualPDF: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 test pdf buffer'))
}))

const { supabase } = require('../../../src/utils/db')
const { compilarReporteMensualPDF } = require('../../../src/services/reporteMensualPdfService')
const analyticsController = require('../../../src/controllers/analyticsController')

describe('Analytics Controller', () => {
  let req, res

  beforeEach(() => {
    req = {
      user: { id: 1, tenant_id: 'tenant-123' },
      query: {}
    }
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('getResumen', () => {
    it('debe retornar resumen de incidentes del mes', async () => {
      // Create separate chains for each query
      const mockChain1 = {
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockResolvedValue({ count: 42, error: null })
      }

      const mockChain2 = {
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockResolvedValue({ count: 30, error: null })
      }

      const mockChain3 = {
        eq: jest.fn().mockReturnThis()
      }
      // Second eq() call returns the final promise
      mockChain3.eq.mockReturnValueOnce(mockChain3).mockResolvedValueOnce({ count: 10, error: null })

      supabase.from
        .mockReturnValueOnce({ select: jest.fn().mockReturnValue(mockChain1) })  // totalIncidentes
        .mockReturnValueOnce({ select: jest.fn().mockReturnValue(mockChain2) })  // totalPrevMonth
        .mockReturnValueOnce({ select: jest.fn().mockReturnValue(mockChain3) })  // abiertos

      // Mock RPC for estudiantes riesgo
      supabase.rpc.mockResolvedValue({ data: 5, error: null })

      await analyticsController.getResumen(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          totalIncidentes: expect.any(Number),
          variacion: expect.any(Number),
          abiertos: expect.any(Number),
          estudiantesRiesgo: expect.any(Number)
        })
      })
    })

    it('debe manejar errores correctamente', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockRejectedValue(new Error('DB error'))
      }

      supabase.from.mockReturnValue(mockChain)

      await analyticsController.getResumen(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Error al obtener resumen de analytics'
      })
    })
  })

  describe('getUsuariosActividad', () => {
    it('debe retornar lista de usuarios con conteo de incidentes reportados y porcentajes', async () => {
      const mockUsuarios = [
        { id: 'u1', nombre: 'Juan', apellido: 'Pérez', email: 'juan@liceo.cl', rol: 'Docente', activo: true, fecha_creacion: '2026-01-01' },
        { id: 'u2', nombre: 'Ana', apellido: 'Gómez', email: 'ana@liceo.cl', rol: 'Inspector', activo: true, fecha_creacion: '2026-01-01' }
      ]

      const mockIncidentes = [
        { id: 'i1', usuario_id: 'u1', fecha: '2026-10-10', fecha_creacion: '2026-10-10' },
        { id: 'i2', usuario_id: 'u1', fecha: '2026-10-15', fecha_creacion: '2026-10-15' },
        { id: 'i3', usuario_id: 'u2', fecha: '2026-10-12', fecha_creacion: '2026-10-12' }
      ]

      // Mock para la consulta de usuarios
      const mockChainUsuarios = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockUsuarios, error: null })
      }

      // Mock para la consulta de incidentes
      const mockChainIncidentes = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: mockIncidentes, error: null })
      }

      supabase.from
        .mockReturnValueOnce(mockChainUsuarios)
        .mockReturnValueOnce(mockChainIncidentes)

      await analyticsController.getUsuariosActividad(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          totalUsuarios: 2,
          totalIncidentesRegistrados: 3,
          usuarios: [
            expect.objectContaining({
              id: 'u1',
              nombreCompleto: 'Juan Pérez',
              totalIncidentes: 2,
              porcentajeDelTotal: 67,
              ultimoRegistro: '2026-10-15'
            }),
            expect.objectContaining({
              id: 'u2',
              nombreCompleto: 'Ana Gómez',
              totalIncidentes: 1,
              porcentajeDelTotal: 33,
              ultimoRegistro: '2026-10-12'
            })
          ]
        }
      })
    })

    it('debe manejar errores de base de datos con status 500', async () => {
      const mockChainError = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: { message: 'Connection error' } })
      }

      supabase.from.mockReturnValueOnce(mockChainError)

      await analyticsController.getUsuariosActividad(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Error al obtener actividad de usuarios'
      })
    })
  })

  describe('getPorAbordaje', () => {
    it('debe retornar distribución agrupada por tipo de abordaje', async () => {
      const mockIncidentes = [
        { id: 'i1', tipo_abordaje_id: 1, tipos_abordaje: { nombre: 'Mediación' } },
        { id: 'i2', tipo_abordaje_id: 1, tipos_abordaje: { nombre: 'Mediación' } },
        { id: 'i3', tipo_abordaje_id: 2, tipos_abordaje: { nombre: 'Entrevista' } }
      ]

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: mockIncidentes, error: null })
      }

      supabase.from.mockReturnValueOnce(mockChain)

      await analyticsController.getPorAbordaje(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [
          { nombre: 'Mediación', cantidad: 2 },
          { nombre: 'Entrevista', cantidad: 1 }
        ]
      })
    })
  })

  describe('descargarReporteMensualPdf', () => {
    it('debe generar y enviar el buffer del PDF con cabeceras de descarga', async () => {
      res.setHeader = jest.fn()
      res.end = jest.fn()

      await analyticsController.descargarReporteMensualPdf(req, res)

      expect(compilarReporteMensualPDF).toHaveBeenCalledWith('tenant-123', req.user, {})
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf')
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('attachment; filename="Reporte_Ejecutivo_Convivencia_')
      )
      expect(res.end).toHaveBeenCalled()
    })

    it('debe enviar los gráficos recibidos en el body hacia compilarReporteMensualPDF', async () => {
      res.setHeader = jest.fn()
      res.end = jest.fn()
      req.body = { graficos: { tendencia: 'data:image/png;base64,abc' } }

      await analyticsController.descargarReporteMensualPdf(req, res)

      expect(compilarReporteMensualPDF).toHaveBeenCalledWith('tenant-123', req.user, {
        tendencia: 'data:image/png;base64,abc'
      })
      expect(res.end).toHaveBeenCalled()
    })
  })
})
