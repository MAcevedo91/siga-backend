const emailQueue = require('../queues/emailQueue')
const logger = require('../utils/logger')
const {
  renderIncidenteGraveTemplate,
  renderProtocoloAbiertoTemplate,
  renderProtocoloVencidoTemplate,
  renderInformeOficialApoderadoTemplate
} = require('../utils/emailTemplates')

async function enviarEmail({ to, cc, bcc, subject, html, text, attachments }) {
  try {
    const job = await emailQueue.add('send-email', {
      to,
      cc,
      bcc,
      subject,
      html,
      text,
      attachments
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


/**
 * Envía el informe oficial de convivencia escolar en PDF adjunto al apoderado titular.
 *
 * @param {Object} params
 * @param {string} params.apoderadoEmail - Correo del apoderado.
 * @param {string} params.apoderadoNombre - Nombre del apoderado.
 * @param {string} params.estudianteNombre - Nombre completo del estudiante foco.
 * @param {string} [params.colegioNombre] - Nombre del establecimiento escolar.
 * @param {string} params.folio - Código correlativo de folio (ej. INF-2026-XXXX).
 * @param {string} params.fechaIncidente - Fecha en que ocurrió el suceso.
 * @param {string} params.fechaAprobacion - Fecha de aprobación formal.
 * @param {Buffer|string} params.pdfBuffer - Buffer del PDF o string en Base64.
 * @param {string} [params.filename] - Nombre del archivo adjunto.
 */
async function enviarEmailInformeOficialApoderado({
  apoderadoEmail,
  apoderadoNombre,
  estudianteNombre,
  colegioNombre = 'Escuela Coeducacional N° 1 El Salvador',
  folio,
  fechaIncidente,
  fechaAprobacion,
  pdfBuffer,
  filename = 'Informe_Oficial_Convivencia_Escolar.pdf',
}) {
  const subject = `[SIGA Escolar] Informe Oficial de Convivencia Escolar — ${estudianteNombre}`

  const html = renderInformeOficialApoderadoTemplate({
    apoderadoNombre,
    estudianteNombre,
    colegioNombre,
    folio,
    fechaIncidente,
    fechaAprobacion,
  })

  // Preparar adjunto seguro para serialización en cola Redis/Bull
  let attachmentContent = pdfBuffer
  let encoding = undefined

  if (Buffer.isBuffer(pdfBuffer)) {
    attachmentContent = pdfBuffer.toString('base64')
    encoding = 'base64'
  }

  const attachments = [
    {
      filename,
      content: attachmentContent,
      contentType: 'application/pdf',
      encoding,
    },
  ]

  return enviarEmail({
    to: apoderadoEmail,
    subject,
    html,
    attachments,
  })
}

module.exports = {
  enviarEmail,
  enviarEmailIncidenteGrave,
  enviarEmailProtocoloAbierto,
  enviarEmailProtocoloVencido,
  enviarEmailInformeOficialApoderado,
}
