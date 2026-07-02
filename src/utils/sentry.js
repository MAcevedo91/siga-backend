const Sentry = require('@sentry/node')
const logger = require('./logger')

function initSentry() {
  if (!process.env.SENTRY_DSN) {
    logger.warn('SENTRY_DSN not configured, skipping Sentry initialization')
    return
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0
  })

  logger.info('Sentry initialized', {
    environment: process.env.NODE_ENV,
    dsn: process.env.SENTRY_DSN.substring(0, 20) + '...'
  })
}

module.exports = { initSentry, Sentry }
