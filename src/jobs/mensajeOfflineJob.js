const emailService = require('../services/emailService')
const { supabase } = require('../utils/db')
const logger = require('../utils/logger')

/**
 * Job: envía email a usuario si recibió mensaje estando offline.
 */
const procesarMensajeOffline = async (job) => {
  const { userId, mensaje, conversacionId } = job.data

  try {
    logger.info(`[MensajeOffline] Procesando para usuario: ${userId}`)

    // 1. Obtener datos del usuario
    const { data: usuario, error: errorUser } = await supabase
      .from('usuarios')
      .select('email, nombre, apellido')
      .eq('id', userId)
      .single()

    if (errorUser || !usuario) {
      logger.warn(`[MensajeOffline] Usuario ${userId} no encontrado`)
      return { mensaje: 'Usuario no encontrado' }
    }

    // 2. Obtener datos del remitente
    const { data: remitente } = await supabase
      .from('usuarios')
      .select('nombre, apellido')
      .eq('id', mensaje.remitente_id)
      .single()

    const nombreRemitente = remitente
      ? `${remitente.nombre} ${remitente.apellido}`
      : 'Un usuario'

    // 3. Construir email
    const htmlContent = `
      <h2>Nuevo Mensaje en SIGA Escolar</h2>
      <p>Hola <strong>${usuario.nombre} ${usuario.apellido}</strong>,</p>

      <p><strong>${nombreRemitente}</strong> te envió un mensaje:</p>

      <blockquote style="border-left: 4px solid #3b82f6; padding-left: 16px; margin: 16px 0; color: #374151;">
        ${mensaje.contenido}
      </blockquote>

      ${mensaje.adjunto_url ? `<p>📎 <strong>Adjunto:</strong> ${mensaje.adjunto_nombre}</p>` : ''}

      <p>
        <a href="${process.env.FRONTEND_URL}/mensajes?conversacion=${conversacionId}"
           style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Ver Conversación
        </a>
      </p>

      <p><small>Este es un mensaje automático porque estabas offline al momento del envío.</small></p>
    `

    // 4. Enviar email
    await emailService.enviarEmail({
      to: usuario.email,
      subject: `Nuevo mensaje de ${nombreRemitente}`,
      html: htmlContent
    })

    logger.info(`[MensajeOffline] Email enviado a ${usuario.email}`)

    return { mensaje: 'Email enviado correctamente' }
  } catch (error) {
    logger.error('[MensajeOffline] Error procesando job:', error)
    throw error
  }
}

module.exports = {
  procesarMensajeOffline
}
