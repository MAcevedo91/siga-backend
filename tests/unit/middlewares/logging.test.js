const loggingMiddleware = require('../../../src/middlewares/logging')
const logger = require('../../../src/utils/logger')

jest.mock('../../../src/utils/logger', () => ({
  http: jest.fn(),
  error: jest.fn()
}))

describe('loggingMiddleware', () => {
  let req, res, next

  beforeEach(() => {
    jest.clearAllMocks()
    req = {
      id: 'test-request-id',
      method: 'GET',
      originalUrl: '/api/v1/estudiantes',
      ip: '127.0.0.1',
      headers: { 'user-agent': 'test-agent' }
    }
    res = {
      statusCode: 200,
      on: jest.fn()
    }
    next = jest.fn()
  })

  it('debe loggear request al iniciar', () => {
    loggingMiddleware(req, res, next)

    expect(logger.http).toHaveBeenCalledWith(
      'HTTP Request',
      expect.objectContaining({
        requestId: 'test-request-id',
        method: 'GET',
        url: '/api/v1/estudiantes',
        ip: '127.0.0.1'
      })
    )
  })

  it('debe loggear response al finalizar', (done) => {
    res.on.mockImplementation((event, callback) => {
      if (event === 'finish') {
        setTimeout(() => {
          callback()

          expect(logger.http).toHaveBeenCalledWith(
            'HTTP Response',
            expect.objectContaining({
              requestId: 'test-request-id',
              statusCode: 200,
              responseTime: expect.any(String)
            })
          )
          done()
        }, 10)
      }
    })

    loggingMiddleware(req, res, next)
    res.on.mock.calls[0][1]() // Trigger finish callback
  })

  it('debe llamar a next()', () => {
    loggingMiddleware(req, res, next)
    expect(next).toHaveBeenCalled()
  })
})
