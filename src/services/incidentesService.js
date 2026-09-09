const { z }                 = require('zod')
const { supabase }          = require('../utils/db')
const { crearAlerta }       = require('./notificacionService')
const { invalidateIncidentes } = require('../utils/cacheInvalidator')
const emailService          = require('./emailService')
const notificacionesService = require('./notificacionesService')
const logger                = require('../utils/logger')
const { registrarAuditoria } = require('./auditoriaService')

// =============================================================================
// ESQUEMA DE VALIDACIÓN ZOD
// =============================================================================

const incidenteSchema = z.object({
  tipo_abordaje_id: z.number({ required_error: 'El tipo de abordaje es requerido' }),
  fecha:            z.string({ required_error: 'La fecha es requerida' })
                     .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido. Use YYYY-MM-DD'),
  gravedad:         z.enum(['Leve', 'Grave', 'Gravísima'], {
                      required_error: 'La gravedad es requerida',
                      invalid_type_error: 'Gravedad inválida. Use: Leve, Grave o Gravísima',
                    }),
  relato:           z.string({ required_error: 'El relato es requerido' })
                     .min(20, 'El relato debe tener al menos 20 caracteres'),
  medidas:          z.string().optional(),
  estudiantes:      z.array(z.object({
                      estudiante_id: z.string().uuid('estudiante_id debe ser un UUID válido'),
                      es_victima:    z.boolean().optional().nullable(),
                      observacion:   z.string().optional().nullable(),
                    }))
                    .min(1, 'Debe incluir al menos un estudiante involucrado'),
})

// Transiciones de estado permitidas
const TRANSICIONES = {
  'En Investigación': 'Derivado',
  'Derivado':         'Cerrado',
}

// =============================================================================
// SERVICIOS
// =============================================================================

/**
 * Lista incidentes con filtros opcionales.
 */
const listarIncidentes = async (tenantId, filtros = {}) => {
  const { estado, gravedad, fecha_desde, fecha_hasta, estudiante_id } = filtros

  let query = supabase
    .from('incidentes')
    .select(`
      id, fecha, gravedad, estado, relato, medidas, fecha_creacion,
      tipos_abordaje ( nombre ),
      usuarios ( nombre, apellido ),
      incidente_estudiantes ( estudiante_id )
    `)
    .eq('tenant_id', tenantId)
    .order('fecha_creacion', { ascending: false })

  if (estado)       query = query.eq('estado', estado)
  if (gravedad)     query = query.eq('gravedad', gravedad)
  if (fecha_desde)  query = query.gte('fecha', fecha_desde)
  if (fecha_hasta)  query = query.lte('fecha', fecha_hasta)

  // Filtro por estudiante involucrado
  if (estudiante_id) {
    const { data: incidenteIds } = await supabase
      .from('incidente_estudiantes')
      .select('incidente_id')
      .eq('estudiante_id', estudiante_id)

    const ids = (incidenteIds || []).map(r => r.incidente_id)
    if (ids.length === 0) return []
    query = query.in('id', ids)
  }

  const { data, error } = await query
  if (error) throw error

  return data.map(inc => ({
    ...inc,
    tipo_abordaje: inc.tipos_abordaje?.nombre,
    estudiantes_count: inc.incidente_estudiantes?.length || 0,
  }))
}

/**
 * Retorna el detalle completo de un incidente con estudiantes involucrados.
 */
