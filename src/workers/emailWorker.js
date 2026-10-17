const emailQueue = require('../queues/emailQueue')
const { getEmailTransporter } = require('../utils/emailTransporter')
const logger = require('../utils/logger')

// Process email jobs
emailQueue.process('send-email', async (job) => {
  const { to, cc, bcc, subject, html, text, attachments } = job.data

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
    if (attachments && Array.isArray(attachments)) {
      mailOptions.attachments = attachments.map(att => {
        // Si el contenido viene codificado en base64 desde Bull queue, reconstituir Buffer
        if (att.content && typeof att.content === 'string' && att.encoding === 'base64') {
          return {
            filename: att.filename,
            content: Buffer.from(att.content, 'base64'),
            contentType: att.contentType || 'application/pdf',
          }
        }
        return att
      })
    }

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
