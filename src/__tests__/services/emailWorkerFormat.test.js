const emailQueue = require('../../queues/emailQueue')
const emailService = require('../../services/emailService')

jest.mock('../../queues/emailQueue', () => ({
  add: jest.fn().mockResolvedValue({ id: 'job-mock-123' }),
  process: jest.fn(),
  on: jest.fn(),
}))

describe('emailService & emailWorker — Enrutamiento y Cabeceras Híbridas (From / Reply-To)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('emailService.enviarEmail debe transferir fromName y replyTo a Bull Queue', async () => {
    const params = {
      to: 'apoderado@gmail.com',
      cc: 'profesor@escuelaelsalvador.cl',
      fromName: 'Prof. Pedro Pascal (vía SIGA Escolar)',
      replyTo: 'profesor@escuelaelsalvador.cl',
      subject: '[SIGA Escolar] Convocatoria a Citación Formativa',
      html: '<p>Invitación formal</p>',
    }

    const job = await emailService.enviarEmail(params)

    expect(job).toBeDefined()
    expect(emailQueue.add).toHaveBeenCalledWith(
      'send-email',
      expect.objectContaining({
        to: 'apoderado@gmail.com',
        cc: 'profesor@escuelaelsalvador.cl',
        fromName: 'Prof. Pedro Pascal (vía SIGA Escolar)',
        replyTo: 'profesor@escuelaelsalvador.cl',
        subject: '[SIGA Escolar] Convocatoria a Citación Formativa',
      }),
      expect.any(Object)
    )
  })
})
