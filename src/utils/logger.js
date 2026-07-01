const winston = require('winston')
const DailyRotateFile = require('winston-daily-rotate-file')

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
)

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: { service: 'siga-backend' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : ''
          return `${timestamp} [${level}]: ${message} ${metaStr}`
        })
      )
    }),

    // File transport - all logs
    new DailyRotateFile({
      filename: 'logs/app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
      level: 'info'
    }),

    // File transport - errors only
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      level: 'error'
    })
  ]
})

// Don't write logs to files in test environment
if (process.env.NODE_ENV === 'test') {
  logger.transports.forEach(transport => {
    if (transport instanceof DailyRotateFile) {
      transport.silent = true
    }
  })
}

module.exports = logger
