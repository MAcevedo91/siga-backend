const { supabase } = require('../utils/db')
const { getIO } = require('../sockets')
const logger = require('../utils/logger')

async function crearNotificacion({ userId, tenantId, tipo, titulo, mensaje, url = null, metadata = {} }) {
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
        metadata,
        leida: false
      })
      .select()
      .single()

    if (error) throw new Error(error.message)

    // Emit socket event to user room with graceful fallback
    try {
      const io = getIO()
      if (io) {
        io.to(`user-${userId}`).emit('notificacion:nueva', data)
      }
    } catch (sockErr) {
      logger.warn('Socket no disponible para emitir notificación en tiempo real, persistida en BD', {
        userId,
        error: sockErr.message
      })
    }

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

/**
 * Notifica a todos los usuarios activos que posean alguno de los roles indicados dentro del tenant.
 */
async function notificarUsuariosPorRol({ tenantId, roles, tipo, titulo, mensaje, url = null, metadata = {} }) {
  try {
    const { data: usuarios, error } = await supabase
      .from('usuarios')
      .select('id, rol')
      .eq('tenant_id', tenantId)
      .eq('activo', true)
      .in('rol', roles)

    if (error || !usuarios || usuarios.length === 0) return []

    const promesas = usuarios.map(usuario =>
      crearNotificacion({
        userId: usuario.id,
        tenantId,
        tipo,
        titulo,
        mensaje,
        url,
        metadata
      }).catch(err => {
        logger.error('Error al notificar usuario por rol', { error: err.message, userId: usuario.id })
        return null
      })
    )

    const resultados = await Promise.all(promesas)
    return resultados.filter(Boolean)
  } catch (error) {
    logger.error('Error en notificarUsuariosPorRol', { error: error.message, roles, tenantId })
    return []
  }
}

/**
 * Notifica al profesor jefe del curso al que pertenece el estudiante (si tiene uno asignado).
 */
async function notificarJefaturaEstudiante({ tenantId, estudianteId, tipo, titulo, mensaje, url = null, metadata = {} }) {
  try {
    const { data: estudiante, error: estErr } = await supabase
      .from('estudiantes')
      .select('id, nombre, apellido, curso_id, cursos(id, nombre, profesor_jefe_id)')
      .eq('id', estudianteId)
      .eq('tenant_id', tenantId)
      .single()

    if (estErr || !estudiante?.cursos?.profesor_jefe_id) return null

    return await crearNotificacion({
      userId: estudiante.cursos.profesor_jefe_id,
      tenantId,
      tipo,
      titulo,
      mensaje,
      url,
      metadata
    })
  } catch (error) {
    logger.error('Error en notificarJefaturaEstudiante', { error: error.message, estudianteId })
    return null
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
  notificarUsuariosPorRol,
  notificarJefaturaEstudiante,
  obtenerNotificaciones,
  marcarComoLeida,
  contarNoLeidas,
  marcarTodasComoLeidas
}
