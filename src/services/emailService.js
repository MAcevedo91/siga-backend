const emailQueue = require('../queues/emailQueue')
const logger = require('../utils/logger')

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

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Notificación de Incidente ${gravedadLabel}</h2>
      <p>Estimado/a apoderado/a,</p>
      <p>Le informamos que el estudiante <strong>${estudianteNombre}</strong> ha estado involucrado en un incidente registrado en nuestro sistema.</p>

      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Fecha:</strong> ${fecha}</p>
        <p><strong>Gravedad:</strong> ${gravedadLabel}</p>
        <p><strong>Descripción:</strong> ${incidenteDescripcion}</p>
      </div>

      <p>Se le solicita coordinar una reunión con el equipo de formación para abordar esta situación.</p>

      <p style="margin-top: 30px;">Atentamente,<br><strong>Equipo de Formación</strong></p>

      <hr style="margin-top: 30px; border: none; border-top: 1px solid #e5e7eb;">
      <p style="font-size: 12px; color: #6b7280;">Este es un correo automático generado por SIGA Escolar. Por favor no responder.</p>
    </div>
  `

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
  fecha
}) {
  const subject = `[SIGA Escolar] Protocolo ${protocoloTipo} Iniciado`

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Protocolo ${protocoloTipo} Iniciado</h2>
      <p>Estimado/a apoderado/a,</p>
      <p>Le informamos que se ha iniciado un protocolo <strong>${protocoloTipo}</strong> para el estudiante <strong>${estudianteNombre}</strong>.</p>

      <div style="background-color: #eff6ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Fecha inicio:</strong> ${fecha}</p>
        <p><strong>Tipo de protocolo:</strong> ${protocoloTipo}</p>
      </div>

      <p>El equipo de formación se pondrá en contacto con usted a la brevedad para coordinar el seguimiento correspondiente.</p>

      <p style="margin-top: 30px;">Atentamente,<br><strong>Equipo de Formación</strong></p>

      <hr style="margin-top: 30px; border: none; border-top: 1px solid #e5e7eb;">
      <p style="font-size: 12px; color: #6b7280;">Este es un correo automático generado por SIGA Escolar. Por favor no responder.</p>
    </div>
  `

  return enviarEmail({
    to: apoderadoEmail,
    subject,
    html
  })
}

module.exports = {
  enviarEmail,
  enviarEmailIncidenteGrave,
  enviarEmailProtocoloAbierto
}
