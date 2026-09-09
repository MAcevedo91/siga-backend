const emailService = require('../../../src/services/emailService')
const emailQueue = require('../../../src/queues/emailQueue')

jest.mock('../../../src/queues/emailQueue')

describe('Email Service', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('enviarEmail', () => {
    it('debe agregar job a la cola con datos correctos', async () => {
      const mockAdd = jest.fn().mockResolvedValue({ id: 'job-123' })
      emailQueue.add = mockAdd

      const emailData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test content</p>'
      }

      await emailService.enviarEmail(emailData)

      expect(mockAdd).toHaveBeenCalledWith('send-email', emailData, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: true,
        removeOnFail: false
      })
    })

    it('debe agregar cc y bcc si se proporcionan', async () => {
      const mockAdd = jest.fn().mockResolvedValue({ id: 'job-124' })
      emailQueue.add = mockAdd

      await emailService.enviarEmail({
        to: 'test@example.com',
        cc: 'cc@example.com',
        bcc: 'bcc@example.com',
        subject: 'Test',
        html: '<p>Test</p>'
      })

      expect(mockAdd).toHaveBeenCalled()
      const jobData = mockAdd.mock.calls[0][1]
      expect(jobData.cc).toBe('cc@example.com')
      expect(jobData.bcc).toBe('bcc@example.com')
    })
  })

  describe('enviarEmailIncidenteGrave', () => {
    it('debe formatear y enviar email de incidente grave', async () => {
      const mockAdd = jest.fn().mockResolvedValue({ id: 'job-125' })
      emailQueue.add = mockAdd

      await emailService.enviarEmailIncidenteGrave({
        apoderadoEmail: 'apoderado@example.com',
        estudianteNombre: 'Juan Pérez',
        incidenteDescripcion: 'Pelea en patio',
        gravedadLabel: 'Grave',
        fecha: '2026-07-01'
      })

      expect(mockAdd).toHaveBeenCalled()
      const jobData = mockAdd.mock.calls[0][1]
      expect(jobData.to).toBe('apoderado@example.com')
      expect(jobData.subject).toContain('Incidente')
      expect(jobData.html).toContain('Juan Pérez')
    })
  })
})
