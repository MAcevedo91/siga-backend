const { z } = require('zod')
const { supabase } = require('../utils/db')
const { registrarAuditoria } = require('./auditoriaService')
const { enviarEmail } = require('./emailService')
const logger = require('../utils/logger')
const DOMPurify = require('isomorphic-dompurify')
const Queue = require('bull')

// Bull queue para broadcasts
const broadcastQueue = new Queue('broadcast-enviar', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  },
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 3000
    },
    removeOnComplete: true,
    removeOnFail: false
  }
})

// Event listeners for monitoring
broadcastQueue.on('completed', (job) => {
  logger.info('Broadcast job completed', {
    jobId: job.id,
    broadcastId: job.data.broadcastId
  })
})

broadcastQueue.on('failed', (job, err) => {
  logger.error('Broadcast job failed', {
    jobId: job.id,
    broadcastId: job.data.broadcastId,
    error: err.message
  })
})

// =============================================================================
// ESQUEMAS DE VALIDACIÓN
// =============================================================================

const broadcastSchema = z.object({
  titulo: z.string().min(1).max(200),
  contenido: z.string().min(1),
  destinatarios_tipo: z.enum(['curso', 'nivel', 'rol', 'todos']),
  destinatarios_ids: z.array(z.string().uuid()).optional(),
  programado_para: z.string().datetime().optional(),
  confirmacion_lectura: z.boolean().default(false)
})

// =============================================================================
// SERVICIOS
// =============================================================================

/**
 * Crea un broadcast (comunicado masivo).
 * Si programado_para está presente, se encola para envío futuro.
 * Si no, se envía inmediatamente.
 */
const crearBroadcast = async (tenantId, data, usuarioId) => {
  // Validación
  const validacion = broadcastSchema.safeParse(data)
  if (!validacion.success) {
    const errorMessages = validacion.error?.errors?.map(e => e.message).join(', ') || 'Datos inválidos'
    throw new Error(`Validación fallida: ${errorMessages}`)
  }

  const { titulo, contenido, destinatarios_tipo, destinatarios_ids, programado_para, confirmacion_lectura } = validacion.data

  // Sanitizar contenido
  const contenidoLimpio = DOMPurify.sanitize(contenido)

  // Insertar broadcast
  const { data: broadcast, error } = await supabase
    .from('broadcasts')
    .insert({
      tenant_id: tenantId,
      titulo,
      contenido: contenidoLimpio,
      enviado_por: usuarioId,
      destinatarios_tipo,
      destinatarios_ids: destinatarios_ids || [],
      programado_para: programado_para || null,
      enviado_at: programado_para ? null : new Date().toISOString(), // Si inmediato, marcar enviado
      confirmacion_lectura
    })
    .select()
    .single()

  if (error) {
    logger.error('Error creando broadcast:', error)
    throw new Error(`Error al crear broadcast: ${error.message}`)
  }

  // Si es inmediato, encolar para envío
  if (!programado_para) {
    await broadcastQueue.add(
      { broadcastId: broadcast.id, tenantId },
      { priority: 3 }
    )
  }

  // Auditoría
  await registrarAuditoria({
    tenantId,
    userId: usuarioId,
    accion: 'CREAR_BROADCAST',
    tabla: 'broadcasts',
    registroId: broadcast.id,
    datosBefore: null,
    datosAfter: broadcast
  })

  logger.info(`Broadcast creado: ${broadcast.id}`)

  return broadcast
}

/**
 * Calcula destinatarios finales según tipo.
 */
const calcularDestinatarios = async (tenantId, tipo, ids) => {
  let usuariosIds = []

  switch (tipo) {
    case 'todos':
      const { data: todosUsers } = await supabase
        .from('usuarios')
        .select('id')
        .eq('tenant_id', tenantId)
      usuariosIds = todosUsers ? todosUsers.map(u => u.id) : []
      break

    case 'rol':
      const { data: roleUsers } = await supabase
        .from('usuarios')
        .select('id')
        .eq('tenant_id', tenantId)
        .in('rol', ids) // ids contiene nombres de roles
      usuariosIds = roleUsers ? roleUsers.map(u => u.id) : []
      break

    case 'curso':
      // Obtener estudiantes + profesores de cursos
      const { data: estudiantes } = await supabase
        .from('estudiantes')
        .select('id')
        .eq('tenant_id', tenantId)
        .in('curso_id', ids)

      // TODO: Agregar profesores del curso (requiere tabla profesores_cursos)
      usuariosIds = estudiantes ? estudiantes.map(e => e.id) : []
      break

    case 'nivel':
      // Obtener cursos del nivel, luego estudiantes
      // TODO: Implementar lógica de niveles (requiere campo nivel en cursos)
      break

    default:
      throw new Error(`Tipo de destinatarios inválido: ${tipo}`)
  }

  return usuariosIds
}

