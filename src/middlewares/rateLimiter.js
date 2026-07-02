const rateLimit = require('express-rate-limit')
const { ipKeyGenerator } = require('express-rate-limit')
const logger = require('../utils/logger')

// General API rate limiter: 100 requests per 15 minutes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    error: 'Demasiadas peticiones desde esta IP, por favor intente más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      requestId: req.id,
      ip: req.ip,
      url: req.originalUrl
    })
    res.status(429).json({
      error: 'Demasiadas peticiones desde esta IP, por favor intente más tarde.'
    })
  }
})

// Auth endpoints rate limiter: 5 requests per 15 minutes (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    error: 'Demasiados intentos de login. Por favor intente más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded', {
      requestId: req.id,
      ip: req.ip,
      email: req.body?.email
    })
    res.status(429).json({
      error: 'Demasiados intentos de login. Por favor intente más tarde.'
    })
  }
})

// Authenticated users rate limiter: 200 requests per 15 minutes (more permissive)
const authenticatedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  keyGenerator: (req) => {
    // Use user ID if authenticated, fallback to IP with IPv6 support
    return req.user?.id || ipKeyGenerator(req)
  },
  message: {
    error: 'Demasiadas peticiones, por favor intente más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Authenticated rate limit exceeded', {
      requestId: req.id,
      userId: req.user?.id,
      ip: req.ip,
      url: req.originalUrl
    })
    res.status(429).json({
      error: 'Demasiadas peticiones, por favor intente más tarde.'
    })
  }
})

module.exports = {
  generalLimiter,
  authLimiter,
  authenticatedLimiter
}
