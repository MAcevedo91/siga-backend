const { z } = require('zod')
const { supabase } = require('../utils/db')
const { registrarAuditoria } = require('./auditoriaService')
const { getIO } = require('../utils/socket')
const logger = require('../utils/logger')
const DOMPurify = require('isomorphic-dompurify')

// =============================================================================
// ESQUEMAS DE VALIDACIÓN ZOD
// =============================================================================

const conversacionSchema = z.object({
  tipo: z.enum(['individual', 'grupo']),
  participantes: z.array(z.string().uuid()).min(2, 'Mínimo 2 participantes'),
  nombre: z.string().min(1).max(100).nullish()
})

const mensajeSchema = z.object({
  conversacionId: z.string().uuid(),
  contenido: z.string().min(1, 'Contenido no puede estar vacío'),
  adjunto: z.object({
    url: z.string().url(),
    nombre: z.string(),
    tipo: z.string()
  }).nullish()
})

// =============================================================================
// SERVICIOS
// =============================================================================

/**
 * Crea una conversación (individual o grupal).
 * Si conversación individual ya existe entre esos usuarios, retorna existente.
 */
const crearConversacion = async (tenantId, tipo, participantes, nombre = null) => {
  // Validación
  const validacion = conversacionSchema.safeParse({ tipo, participantes, nombre })
  if (!validacion.success) {
    // Zod v4 returns error.message as JSON string with all errors
    const errors = JSON.parse(validacion.error.message)
    const errorMessages = errors.map(e => e.message).join(', ')
    throw new Error(`Validación fallida: ${errorMessages}`)
  }

  // Si es individual, verificar si ya existe conversación entre estos 2 usuarios
  if (tipo === 'individual' && participantes.length === 2) {
    const { data: existente } = await supabase
      .from('conversaciones')
      .select(`
        id,
        tipo,
        created_at,
        conversacion_participantes!inner(usuario_id)
      `)
      .eq('tenant_id', tenantId)
      .eq('tipo', 'individual')

    // Filtrar en memoria (Supabase no soporta array intersection nativa)
    const conversacionExistente = existente?.find(conv => {
      const participantesIds = conv.conversacion_participantes.map(p => p.usuario_id)
      return participantesIds.length === 2 &&
             participantes.every(id => participantesIds.includes(id))
    })

    if (conversacionExistente) {
      logger.info('Conversación individual ya existe, retornando existente')
      return { id: conversacionExistente.id, tipo: conversacionExistente.tipo, created_at: conversacionExistente.created_at }
    }
  }

  // Crear nueva conversación
  const { data: conversacion, error: errorConv } = await supabase
    .from('conversaciones')
    .insert({
      tenant_id: tenantId,
      tipo,
      nombre
    })
    .select()
    .single()

  if (errorConv) {
    logger.error('Error creando conversación:', errorConv)
    throw new Error(`Error al crear conversación: ${errorConv.message}`)
  }

  // Insertar participantes
  const participantesData = participantes.map(userId => ({
    conversacion_id: conversacion.id,
    usuario_id: userId
  }))

  const { error: errorPart } = await supabase
    .from('conversacion_participantes')
    .insert(participantesData)

  if (errorPart) {
    // Rollback: eliminar conversación creada
    await supabase.from('conversaciones').delete().eq('id', conversacion.id)
    throw new Error(`Error al agregar participantes: ${errorPart.message}`)
  }

  logger.info(`Conversación ${tipo} creada: ${conversacion.id}`)

  return conversacion
}

/**
 * Envía un mensaje en una conversación.
 * Emite evento Socket.io a participantes online.
 * Encola email para participantes offline.
 */
const enviarMensaje = async (tenantId, conversacionId, remitenteId, contenido, adjunto = null) => {
  // Validación
  const validacion = mensajeSchema.safeParse({ conversacionId, contenido, adjunto })
  if (!validacion.success) {
    // Zod v4 returns error.message as JSON string with all errors
    const errors = JSON.parse(validacion.error.message)
    const errorMessages = errors.map(e => e.message).join(', ')
    throw new Error(`Validación fallida: ${errorMessages}`)
  }

  // Sanitizar contenido (prevenir XSS)
  const contenidoLimpio = DOMPurify.sanitize(contenido, { ALLOWED_TAGS: [] }) // Solo texto plano

  // Insertar mensaje
  const { data: mensaje, error } = await supabase
    .from('mensajes')
    .insert({
      conversacion_id: conversacionId,
      remitente_id: remitenteId,
      contenido: contenidoLimpio,
      adjunto_url: adjunto?.url || null,
      adjunto_nombre: adjunto?.nombre || null,
      adjunto_tipo: adjunto?.tipo || null
    })
    .select()
    .single()

  if (error) {
    logger.error('Error enviando mensaje:', error)
    throw new Error(`Error al enviar mensaje: ${error.message}`)
  }

  // Obtener participantes de la conversación
  const { data: participantes } = await supabase
    .from('conversacion_participantes')
    .select('usuario_id')
    .eq('conversacion_id', conversacionId)

  // Emitir evento Socket.io
  const io = getIO()
  const participantesIds = participantes.map(p => p.usuario_id)

  for (const userId of participantesIds) {
    if (userId !== remitenteId) {
      io.to(`user-${userId}`).emit('mensaje:nuevo', {
        conversacionId,
        mensaje
      })
    }
  }

  // TODO: Encolar email para usuarios offline (se implementará en Task 4)

  // Auditoría
  await registrarAuditoria({
    tenantId,
    usuarioId: remitenteId,
    accion: 'ENVIAR_MENSAJE',
    tabla: 'mensajes',
    registroId: mensaje.id,
    descripcion: `Envió mensaje en conversación ${conversacionId}`
  })

  logger.info(`Mensaje enviado: ${mensaje.id}`)

  return mensaje
}

