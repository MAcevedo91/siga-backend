const request = require('supertest')
const express = require('express')
const { compilarReporteMensualPDF } = require('../../services/reporteMensualPdfService')
const { supabase } = require('../../utils/db')
const { getEstudiantesEnRiesgo } = require('../../services/dashboardService')

jest.mock('../../utils/db')
jest.mock('../../utils/logger')
jest.mock('../../services/dashboardService', () => ({
  getEstudiantesEnRiesgo: jest.fn(),
}))

// PNG válido mínimo de 1x1 píxel en base64
const VALID_1X1_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

describe('reporteMensualPdfService', () => {
  const tenantId = 'tenant-pdf-test'

  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.GEMINI_API_KEY
  })

  it('compila un PDF válido usando .neq("estado", "Cerrado") y motor de riesgo oficial', async () => {
    const neqSpy = jest.fn().mockResolvedValue({ count: 4, error: null })
    let incidentesCall = 0

    supabase.from = jest.fn().mockImplementation((table) => {
      if (table === 'incidentes') {
        incidentesCall++
        if (incidentesCall === 1) {
          // Mes actual
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            lte: jest.fn().mockResolvedValue({ count: 8, error: null }),
          }
        }
        if (incidentesCall === 2) {
          // Mes anterior
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            lte: jest.fn().mockResolvedValue({ count: 4, error: null }),
          }
        }
        if (incidentesCall === 3) {
          // Abiertos (.neq Cerrado)
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            neq: neqSpy,
          }
        }
        if (incidentesCall === 4) {
          // Gravedad mes actual
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            lte: jest.fn().mockResolvedValue({
              data: [{ gravedad: 'Leve' }, { gravedad: 'Grave' }, { gravedad: 'Gravísima' }],
              error: null,
            }),
          }
        }
        if (incidentesCall === 5) {
          // Tiempo resolución casos cerrados
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            not: jest.fn().mockResolvedValue({
              data: [{ fecha: '2026-11-01', fecha_cierre: '2026-11-04' }],
              error: null,
            }),
          }
        }
        // IDs incidentes mes actual para focalizados
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockResolvedValue({ data: [], error: null }),
        }
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      }
    })

    getEstudiantesEnRiesgo.mockResolvedValue([{ id: 'est-1' }, { id: 'est-2' }])

    const buffer = await compilarReporteMensualPDF(
      tenantId,
      { nombre: 'Directora', apellido: 'Test', rol: 'Directivo' },
      {
        tendencia: VALID_1X1_PNG,
        gravedad: 'data:text/html;base64,PHNjcmlwdD48L3NjcmlwdD4=', // payload inválido debe ignorarse de forma segura
        cursos: VALID_1X1_PNG,
        abordajes: null,
      }
    )

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.slice(0, 5).toString('utf8')).toBe('%PDF-')
    expect(neqSpy).toHaveBeenCalledWith('estado', 'Cerrado')
    expect(getEstudiantesEnRiesgo).toHaveBeenCalledWith(tenantId)
  })

  it('el límite JSON dedicado acepta payloads > 140KB en POST /api/v1/analytics/reporte-mensual-pdf sin HTTP 413', async () => {
    const testApp = express()
    const defaultJsonParser = express.json({ limit: '512kb' })
    const analyticsPdfJsonParser = express.json({ limit: '5mb' })

    testApp.use((req, res, next) => {
      if (
        req.method === 'POST' &&
        /^\/api(\/v1)?\/analytics\/reporte-mensual-pdf\/?$/.test(req.path)
      ) {
        return analyticsPdfJsonParser(req, res, next)
      }
      return defaultJsonParser(req, res, next)
    })

    testApp.post('/api/v1/analytics/reporte-mensual-pdf', (req, res) => {
      res.status(200).json({ ok: true, size: JSON.stringify(req.body).length })
    })
    testApp.post('/api/v1/otro-endpoint', (req, res) => {
      res.status(200).json({ ok: true })
    })

    // Payload de ~700 KB (similar a 4 gráficos Retina) aceptado en el endpoint de reporte PDF
    const bigCharts = { graficos: { tendencia: 'A'.repeat(700 * 1024) } }
    const resPdf = await request(testApp)
      .post('/api/v1/analytics/reporte-mensual-pdf')
      .send(bigCharts)
    expect(resPdf.status).toBe(200)
    expect(resPdf.body.ok).toBe(true)

    // Mismo payload de ~700 KB bloqueado con HTTP 413 en cualquier otra ruta (protección DoS)
    const resOther = await request(testApp)
      .post('/api/v1/otro-endpoint')
      .send(bigCharts)
    expect(resOther.status).toBe(413)
  })
})
