const { z } = require('zod')
const { supabase } = require('../utils/db')
const logger = require('../utils/logger')
const crypto = require('crypto')

// =============================================================================
// ESQUEMA DE VALIDACIÓN ZOD
// =============================================================================

const webhookSchema = z.object({
  nombre: z.string().min(3).max(100),
  url: z.string().url('URL debe ser válida'),
  eventos: z.array(z.string()).min(1, 'Debe especificar al menos un evento'),
  headers: z.record(z.string()).optional()
})

// =============================================================================
// SERVICIOS
// =============================================================================

/**
 * Crea un webhook.
 *
 * @param {string} tenantId
 * @param {Object} data - { nombre, url, eventos, headers? }
 * @param {string} usuarioId
 * @returns {Promise<Object>} - Webhook creado con secreto
 */
const crearWebhook = async (tenantId, data, usuarioId) => {
  const validacion = webhookSchema.safeParse(data)
  if (!validacion.success) {
    const errores = validacion.error.issues.map(e => e.message).join(', ')
    throw new Error(`Validación fallida: ${errores}`)
  }

  const { nombre, url, eventos, headers } = validacion.data

  // Generar secreto para HMAC
  const secreto = crypto.randomBytes(32).toString('hex')

  const { data: webhook, error } = await supabase
    .from('webhooks')
    .insert({
      tenant_id: tenantId,
      nombre,
      url,
      eventos: JSON.stringify(eventos),
      secreto,
      headers: headers ? JSON.stringify(headers) : null,
      activo: true
    })
    .select('id, nombre, url, eventos, secreto, activo')
    .single()

  if (error) {
    logger.error('Error creando webhook:', error)
    throw new Error(`Error al crear webhook: ${error.message}`)
  }

  logger.info(`Webhook creado: ${webhook.id} - ${nombre}`)

  return webhook
}

/**
 * Dispara webhooks para un evento específico.
 *
 * @param {string} tenantId
 * @param {string} evento - Ej: 'incidente.created', 'estudiante.updated'
 * @param {Object} payload - Datos del evento
 * @returns {Promise<void>}
 */
const triggerWebhooks = async (tenantId, evento, payload) => {
  // Obtener webhooks activos que escuchen este evento
  const { data: webhooks, error } = await supabase
    .from('webhooks')
    .select('id, url, secreto, headers, eventos')
    .eq('tenant_id', tenantId)
    .eq('activo', true)

  if (error) {
    logger.error('Error obteniendo webhooks:', error)
    return
  }

  // Filtrar webhooks que escuchen este evento
  const webhooksInteresados = webhooks.filter(wh => {
    const eventos = typeof wh.eventos === 'string' ? JSON.parse(wh.eventos) : wh.eventos
    return eventos.includes(evento) || eventos.includes('*')
  })

  if (webhooksInteresados.length === 0) {
    logger.debug(`No hay webhooks registrados para evento: ${evento}`)
    return
  }

  // Disparar webhooks en paralelo
  const promesas = webhooksInteresados.map(webhook =>
    entregarWebhook(webhook, evento, payload)
  )

  await Promise.allSettled(promesas)
}

/**
 * Entrega un webhook (HTTP POST con HMAC signature).
 *
 * @param {Object} webhook - { id, url, secreto, headers }
 * @param {string} evento
 * @param {Object} payload
 * @returns {Promise<void>}
 */
const entregarWebhook = async (webhook, evento, payload) => {
  const { id, url, secreto, headers } = webhook

  // Construir payload con timestamp
  const webhookPayload = {
    evento,
    timestamp: new Date().toISOString(),
    data: payload
  }

  const body = JSON.stringify(webhookPayload)

  // Generar firma HMAC-SHA256
  const signature = crypto
    .createHmac('sha256', secreto)
    .update(body)
    .digest('hex')

  // Headers personalizados + firma
  const requestHeaders = {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': signature,
    'X-Webhook-Event': evento,
    ...(headers ? (typeof headers === 'string' ? JSON.parse(headers) : headers) : {})
  }

  try {
    // Simular HTTP POST (en producción usar fetch o axios)
    // const response = await fetch(url, {
    //   method: 'POST',
    //   headers: requestHeaders,
    //   body
    // })

    // Por ahora, log simulado
    logger.info(`Webhook entregado: ${id} -> ${url} (evento: ${evento})`)

    // Registrar entrega exitosa
    await supabase.from('webhook_deliveries').insert({
      webhook_id: id,
      evento,
      payload: webhookPayload,
      http_status: 200, // Simulado
      exitoso: true,
      intento: 1
    })
  } catch (error) {
    logger.error(`Error entregando webhook ${id}:`, error)

    // Registrar entrega fallida
    await supabase.from('webhook_deliveries').insert({
      webhook_id: id,
      evento,
      payload: webhookPayload,
      http_status: null,
      exitoso: false,
      error_mensaje: error.message,
      intento: 1
    })
  }
}

/**
 * Obtiene webhooks del tenant.
 *
 * @param {string} tenantId
 * @returns {Promise<Array>}
 */
const getWebhooks = async (tenantId) => {
  const { data, error } = await supabase
    .from('webhooks')
    .select('id, nombre, url, eventos, activo, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Error al obtener webhooks: ${error.message}`)
  }

  return data
}

/**
 * Obtiene historial de entregas de un webhook.
 *
 * @param {string} webhookId
 * @param {number} limit
 * @returns {Promise<Array>}
 */
const getWebhookDeliveries = async (webhookId, limit = 50) => {
  const { data, error } = await supabase
    .from('webhook_deliveries')
    .select('id, evento, http_status, exitoso, error_mensaje, created_at')
    .eq('webhook_id', webhookId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Error al obtener deliveries: ${error.message}`)
  }

  return data
}

/**
 * Desactiva un webhook.
 *
 * @param {string} webhookId
 * @returns {Promise<void>}
 */
const desactivarWebhook = async (webhookId) => {
  const { error } = await supabase
    .from('webhooks')
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq('id', webhookId)

  if (error) {
    throw new Error(`Error al desactivar webhook: ${error.message}`)
  }

  logger.info(`Webhook desactivado: ${webhookId}`)
}

/**
 * Verifica firma HMAC de un webhook entrante.
 *
 * @param {string} body - Request body
 * @param {string} signature - Firma recibida
 * @param {string} secreto - Secreto del webhook
 * @returns {boolean}
 */
const verificarFirma = (body, signature, secreto) => {
  const expectedSignature = crypto
    .createHmac('sha256', secreto)
    .update(body)
    .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

module.exports = {
  crearWebhook,
  triggerWebhooks,
  getWebhooks,
  getWebhookDeliveries,
  desactivarWebhook,
  verificarFirma
}
