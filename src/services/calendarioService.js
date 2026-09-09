const { z } = require('zod')
const { supabase } = require('../utils/db')
const { registrarAuditoria } = require('./auditoriaService')
const logger = require('../utils/logger')

// =============================================================================
// ESQUEMA DE VALIDACIÓN ZOD
// =============================================================================

const eventoSchema = z.object({
  titulo: z.string().min(3, 'Título debe tener al menos 3 caracteres').max(255),
  descripcion: z.string().optional(),
  tipo: z.enum(['Reunión', 'Ceremonia', 'Actividad Curricular', 'Taller', 'Otro']),
  fechaInicio: z.string().datetime('Formato de fecha inválido'),
  fechaFin: z.string().datetime('Formato de fecha inválido'),
  ubicacion: z.string().max(255).optional(),
  cursoId: z.string().uuid().nullable().optional(),
  esPublico: z.boolean().default(false),
  participantes: z.array(
    z.object({
      usuarioId: z.string().uuid().optional(),
      estudianteId: z.string().uuid().optional()
    }).refine(data => data.usuarioId || data.estudianteId, {
      message: 'Debe especificar usuarioId o estudianteId'
    })
  ).optional(),
  recordatorios: z.array(
    z.number().int().positive()
  ).optional() // [15, 30, 60, 1440] minutos antes
}).refine(data => new Date(data.fechaFin) >= new Date(data.fechaInicio), {
  message: 'fechaFin debe ser mayor o igual a fechaInicio'
})

// =============================================================================
// SERVICIOS
// =============================================================================

/**
 * Crea un evento en el calendario.
 *
 * @param {string} tenantId - UUID del tenant
 * @param {Object} data - Datos del evento
 * @param {string} usuarioId - UUID del usuario creador
 * @returns {Promise<Object>} - Evento creado con id
 * @throws {Error} Si validación falla o error de base de datos
 */
const crearEvento = async (tenantId, data, usuarioId) => {
  // Validación
  const validacion = eventoSchema.safeParse(data)
  if (!validacion.success) {
    const errores = validacion.error.issues.map(e => e.message).join(', ')
    throw new Error(`Validación fallida: ${errores}`)
  }

  const {
    titulo,
    descripcion,
    tipo,
    fechaInicio,
    fechaFin,
    ubicacion,
    cursoId,
    esPublico,
    participantes,
    recordatorios
  } = validacion.data

  // Insertar evento
  const { data: evento, error: eventoError } = await supabase
    .from('eventos')
    .insert({
      tenant_id: tenantId,
      titulo,
      descripcion: descripcion || null,
      tipo,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      ubicacion: ubicacion || null,
      creado_por: usuarioId,
      curso_id: cursoId || null,
      es_publico: esPublico
    })
    .select('id, titulo, tipo, fecha_inicio, fecha_fin')
    .single()

  if (eventoError) {
    logger.error('Error creando evento:', eventoError)
    throw new Error(`Error al crear evento: ${eventoError.message}`)
  }

  // Insertar participantes si existen
  if (participantes && participantes.length > 0) {
    const participantesData = participantes.map(p => ({
      evento_id: evento.id,
      usuario_id: p.usuarioId || null,
      estudiante_id: p.estudianteId || null,
      estado_confirmacion: 'Pendiente'
    }))

    const { error: partError } = await supabase
      .from('evento_participantes')
      .insert(participantesData)

    if (partError) {
      logger.error('Error agregando participantes:', partError)
      // No lanzar error, solo log
    }
  }

  // Insertar recordatorios si existen
  if (recordatorios && recordatorios.length > 0) {
    const recordatoriosData = recordatorios.map(minutos => ({
      evento_id: evento.id,
      minutos_antes: minutos
    }))

    const { error: recError } = await supabase
      .from('evento_recordatorios')
      .insert(recordatoriosData)

    if (recError) {
      logger.error('Error creando recordatorios:', recError)
      // No lanzar error, solo log
    }
  }

  // Auditoría
  await registrarAuditoria({
    tenantId,
    userId: usuarioId,
    accion: 'CREAR_EVENTO',
    tabla: 'eventos',
    registroId: evento.id,
    datosBefore: null,
    datosAfter: { titulo, tipo, fechaInicio, fechaFin }
  })

  logger.info(`Evento creado: ${evento.id} - ${titulo}`)

  return evento
}

