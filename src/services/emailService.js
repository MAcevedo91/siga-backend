const emailQueue = require('../queues/emailQueue')
const logger = require('../utils/logger')
const {
  renderIncidenteGraveTemplate,
  renderProtocoloAbiertoTemplate,
  renderProtocoloVencidoTemplate
} = require('../utils/emailTemplates')

async function enviarEmail({ to, cc, bcc, subject, html, text }) {
  try {
    const job = await emailQueue.add('send-email', {
      to,
      cc,
      bcc,
      subject,
      html,
      text
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      },
      removeOnComplete: true,
      removeOnFail: false
    })

    logger.info('Email job added to queue', {
      jobId: job.id,
      to,
      subject
    })

    return job
  } catch (error) {
    logger.error('Error adding email to queue', {
      to,
      subject,
      error: error.message
    })
    throw error
  }
}

async function enviarEmailIncidenteGrave({
  apoderadoEmail,
  estudianteNombre,
  incidenteDescripcion,
  gravedadLabel,
  fecha
}) {
  const subject = `[SIGA Escolar] Notificación de Incidente ${gravedadLabel}`

  const html = renderIncidenteGraveTemplate({
    estudianteNombre,
    incidenteDescripcion,
    gravedadLabel,
    fecha
  })

  return enviarEmail({
    to: apoderadoEmail,
    subject,
    html
  })
}

async function enviarEmailProtocoloAbierto({
  apoderadoEmail,
  estudianteNombre,
  protocoloTipo,
  responsableNombre,
  fecha
}) {
  const subject = `[SIGA Escolar] Protocolo ${protocoloTipo} Iniciado`

  const html = renderProtocoloAbiertoTemplate({
    estudianteNombre,
    protocoloTipo,
    responsableNombre,
    fecha
  })

  return enviarEmail({
    to: apoderadoEmail,
    subject,
    html
  })
}

async function enviarEmailProtocoloVencido({
  coordinadorEmail,
  estudianteNombre,
  protocoloTipo,
  fechaInicio,
  fechaVencimiento,
  diasVencido
}) {
  const subject = `[SIGA Escolar] ⚠️ Protocolo Vencido Sin Cerrar`

  const html = renderProtocoloVencidoTemplate({
    estudianteNombre,
    protocoloTipo,
    fechaInicio,
    fechaVencimiento,
    diasVencido
  })

  return enviarEmail({
    to: coordinadorEmail,
    subject,
    html
  })
}

module.exports = {
  enviarEmail,
  enviarEmailIncidenteGrave,
  enviarEmailProtocoloAbierto,
  enviarEmailProtocoloVencido
}
