const requestIdMiddleware = require('../../../src/middlewares/requestId')

describe('requestIdMiddleware', () => {
  let req, res, next

  beforeEach(() => {
    req = {}
    res = {
      setHeader: jest.fn()
    }
    next = jest.fn()
  })

  it('debe agregar req.id como UUID válido', () => {
    requestIdMiddleware(req, res, next)

    expect(req.id).toBeDefined()
    expect(req.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })

  it('debe setear header X-Request-ID', () => {
    requestIdMiddleware(req, res, next)

    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', req.id)
  })

  it('debe llamar a next()', () => {
    requestIdMiddleware(req, res, next)

    expect(next).toHaveBeenCalled()
  })

  it('debe usar X-Request-ID del request si existe', () => {
    req.headers = { 'x-request-id': 'existing-id-123' }

    requestIdMiddleware(req, res, next)

    expect(req.id).toBe('existing-id-123')
  })
})
