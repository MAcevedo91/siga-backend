const emailQueue = require('../queues/emailQueue')
const { getEmailTransporter } = require('../utils/emailTransporter')
const logger = require('../utils/logger')

// Process email jobs
emailQueue.process('send-email', async (job) => {
  const { to, cc, bcc, subject, html, text } = job.data

  logger.info('Processing email job', {
    jobId: job.id,
    to,
    subject
  })

  try {
    const transporter = getEmailTransporter()

    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@sigaescolar.cl',
      to,
      subject,
      html,
      text: text || undefined
    }

    if (cc) mailOptions.cc = cc
    if (bcc) mailOptions.bcc = bcc

    const info = await transporter.sendMail(mailOptions)

    logger.info('Email sent successfully', {
      jobId: job.id,
      to,
      messageId: info.messageId
    })

    return { success: true, messageId: info.messageId }
  } catch (error) {
    logger.error('Error sending email', {
      jobId: job.id,
      to,
      error: error.message
    })
    throw error // Will trigger retry
  }
})

logger.info('Email worker initialized')

module.exports = emailQueue