/**
 * Obtiene eventos del calendario con filtros.
 *
 * @param {string} tenantId
 * @param {Object} filtros - { fechaInicio?, fechaFin?, tipo?, cursoId?, usuarioId? }
 * @returns {Promise<Array>} - Lista de eventos
 */
const getEventos = async (tenantId, filtros = {}) => {
  const { fechaInicio, fechaFin, tipo, cursoId, usuarioId } = filtros

  let query = supabase
    .from('eventos')
    .select(`
      id,
      titulo,
      descripcion,
      tipo,
      fecha_inicio,
      fecha_fin,
      ubicacion,
      es_publico,
      curso_id,
      cursos(nombre),
      evento_participantes(
        id,
        usuario_id,
        estudiante_id,
        estado_confirmacion
      )
    `)
    .eq('tenant_id', tenantId)
    .order('fecha_inicio', { ascending: true })

  // Filtros opcionales
  if (fechaInicio) {
    query = query.gte('fecha_inicio', fechaInicio)
  }

  if (fechaFin) {
    query = query.lte('fecha_fin', fechaFin)
  }

  if (tipo) {
    query = query.eq('tipo', tipo)
  }

  if (cursoId) {
    query = query.eq('curso_id', cursoId)
  }

  const { data, error } = await query

  if (error) {
    logger.error('Error obteniendo eventos:', error)
    throw new Error(`Error al obtener eventos: ${error.message}`)
  }

  // Filtrar por usuarioId si se especifica (eventos públicos o donde es participante)
  if (usuarioId) {
    return data.filter(evento =>
      evento.es_publico ||
      evento.evento_participantes.some(p => p.usuario_id === usuarioId)
    )
  }

  return data
}

/**
 * Actualiza confirmación de participante en evento.
 *
 * @param {string} participanteId - UUID del registro evento_participantes
 * @param {string} estado - 'Confirmado' | 'Rechazado'
 * @param {string} usuarioId - Usuario que actualiza
 * @returns {Promise<Object>}
 */
const actualizarConfirmacion = async (participanteId, estado, usuarioId) => {
  if (!['Confirmado', 'Rechazado'].includes(estado)) {
    throw new Error('Estado debe ser Confirmado o Rechazado')
  }

  const { data, error } = await supabase
    .from('evento_participantes')
    .update({ estado_confirmacion: estado })
    .eq('id', participanteId)
    .select('id, evento_id, estado_confirmacion')
    .single()

  if (error) {
    logger.error('Error actualizando confirmación:', error)
    throw new Error(`Error al actualizar confirmación: ${error.message}`)
  }

  logger.info(`Confirmación actualizada: ${participanteId} -> ${estado}`)

  return data
}

/**
 * Elimina un evento (solo si fue creado por el usuario o es admin).
 *
 * @param {string} eventoId
 * @param {string} usuarioId
 * @returns {Promise<void>}
 */
const eliminarEvento = async (eventoId, usuarioId) => {
  // Verificar que el evento existe y fue creado por este usuario
  const { data: evento, error: checkError } = await supabase
    .from('eventos')
    .select('id, creado_por, titulo')
    .eq('id', eventoId)
    .single()

  if (checkError || !evento) {
    throw new Error('Evento no encontrado')
  }

  if (evento.creado_por !== usuarioId) {
    throw new Error('Solo el creador puede eliminar este evento')
  }

  const { error } = await supabase
    .from('eventos')
    .delete()
    .eq('id', eventoId)

  if (error) {
    logger.error('Error eliminando evento:', error)
    throw new Error(`Error al eliminar evento: ${error.message}`)
  }

  logger.info(`Evento eliminado: ${eventoId}`)
}

module.exports = {
  crearEvento,
  getEventos,
  actualizarConfirmacion,
  eliminarEvento
}