/**
 * Obtiene conversaciones de un usuario con último mensaje y contador no leídos.
 */
const getConversacionesUsuario = async (tenantId, usuarioId) => {
  // Query conversaciones donde usuario es participante
  const { data: conversaciones, error } = await supabase
    .from('conversaciones')
    .select(`
      id,
      tipo,
      nombre,
      created_at,
      conversacion_participantes!inner(usuario_id, ultimo_leido_at),
      mensajes(id, contenido, enviado_at, remitente_id)
    `)
    .eq('tenant_id', tenantId)
    .eq('conversacion_participantes.usuario_id', usuarioId)
    .order('created_at', { ascending: false })

  if (error) {
    logger.error('Error obteniendo conversaciones:', error)
    throw new Error(`Error al obtener conversaciones: ${error.message}`)
  }

  // Calcular último mensaje y contador no leídos
  const resultado = conversaciones.map(conv => {
    const ultimoLeido = conv.conversacion_participantes.find(p => p.usuario_id === usuarioId)?.ultimo_leido_at
    const mensajesOrdenados = conv.mensajes.sort((a, b) => new Date(b.enviado_at) - new Date(a.enviado_at))
    const ultimoMensaje = mensajesOrdenados[0]

    // Contar mensajes no leídos (posteriores a ultimo_leido_at)
    const noLeidos = ultimoLeido
      ? mensajesOrdenados.filter(m => new Date(m.enviado_at) > new Date(ultimoLeido) && m.remitente_id !== usuarioId).length
      : mensajesOrdenados.filter(m => m.remitente_id !== usuarioId).length

    return {
      id: conv.id,
      tipo: conv.tipo,
      nombre: conv.nombre,
      ultimoMensaje: ultimoMensaje ? {
        contenido: ultimoMensaje.contenido.substring(0, 50), // Preview
        enviado_at: ultimoMensaje.enviado_at
      } : null,
      noLeidos
    }
  })

  return resultado
}

/**
 * Obtiene mensajes paginados de una conversación.
 */
const getMensajes = async (tenantId, conversacionId, limit = 50, offset = 0) => {
  // Verificar conversación pertenece al tenant
  const { data: conv } = await supabase
    .from('conversaciones')
    .select('id')
    .eq('id', conversacionId)
    .eq('tenant_id', tenantId)
    .single()

  if (!conv) {
    throw new Error('Conversación no encontrada')
  }

  // Query mensajes
  const { data: mensajes, error } = await supabase
    .from('mensajes')
    .select(`
      id,
      contenido,
      adjunto_url,
      adjunto_nombre,
      adjunto_tipo,
      enviado_at,
      editado_at,
      remitente:usuarios!remitente_id(id, nombre, apellido)
    `)
    .eq('conversacion_id', conversacionId)
    .order('enviado_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    logger.error('Error obteniendo mensajes:', error)
    throw new Error(`Error al obtener mensajes: ${error.message}`)
  }

  return mensajes
}

/**
 * Marca conversación como leída (actualiza ultimo_leido_at).
 */
const marcarLeido = async (tenantId, conversacionId, usuarioId) => {
  // Verificar usuario es participante
  const { data: participante } = await supabase
    .from('conversacion_participantes')
    .select('conversacion_id')
    .eq('conversacion_id', conversacionId)
    .eq('usuario_id', usuarioId)
    .single()

  if (!participante) {
    throw new Error('Usuario no es participante de esta conversación')
  }

  // Update ultimo_leido_at
  const { error } = await supabase
    .from('conversacion_participantes')
    .update({ ultimo_leido_at: new Date().toISOString() })
    .eq('conversacion_id', conversacionId)
    .eq('usuario_id', usuarioId)

  if (error) {
    logger.error('Error marcando conversación como leída:', error)
    throw new Error(`Error: ${error.message}`)
  }

  // Emitir evento Socket.io a otros participantes
  const io = getIO()
  io.to(`conversation-${conversacionId}`).emit('mensaje:leido', {
    conversacionId,
    usuarioId,
    timestamp: new Date().toISOString()
  })

  logger.info(`Conversación ${conversacionId} marcada como leída por ${usuarioId}`)
}

module.exports = {
  crearConversacion,
  enviarMensaje,
  getConversacionesUsuario,
  getMensajes,
  marcarLeido
}
