const nodemailer = require('nodemailer')
const logger = require('./logger')

let transporter = null

function createEmailTransporter() {
  if (transporter) return transporter

  const config = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  }

  // In development, use ethereal if no SMTP configured
  if (process.env.NODE_ENV !== 'production' && !process.env.SMTP_HOST) {
    logger.warn('No SMTP configured, emails will be logged only')
    transporter = nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix',
      buffer: true
    })
  } else {
    transporter = nodemailer.createTransport(config)
  }

  logger.info('Email transporter created', {
    host: config.host,
    port: config.port
  })

  return transporter
}

function getEmailTransporter() {
  if (!transporter) {
    return createEmailTransporter()
  }
  return transporter
}

module.exports = { createEmailTransporter, getEmailTransporter }