const obtenerIncidente = async (id, tenantId) => {
  const { data, error } = await supabase
    .from('incidentes')
    .select(`
      id, fecha, gravedad, estado, relato, medidas, fecha_creacion,
      tipos_abordaje ( id, nombre ),
      usuarios ( id, nombre, apellido, rol )
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (error || !data) {
    const err = new Error('Incidente no encontrado')
    err.statusCode = 404
    throw err
  }

  // Estudiantes involucrados
  const { data: estudiantes } = await supabase
    .from('incidente_estudiantes')
    .select(`
      es_victima, observacion,
      estudiantes ( id, rut, nombre, apellido )
    `)
    .eq('incidente_id', id)

  const flatEstudiantes = (estudiantes || []).map(e => ({
    ...e.estudiantes,
    es_victima: e.es_victima,
    observacion: e.observacion,
  }))

  return {
    ...data,
    estudiantes: flatEstudiantes,
  }
}

/**
 * Registra un nuevo incidente con sus estudiantes involucrados.
 * Si la gravedad es Grave o Gravísima, dispara notificaciones automáticas.
 */
const crearIncidente = async (tenantId, usuarioId, body) => {
  // 1. Validar con Zod
  const resultado = incidenteSchema.safeParse(body)
  if (!resultado.success) {
    // En Zod v3 los errores están en .issues (parseados desde .message)
    let issues = []
    try {
      issues = JSON.parse(resultado.error.message)
    } catch {
      issues = []
    }
    const mensajes = issues.length > 0
      ? issues.map(e => e.message).join('. ')
      : 'Datos inválidos en el body del request'
    const err = new Error(mensajes)
    err.statusCode = 400
    throw err
  }

  const { tipo_abordaje_id, fecha, gravedad, relato, medidas, estudiantes } = resultado.data

  // 2. Insertar incidente
  const { data: incidente, error: incidenteError } = await supabase
    .from('incidentes')
    .insert({
      tenant_id:        tenantId,
      usuario_id:       usuarioId,
      tipo_abordaje_id,
      fecha,
      gravedad,
      relato,
      medidas:          medidas || null,
      estado:           'En Investigación',
    })
    .select()
    .single()

  if (incidenteError) throw incidenteError

  // 3. Insertar estudiantes involucrados
  const involucrados = estudiantes.map(e => ({
    incidente_id:  incidente.id,
    estudiante_id: e.estudiante_id,
    es_victima:    e.es_victima ?? null,
    observacion:   e.observacion ?? null,
  }))

  const { error: estudiantesError } = await supabase
    .from('incidente_estudiantes')
    .insert(involucrados)

  if (estudiantesError) {
    // Rollback manual: eliminar el incidente si falla la inserción de estudiantes
    await supabase.from('incidentes').delete().eq('id', incidente.id)
    throw estudiantesError
  }

  // 4. Si gravedad es Grave o Gravísima, enviar email al apoderado y crear notificaciones
  if (gravedad === 'Grave' || gravedad === 'Gravísima') {
    const { data: primerEstudiante } = await supabase
      .from('estudiantes')
      .select(`
        id, nombre, apellido,
        apoderados ( email, nombre )
      `)
      .eq('id', estudiantes[0].estudiante_id)
      .single()

    // Fire-and-forget alerta (legacy system)
    setImmediate(() => crearAlerta({
      ...incidente,
      estudiante_nombre: primerEstudiante
        ? `${primerEstudiante.nombre} ${primerEstudiante.apellido}`
        : 'Estudiante',
    }, tenantId))

    // Send email to apoderado if email exists
    if (primerEstudiante?.apoderados?.email) {
      emailService.enviarEmailIncidenteGrave({
        apoderadoEmail: primerEstudiante.apoderados.email,
        estudianteNombre: `${primerEstudiante.nombre} ${primerEstudiante.apellido}`,
        incidenteDescripcion: relato,
        gravedadLabel: gravedad,
        fecha: new Date(fecha).toLocaleDateString('es-CL')
      }).catch(err => {
        logger.error('Error sending incidente email', {
          incidenteId: incidente.id,
          error: err.message
        })
      })

      logger.info('Email incidente grave queued', {
        incidenteId: incidente.id,
        apoderadoEmail: primerEstudiante.apoderados.email
      })
    }

    // Create notifications for admins and coordinadores
    const { data: usuarios } = await supabase
      .from('usuarios')
      .select('id')
      .eq('tenant_id', tenantId)
      .in('rol', ['Administrador', 'Coordinador'])

    if (usuarios) {
      for (const usuario of usuarios) {
        notificacionesService.crearNotificacion({
          userId: usuario.id,
          tenantId: tenantId,
          tipo: 'incidente',
          titulo: `Nuevo incidente ${gravedad}`,
          mensaje: `Se ha registrado un nuevo incidente: ${relato.substring(0, 100)}${relato.length > 100 ? '...' : ''}`,
          url: `/incidentes/${incidente.id}`
        }).catch(err => {
          logger.error('Error creating notification', {
            error: err.message,
            userId: usuario.id,
            incidenteId: incidente.id
          })
        })
      }
    }
  }

  // 5. Registrar auditoría de creación
  await registrarAuditoria({
    tenantId,
    userId: usuarioId,
    accion: 'CREATE',
    tabla: 'incidentes',
    registroId: incidente.id,
    datosBefore: null,
    datosAfter: incidente
  }).catch(err => {
    logger.error('Error registering audit', {
      error: err.message,
      incidenteId: incidente.id
    })
  })

  // 6. Invalidar cache después de crear incidente
  await invalidateIncidentes(tenantId)

  // 7. Retornar incidente completo
  return obtenerIncidente(incidente.id, tenantId)
}

/**
 * Cambia el estado de un incidente validando las transiciones permitidas.
 */
const cambiarEstado = async (id, tenantId, nuevoEstado, userId) => {
  // Get current state BEFORE update
  const { data: before, error: beforeError } = await supabase
    .from('incidentes')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (beforeError || !before) {
    const err = new Error('Incidente no encontrado')
    err.statusCode = 404
    throw err
  }

  const estadoActual = before.estado
  const transicionPermitida = TRANSICIONES[estadoActual]

  if (!transicionPermitida || transicionPermitida !== nuevoEstado) {
    const err = new Error(
      `Transición de estado no permitida. El estado "${estadoActual}" solo puede avanzar a "${transicionPermitida || 'ninguno (ya está cerrado)'}"`
    )
    err.statusCode = 400
    throw err
  }

  // Perform update
  const { data: after, error } = await supabase
    .from('incidentes')
    .update({ estado: nuevoEstado })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select('*')
    .single()

  if (error) throw error

  // Register audit with diff
  if (userId) {
    await registrarAuditoria({
      tenantId,
      userId,
      accion: 'UPDATE',
      tabla: 'incidentes',
      registroId: id,
      datosBefore: before,
      datosAfter: after
    }).catch(err => {
      logger.error('Error registering audit', {
        error: err.message,
        incidenteId: id
      })
    })
  }

  // Invalidar cache después de cambiar estado
  await invalidateIncidentes(tenantId)

  return after
}

/**
 * Lista los tipos de abordaje (catálogo).
 */
const listarTiposAbordaje = async () => {
  const { data, error } = await supabase
    .from('tipos_abordaje')
    .select('id, nombre')
    .order('id')

  if (error) throw error
  return data
}

module.exports = {
  listarIncidentes,
  obtenerIncidente,
  crearIncidente,
  cambiarEstado,
  listarTiposAbordaje,
}
