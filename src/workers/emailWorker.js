const emailQueue = require('../queues/emailQueue')
const { getEmailTransporter } = require('../utils/emailTransporter')
const logger = require('../utils/logger')

// Process email jobs
emailQueue.process('send-email', async (job) => {
  const { to, cc, bcc, fromName, replyTo, subject, html, text, attachments } = job.data

  logger.info('Processing email job', {
    jobId: job.id,
    to,
    fromName,
    replyTo,
    subject
  })

  try {
    const transporter = getEmailTransporter()

    const defaultFrom = process.env.SMTP_FROM || 'noreply@sigaescolar.cl'
    const emailMatch = defaultFrom.match(/<([^>]+)>/)
    const baseEmail = emailMatch ? emailMatch[1] : defaultFrom.trim()
    const fromHeader = fromName ? `"${fromName.replace(/"/g, '')}" <${baseEmail}>` : defaultFrom

    const mailOptions = {
      from: fromHeader,
      to,
      subject,
      html,
      text: text || undefined
    }

    if (replyTo) mailOptions.replyTo = replyTo
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