/**
 * Envía broadcast a destinatarios (llamado por Bull job).
 */
const enviarBroadcast = async (broadcastId, tenantId) => {
  // Obtener broadcast
  const { data: broadcast, error } = await supabase
    .from('broadcasts')
    .select('*')
    .eq('id', broadcastId)
    .single()

  if (error) {
    throw new Error(`Broadcast no encontrado: ${error.message}`)
  }

  // Calcular destinatarios
  const usuariosIds = await calcularDestinatarios(
    tenantId,
    broadcast.destinatarios_tipo,
    broadcast.destinatarios_ids
  )

  logger.info(`Enviando broadcast ${broadcastId} a ${usuariosIds.length} usuarios`)

  // Enviar email a cada usuario
  for (const userId of usuariosIds) {
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('email, nombre, apellido')
      .eq('id', userId)
      .single()

    if (!usuario) continue

    const htmlContent = `
      <h2>${broadcast.titulo}</h2>
      <div>${broadcast.contenido}</div>

      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />

      <p>
        <a href="${process.env.FRONTEND_URL}/broadcasts/${broadcastId}"
           style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Ver Comunicado Completo
        </a>
      </p>

      <p><small>Comunicado oficial de SIGA Escolar</small></p>
    `

    try {
      await enviarEmail({
        to: usuario.email,
        subject: `📢 ${broadcast.titulo}`,
        html: htmlContent
      })
    } catch (error) {
      logger.error(`Error enviando email a ${usuario.email}:`, error)
    }
  }

  // Marcar como enviado
  await supabase
    .from('broadcasts')
    .update({ enviado_at: new Date().toISOString() })
    .eq('id', broadcastId)

  logger.info(`Broadcast ${broadcastId} enviado exitosamente`)
}

/**
 * Obtiene broadcasts enviados por un usuario.
 */
const getBroadcastsEnviados = async (tenantId, usuarioId, limit = 20, offset = 0) => {
  const { data, error } = await supabase
    .from('broadcasts')
    .select(`
      id,
      titulo,
      contenido,
      destinatarios_tipo,
      destinatarios_ids,
      enviado_at,
      programado_para,
      broadcast_lecturas(count)
    `)
    .eq('tenant_id', tenantId)
    .eq('enviado_por', usuarioId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    throw new Error(`Error: ${error.message}`)
  }

  // Calcular total destinatarios
  const resultado = await Promise.all(data.map(async b => {
    const destinatarios = await calcularDestinatarios(tenantId, b.destinatarios_tipo, b.destinatarios_ids || [])
    return {
      ...b,
      totalDestinatarios: destinatarios.length,
      leidos: b.broadcast_lecturas[0]?.count || 0
    }
  }))

  return resultado
}

/**
 * Obtiene broadcasts recibidos por un usuario.
 */
const getBroadcastsRecibidos = async (tenantId, usuarioId, limit = 20, offset = 0) => {
  // Query broadcasts donde usuario es destinatario (según tipo)
  // Simplificado: retorna todos los broadcasts del tenant
  const { data, error } = await supabase
    .from('broadcasts')
    .select(`
      id,
      titulo,
      contenido,
      enviado_at,
      broadcast_lecturas!left(leido_at, usuario_id)
    `)
    .eq('tenant_id', tenantId)
    .not('enviado_at', 'is', null)
    .order('enviado_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    throw new Error(`Error: ${error.message}`)
  }

  // Filtrar broadcasts donde usuario es destinatario real
  // TODO: Implementar filtro según destinatarios_tipo/ids

  return data.map(b => ({
    ...b,
    leido: b.broadcast_lecturas && b.broadcast_lecturas.some(l => l.usuario_id === usuarioId)
  }))
}

/**
 * Marca broadcast como leído por un usuario.
 */
const marcarBroadcastLeido = async (broadcastId, usuarioId) => {
  const { error } = await supabase
    .from('broadcast_lecturas')
    .insert({
      broadcast_id: broadcastId,
      usuario_id: usuarioId
    })
    .onConflict('broadcast_id,usuario_id')

  if (error && error.code !== '23505') { // Ignorar duplicates
    throw new Error(`Error: ${error.message}`)
  }

  logger.info(`Broadcast ${broadcastId} marcado leído por ${usuarioId}`)
}

module.exports = {
  crearBroadcast,
  calcularDestinatarios,
  enviarBroadcast,
  getBroadcastsEnviados,
  getBroadcastsRecibidos,
  marcarBroadcastLeido,
  broadcastQueue
}
