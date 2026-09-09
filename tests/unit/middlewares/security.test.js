const securityMiddleware = require('../../../src/middlewares/security')

describe('securityMiddleware', () => {
  let req, res, next

  beforeEach(() => {
    req = {}
    res = {
      setHeader: jest.fn(),
      getHeader: jest.fn(),
      removeHeader: jest.fn(),
      hasHeader: jest.fn(() => false)
    }
    next = jest.fn()
  })

  it('debe ser una función', () => {
    expect(typeof securityMiddleware).toBe('function')
  })

  it('debe llamar a next()', () => {
    securityMiddleware(req, res, next)
    expect(next).toHaveBeenCalled()
  })
})
