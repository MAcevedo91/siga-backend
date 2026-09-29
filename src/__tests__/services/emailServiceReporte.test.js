const {
  renderInformeOficialApoderadoTemplate,
} = require('../../utils/emailTemplates')
const emailService = require('../../services/emailService')
const emailQueue = require('../../queues/emailQueue')

jest.mock('../../queues/emailQueue')
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}))

describe('emailService & Template — Notificación Oficial de Incidente (Tarea 6.4.1)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('renderInformeOficialApoderadoTemplate', () => {
    it('debe renderizar el HTML del informe oficial reemplazando las variables institucionales', () => {
      const html = renderInformeOficialApoderadoTemplate({
        apoderadoNombre: 'Pedro Soto',
        estudianteNombre: 'Lucas Soto',
        colegioNombre: 'Escuela Coeducacional N° 1 El Salvador',
        folio: 'INF-2026-A1B2C3',
        fechaIncidente: '29 de septiembre de 2026',
        fechaAprobacion: '29 de septiembre de 2026',
      })

      expect(html).toContain('Pedro Soto')
      expect(html).toContain('Lucas Soto')
      expect(html).toContain('Escuela Coeducacional N° 1 El Salvador')
      expect(html).toContain('INF-2026-A1B2C3')
      expect(html).toContain('Circular N° 482')
      expect(html).toContain('Ley N° 19.628')
    })
  })

  describe('enviarEmailInformeOficialApoderado', () => {
    it('debe encolar el trabajo de correo con el archivo PDF adjunto en formato base64', async () => {
      emailQueue.add.mockResolvedValue({ id: 'job-email-123' })

      const fakePdfBuffer = Buffer.from('%PDF-1.4 Mock PDF Stream')

      const job = await emailService.enviarEmailInformeOficialApoderado({
        apoderadoEmail: 'apoderado@correo.cl',
        apoderadoNombre: 'Pedro Soto',
        estudianteNombre: 'Lucas Soto',
        colegioNombre: 'Escuela Coeducacional N° 1 El Salvador',
        folio: 'INF-2026-A1B2C3',
        fechaIncidente: '29/09/2026',
        fechaAprobacion: '29/09/2026',
        pdfBuffer: fakePdfBuffer,
        filename: 'Informe_Oficial_Lucas_Soto.pdf',
      })

      expect(emailQueue.add).toHaveBeenCalledTimes(1)
      const [queueName, payload] = emailQueue.add.mock.calls[0]
      expect(queueName).toBe('send-email')
      expect(payload.to).toBe('apoderado@correo.cl')
      expect(payload.subject).toContain('Lucas Soto')
      expect(payload.attachments).toHaveLength(1)
      expect(payload.attachments[0].filename).toBe('Informe_Oficial_Lucas_Soto.pdf')
      expect(payload.attachments[0].contentType).toBe('application/pdf')
      expect(payload.attachments[0].encoding).toBe('base64')
      expect(payload.attachments[0].content).toBe(fakePdfBuffer.toString('base64'))
      expect(job.id).toBe('job-email-123')
    })
  })

  describe('Integración con reportesService.aprobarReporte', () => {
    const reportesService = require('../../services/reportesService')
    const { supabase } = require('../../utils/db')
    const pdfService = require('../../services/pdfService')

    jest.mock('../../services/pdfService')
    jest.mock('../../utils/db')

    it('debe disparar el correo al apoderado y actualizar flags cuando el apoderado tiene email', async () => {
      const mockReporteId = 'rep-111'
      const mockTenantId = 'ten-111'
      const mockUsuarioId = 'user-111'
      const mockEstudianteId = 'est-111'

      const mockReporteActual = {
        id: mockReporteId,
        tenant_id: mockTenantId,
        incidente_id: 'inc-111',
        estudiante_id: mockEstudianteId,
        estado: 'Borrador',
        contenido_borrador: {
          contexto: 'Contexto de prueba normativo en colegio.',
          hechos_objetivos: 'Relato de hechos con más de veinte caracteres requeridos.',
          medidas_adoptadas: 'Medidas adoptadas en inspectoría general.',
          acuerdos_compromisos: 'Compromisos de convivencia escolar formativa.',
          plan_seguimiento: 'Seguimiento por dupla psicosocial.',
        },
      }

      // Mock DB calls
      supabase.from = jest.fn().mockImplementation((table) => {
        if (table === 'reportes_incidentes') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: mockReporteActual, error: null }),
            update: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { ...mockReporteActual, estado: 'Aprobado', fecha_aprobacion: new Date().toISOString() },
              error: null,
            }),
          }
        }
        if (table === 'apoderados') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: {
                id: 'apo-1',
                nombre: 'Carlos',
                apellido: 'Gómez',
                email: 'carlos.gomez@email.cl',
              },
              error: null,
            }),
          }
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        }
      })

      pdfService.generarInformeOficialIncidentePDF.mockResolvedValue(Buffer.from('%PDF-1.4 Mock'))
      emailQueue.add.mockResolvedValue({ id: 'job-999' })

      const res = await reportesService.aprobarReporte({
        tenantId: mockTenantId,
        reporteId: mockReporteId,
        aprobadoPor: mockUsuarioId,
      })

      expect(res.estado).toBe('Aprobado')
      expect(emailQueue.add).toHaveBeenCalled()
      const emailPayload = emailQueue.add.mock.calls[0][1]
      expect(emailPayload.to).toBe('carlos.gomez@email.cl')
    })
  })

})
