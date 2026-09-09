const { randomUUID } = require('crypto')

function requestIdMiddleware(req, res, next) {
  // Use existing request ID from header if present, otherwise generate new one
  req.id = (req.headers && req.headers['x-request-id']) || randomUUID()

  // Set response header
  res.setHeader('X-Request-ID', req.id)

  next()
}

module.exports = requestIdMiddleware
