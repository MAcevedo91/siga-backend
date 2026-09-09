const { supabase } = require('../utils/db')
const { getIO } = require('../sockets')
const logger = require('../utils/logger')

async function crearNotificacion({ userId, tenantId, tipo, titulo, mensaje, url = null }) {
  try {
    const { data, error } = await supabase
      .from('notificaciones')
      .insert({
        usuario_id: userId,
        tenant_id: tenantId,
        tipo,
        titulo,
        mensaje,
        url,
        leida: false
      })
      .select()
      .single()

    if (error) throw new Error(error.message)

    // Emit socket event to user
    const io = getIO()
    io.to(`user-${userId}`).emit('notificacion:nueva', data)

    logger.info('Notificación creada y emitida', {
      notificacionId: data.id,
      userId,
      tipo
    })

    return data
  } catch (error) {
    logger.error('Error al crear notificación', { error: error.message, userId, tipo })
    throw error
  }
}

async function obtenerNotificaciones(userId, tenantId) {
  const { data, error } = await supabase
    .from('notificaciones')
    .select('*')
    .eq('usuario_id', userId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data
}

async function marcarComoLeida(notificacionId, userId) {
  const { error } = await supabase
    .from('notificaciones')
    .update({
      leida: true,
      leida_at: new Date().toISOString()
    })
    .eq('id', notificacionId)
    .eq('usuario_id', userId)
    .select()

  if (error) throw new Error(error.message)

  logger.debug('Notificación marcada como leída', { notificacionId, userId })
}

async function contarNoLeidas(userId) {
  const { count, error } = await supabase
    .from('notificaciones')
    .select('*', { count: 'exact', head: true })
    .eq('usuario_id', userId)
    .eq('leida', false)

  if (error) throw new Error(error.message)
  return count
}

async function marcarTodasComoLeidas(userId, tenantId) {
  const { error } = await supabase
    .from('notificaciones')
    .update({
      leida: true,
      leida_at: new Date().toISOString()
    })
    .eq('usuario_id', userId)
    .eq('tenant_id', tenantId)
    .eq('leida', false)

  if (error) throw new Error(error.message)

  logger.info('Todas las notificaciones marcadas como leídas', { userId })
}

module.exports = {
  crearNotificacion,
  obtenerNotificaciones,
  marcarComoLeida,
  contarNoLeidas,
  marcarTodasComoLeidas
}
