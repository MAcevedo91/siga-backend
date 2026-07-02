const logger = require('../utils/logger')

function loggingMiddleware(req, res, next) {
  const startTime = Date.now()

  // Log incoming request
  logger.http('HTTP Request', {
    requestId: req.id,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  })

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime

    logger.http('HTTP Response', {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${duration}ms`
    })
  })

  next()
}

module.exports = loggingMiddleware
