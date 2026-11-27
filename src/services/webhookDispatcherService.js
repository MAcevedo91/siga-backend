const crypto = require('crypto')
const logger = require('../utils/logger')

/**
 * Servicio Despachador de Webhooks Seguros para Automatizaciones Externas (N8N, Zapier, etc.)
 * Implementa autenticación basada en firmas criptográficas HMAC-SHA256 y control anti-replay con timestamps.
 *
 * Cumplimiento DLP Escolar (Ley N° 19.628):
 * - Los payloads deben ser estrictamente desprovistos de información sensible de menores (RUTs, antecedentes disciplinarios íntimos).
 */

/**
 * Genera la firma HMAC-SHA256 para el cuerpo y timestamp del webhook.
 *
 * @param {string} payloadString - Cuerpo JSON serializado
 * @param {string} secret - Clave secreta compartida
 * @param {number|string} timestamp - Timestamp en milisegundos o segundos
 * @returns {string} Firma hexadecimal
 */
const generarFirmaWebhook = (payloadString, secret, timestamp) => {
  if (!secret) return ''
  const datosParaFirmar = `${timestamp}.${payloadString}`
  return crypto.createHmac('sha256', secret).update(datosParaFirmar).digest('hex')
}

/**
 * Valida la autenticidad e integridad de un webhook recibido (Útil para pruebas o callbacks de N8N).
 *
 * @param {string} payloadString - Cuerpo en texto
 * @param {string} secret - Clave secreta compartida
 * @param {string} signature - Firma recibida en headers
 * @param {number|string} timestamp - Timestamp recibido en headers
 * @param {number} ventanaToleranciaMs - Ventana de validez anti-replay (por defecto 5 min)
 * @returns {boolean} True si es válido
 */
const verificarFirmaWebhook = (
  payloadString,
  secret,
  signature,
  timestamp,
  ventanaToleranciaMs = 5 * 60 * 1000
) => {
  if (!secret || !signature || !timestamp) return false

  const ahora = Date.now()
  const tsNumero = Number(timestamp)
  if (isNaN(tsNumero)) return false

  // Control anti-replay: el timestamp no puede ser más viejo o más a futuro que la ventana permitida
  if (Math.abs(ahora - tsNumero) > ventanaToleranciaMs) {
    logger.warn('Firma de webhook rechazada por desfase de timestamp (posible replay attack)')
    return false
  }

  const firmaEsperada = generarFirmaWebhook(payloadString, secret, tsNumero)
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(firmaEsperada, 'hex')
    )
  } catch (err) {
    return false
  }
}

/**
 * Realiza un despacho HTTP POST seguro hacia una URL de webhook externa.
 * Opera de forma asíncrona y fail-safe (los fallos no rompen la transacción del sistema origen).
 *
 * @param {string} url - URL destino (ej. endpoint N8N)
 * @param {string} evento - Nombre del evento (ej. 'citacion.creada')
 * @param {Object} payload - Objeto con datos del evento
 * @param {string} secret - Clave secreta para firmar
 * @param {Object} options - Configuración adicional (timeout, reintentos)
 * @returns {Promise<boolean>} True si el envío fue exitoso
 */
const enviarWebhookSeguro = async (url, evento, payload, secret, options = {}) => {
  if (!url) {
    logger.debug('Despacho de webhook omitido: URL no configurada.')
    return false
  }

  const timeoutMs = options.timeoutMs || 5000
  const timestamp = Date.now()
  const envoltorio = {
    evento,
    timestamp: new Date(timestamp).toISOString(),
    data: payload,
  }

  const payloadString = JSON.stringify(envoltorio)
  const firma = secret ? generarFirmaWebhook(payloadString, secret, timestamp) : ''

  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'SIGA-Escolar-WebhookDispatcher/1.0',
    'x-siga-timestamp': String(timestamp),
    'x-siga-event': evento,
  }

  if (firma) {
    headers['x-siga-signature'] = firma
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: payloadString,
      signal: controller.signal,
    })

    clearTimeout(timer)

    if (!response.ok) {
      logger.warn(
        `Webhook N8N (${evento}) respondió con estado no satisfactorio: ${response.status} ${response.statusText}`
      )
      return false
    }

    logger.info(`Webhook N8N (${evento}) despachado exitosamente hacia ${url}`)
    return true
  } catch (error) {
    if (error.name === 'AbortError') {
      logger.warn(`Timeout al despachar webhook N8N (${evento}) tras ${timeoutMs}ms`)
    } else {
      logger.warn(`Error al despachar webhook N8N (${evento}):`, error.message)
    }
    return false
  }
}

/**
 * Filtro DLP y Despachador Específico para el Evento 'citacion.creada'.
 * Sanitiza los datos para garantizar que solo se envíen antecedentes de coordinación
 * excluyendo deliberadamente RUTs, motivos íntimos o historiales disciplinarios.
 *
 * @param {Object} params - Datos consolidados de la citación
 * @returns {Promise<boolean>}
 */
const despacharEventoCitacionCreada = async ({
  folio,
  estudiante,
  apoderado,
  docente,
  fecha_hora_programada,
  lugar_entrevista,
  modalidad,
  enlace_virtual,
  token_confirmacion,
  token_expira_at,
}) => {
  const rawEnabled = String(process.env.N8N_WEBHOOK_ENABLED ?? process.env.N8N_WEBHOOK_ENABLE ?? 'true')
    .replace(/['"]/g, '')
    .trim()
    .toLowerCase()
  const isEnabled = rawEnabled !== 'false'
  const webhookUrl = (
    process.env.N8N_WEBHOOK_CITACIONES_URL ||
    'https://sigaescolar.app.n8n.cloud/webhook/siga-citacion-creada'
  )
    .replace(/['"]/g, '')
    .trim()
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET

  if (!isEnabled || !webhookUrl) {
    logger.debug('Despacho de citación a N8N desactivado por configuración de entorno')
    return false
  }

  const frontendUrl = (
    process.env.FRONTEND_URL ||
    'https://siga-frontend-delta-six.vercel.app'
  )
    .replace(/['"]/g, '')
    .trim()
  const enlaceConfirmacion = `${frontendUrl}/citaciones/confirmacion/${token_confirmacion}`

  logger.info(`Despachando evento N8N (citacion.creada) hacia ${webhookUrl} para folio ${folio}`)

  // Payload Sanitizado con cumplimiento DLP Escolar
  const payloadDLP = {
    folio,
    fecha_hora_programada,
    lugar_entrevista: lugar_entrevista || 'Sala de Entrevistas / Convivencia Escolar',
    modalidad: modalidad || 'presencial',
    enlace_virtual: modalidad === 'virtual' ? enlace_virtual : null,
    enlace_confirmacion: enlaceConfirmacion,
    token_expira_at,
    estudiante: {
      nombre: estudiante?.nombre || 'Estudiante',
      apellido: estudiante?.apellido || '',
      curso: estudiante?.curso || null,
    },
    apoderado: {
      nombre: apoderado?.nombre || 'Apoderado',
      apellido: apoderado?.apellido || '',
      telefono: apoderado?.telefono || null,
      email: apoderado?.email || null,
    },
    docente: {
      nombre: docente?.nombre || 'Profesor(a) / Inspectoría',
      email: docente?.email || null,
    },
  }

  return enviarWebhookSeguro(
    webhookUrl,
    'citacion.creada',
    payloadDLP,
    webhookSecret
  )
}

module.exports = {
  generarFirmaWebhook,
  verificarFirmaWebhook,
  enviarWebhookSeguro,
  despacharEventoCitacionCreada,
}
