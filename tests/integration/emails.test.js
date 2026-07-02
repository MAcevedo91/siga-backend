jest.mock('../../src/utils/db', () => ({
  supabase: {
    from: jest.fn()
  }
}))

jest.mock('../../src/queues/emailQueue', () => ({
  add: jest.fn().mockResolvedValue({ id: 'mock-job-id' })
}))

jest.mock('../../src/sockets', () => ({
  getIO: jest.fn(() => ({
    to: jest.fn().mockReturnThis(),
    emit: jest.fn()
  }))
}))

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}))

const emailService = require('../../src/services/emailService')
const notificacionesService = require('../../src/services/notificacionesService')

describe('Email Triggers Integration', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('debe tener definida función enviarEmailIncidenteGrave', () => {
    expect(emailService.enviarEmailIncidenteGrave).toBeDefined()
    expect(typeof emailService.enviarEmailIncidenteGrave).toBe('function')
  })

  it('debe tener definida función enviarEmailProtocoloAbierto', () => {
    expect(emailService.enviarEmailProtocoloAbierto).toBeDefined()
    expect(typeof emailService.enviarEmailProtocoloAbierto).toBe('function')
  })

  it('debe tener definida función crearNotificacion', () => {
    expect(notificacionesService.crearNotificacion).toBeDefined()
    expect(typeof notificacionesService.crearNotificacion).toBe('function')
  })
})
