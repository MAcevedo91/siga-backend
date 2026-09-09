const { generalLimiter, authLimiter, authenticatedLimiter } = require('../../../src/middlewares/rateLimiter')

describe('Rate Limiters', () => {
  it('generalLimiter debe existir y ser una función', () => {
    expect(generalLimiter).toBeDefined()
    expect(typeof generalLimiter).toBe('function')
  })

  it('authLimiter debe existir y ser una función', () => {
    expect(authLimiter).toBeDefined()
    expect(typeof authLimiter).toBe('function')
  })

  it('authenticatedLimiter debe existir y ser una función', () => {
    expect(authenticatedLimiter).toBeDefined()
    expect(typeof authenticatedLimiter).toBe('function')
  })

  describe('generalLimiter', () => {
    it('debe ser middleware Express', () => {
      expect(generalLimiter.length).toBe(3) // (req, res, next)
    })
  })

  describe('authLimiter', () => {
    it('debe ser middleware Express', () => {
      expect(authLimiter.length).toBe(3)
    })
  })

  describe('authenticatedLimiter', () => {
    it('debe ser middleware Express', () => {
      expect(authenticatedLimiter.length).toBe(3)
    })
  })
})
