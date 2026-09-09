const { z }                 = require('zod')
const { supabase }          = require('../utils/db')
const emailService          = require('./emailService')
const notificacionesService = require('./notificacionesService')
const { registrarAuditoria } = require('./auditoriaService')
const logger                = require('../utils/logger')

// =============================================================================
// ESQUEMA DE VALIDACIÓN ZOD
// =============================================================================

const protocoloSchema = z.object({
  estudiante_id:     z.string().uuid('estudiante_id debe ser un UUID válido'),
  tipo_protocolo_id: z.number({ required_error: 'El tipo de protocolo es requerido' }),
  fecha_apertura:    z.string({ required_error: 'La fecha de apertura es requerida' })
                      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido. Use YYYY-MM-DD'),
  incidente_id:      z.string().uuid().optional().nullable(),
  observaciones:     z.string().optional().nullable(),
})

// Transiciones de estado permitidas (igual que incidentes)
const TRANSICIONES = {
  'En Investigación': 'Derivado',
  'Derivado':         'Cerrado',
}

// =============================================================================
// SERVICIOS
// =============================================================================

/**
 * Lista protocolos con filtros opcionales.
 */
const listarProtocolos = async (tenantId, filtros = {}) => {
  const { estado, tipo_protocolo_id, estudiante_id } = filtros

  let query = supabase
    .from('protocolos_rice')
    .select(`
      id, estado, fecha_apertura, fecha_cierre, observaciones, fecha_creacion,
      tipos_protocolo ( id, nombre ),
      estudiantes ( id, rut, nombre, apellido ),
      usuarios ( id, nombre, apellido )
    `)
    .eq('tenant_id', tenantId)
    .order('fecha_creacion', { ascending: false })

  if (estado)            query = query.eq('estado', estado)
  if (tipo_protocolo_id) query = query.eq('tipo_protocolo_id', tipo_protocolo_id)
  if (estudiante_id)     query = query.eq('estudiante_id', estudiante_id)

  const { data, error } = await query
  if (error) throw error

  return data.map(prot => ({
    ...prot,
    tipo_protocolo: prot.tipos_protocolo?.nombre,
    estudiante: prot.estudiantes,
  }))
}

/**
 * Retorna el detalle completo de un protocolo.
 */
const obtenerProtocolo = async (id, tenantId) => {
  const { data, error } = await supabase
    .from('protocolos_rice')
    .select(`
      id, estado, fecha_apertura, fecha_cierre, observaciones, fecha_creacion,
      tipos_protocolo ( id, nombre ),
      estudiantes ( id, rut, nombre, apellido ),
      usuarios ( id, nombre, apellido )
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  const mapProtocolo = (prot) => ({
    ...prot,
    tipo_protocolo: prot.tipos_protocolo?.nombre,
    estudiante: prot.estudiantes,
  })

  if (error || !data) {
    const err = new Error('Protocolo no encontrado')
    err.statusCode = 404
    throw err
  }

  const pasos = await listarPasosProtocolo(id, tenantId).catch(() => [])

  return {
    ...mapProtocolo(data),
    pasos,
  }
}

/**
 * Abre un nuevo protocolo RICE.
 * Si viene incidente_id, valida que el estudiante pertenezca a ese incidente.
 */
const crearProtocolo = async (tenantId, usuarioId, body) => {
  // 1. Validar con Zod
  const resultado = protocoloSchema.safeParse(body)
  if (!resultado.success) {
    let issues = []
    try { issues = JSON.parse(resultado.error.message) } catch { issues = [] }
    const mensajes = issues.length > 0
      ? issues.map(e => e.message).join('. ')
      : 'Datos inválidos en el body del request'
    const err = new Error(mensajes)
    err.statusCode = 400
    throw err
  }

  const { estudiante_id, tipo_protocolo_id, fecha_apertura, incidente_id, observaciones } = resultado.data

  // 2. Si viene incidente_id, validar que el estudiante participó en ese incidente
  if (incidente_id) {
    const { data: vinculo, error } = await supabase
      .from('incidente_estudiantes')
      .select('estudiante_id')
      .eq('incidente_id', incidente_id)
      .eq('estudiante_id', estudiante_id)
      .single()

    if (error || !vinculo) {
      const err = new Error(
        'El estudiante indicado no está vinculado al incidente proporcionado. Verifique los datos.'
      )
      err.statusCode = 400
      throw err
    }
  }

  // 3. Insertar protocolo — estado inicial siempre "En Investigación"
  const { data, error } = await supabase
    .from('protocolos_rice')
    .insert({
      tenant_id:         tenantId,
      estudiante_id,
      tipo_protocolo_id,
      fecha_apertura,
      incidente_id:      incidente_id || null,
      observaciones:     observaciones || null,
      registrado_por:    usuarioId,
      estado:            'En Investigación',
    })
    .select('id')
    .single()

  if (error) throw error

  // 3.1 Inicializar automáticamente los pasos normativos (Checklist RICE)
  const { data: reglas, error: reglasError } = await supabase
    .from('reglas_protocolo')
    .select('id, orden, accion, plazo_dias')
    .eq('tenant_id', tenantId)
    .eq('tipo_protocolo_id', tipo_protocolo_id)
    .eq('activo', true)
    .order('orden', { ascending: true })

  if (reglasError) {
    logger.error('Error al consultar reglas para inicializar pasos de protocolo', {
      protocoloId: data.id,
      error: reglasError.message,
    })
    // Reversión compensatoria para evitar protocolo huérfano sin checklist
    await supabase.from('protocolos_rice').delete().eq('id', data.id).eq('tenant_id', tenantId)
    const err = new Error(`Error al consultar las reglas normativas del protocolo: ${reglasError.message}`)
    err.statusCode = 500
    throw err
  }

  if (reglas && reglas.length > 0) {
    const pasosParaInsertar = reglas.map(r => ({
      tenant_id:        tenantId,
      protocolo_id:     data.id,
      regla_id:         r.id,
      orden:            r.orden,
      accion:           r.accion,
      plazo_dias:       r.plazo_dias,
      completado:       false,
      fecha_completado: null,
      responsable_id:   null,
      observacion:      null,
    }))

    const { error: errorPasos } = await supabase
      .from('protocolo_pasos')
      .insert(pasosParaInsertar)

    if (errorPasos) {
      logger.error('Error al insertar pasos de protocolo en lote', {
        protocoloId: data.id,
        error: errorPasos.message,
      })
      // Reversión compensatoria
      await supabase.from('protocolos_rice').delete().eq('id', data.id).eq('tenant_id', tenantId)
      const err = new Error(`Error al inicializar el checklist normativo del protocolo: ${errorPasos.message}`)
      err.statusCode = 500
      throw err
    }
  } else {
    logger.warn('No se encontraron reglas activas para el tipo de protocolo; no se inicializaron pasos', {
      tenantId,
      tipo_protocolo_id,
      protocoloId: data.id,
    })
  }

  // 4. Send email to apoderado about protocol opening
  const { data: estudiante } = await supabase
    .from('estudiantes')
    .select(`
      id, nombre, apellido,
      apoderados ( email, nombre )
    `)
    .eq('id', estudiante_id)
    .single()

  const { data: tipoProtocolo } = await supabase
    .from('tipos_protocolo')
    .select('nombre')
    .eq('id', tipo_protocolo_id)
    .single()

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('nombre, apellido')
    .eq('id', usuarioId)
    .single()

  if (estudiante?.apoderados?.email) {
    emailService.enviarEmailProtocoloAbierto({
      apoderadoEmail: estudiante.apoderados.email,
      estudianteNombre: `${estudiante.nombre} ${estudiante.apellido}`,
      protocoloTipo: tipoProtocolo?.nombre || 'Protocolo RICE',
      responsableNombre: usuario ? `${usuario.nombre} ${usuario.apellido}` : 'Equipo SIGA',
      fecha: new Date(fecha_apertura).toLocaleDateString('es-CL')
    }).catch(err => {
      logger.error('Error sending protocolo email', {
        protocoloId: data.id,
        error: err.message
      })
    })

    logger.info('Email protocolo abierto queued', {
      protocoloId: data.id,
      apoderadoEmail: estudiante.apoderados.email
    })
  }

  // 5. Create notifications for admins and coordinadores
  const { data: usuarios } = await supabase
    .from('usuarios')
    .select('id')
    .eq('tenant_id', tenantId)
    .in('rol', ['Administrador', 'Coordinador'])

  if (usuarios) {
    for (const usr of usuarios) {
      notificacionesService.crearNotificacion({
        userId: usr.id,
        tenantId: tenantId,
        tipo: 'protocolo',
        titulo: `Nuevo protocolo ${tipoProtocolo?.nombre || 'RICE'}`,
        mensaje: `Se ha abierto un protocolo para ${estudiante?.nombre} ${estudiante?.apellido}`,
        url: `/protocolos/${data.id}`
      }).catch(err => {
        logger.error('Error creating notification', {
          error: err.message,
          userId: usr.id,
          protocoloId: data.id
        })
      })
    }
  }

  return obtenerProtocolo(data.id, tenantId)
}

/**
 * Avanza el estado de un protocolo con observación obligatoria.
 * Al cerrar establece fecha_cierre automáticamente.
 */
const cambiarEstado = async (id, tenantId, nuevoEstado, observaciones) => {
  if (!observaciones || observaciones.trim().length === 0) {
    const err = new Error('Las observaciones son obligatorias al cambiar de estado')
    err.statusCode = 400
    throw err
  }

  const protocolo = await obtenerProtocolo(id, tenantId)
  const estadoActual = protocolo.estado
  const transicionPermitida = TRANSICIONES[estadoActual]

  if (!transicionPermitida || transicionPermitida !== nuevoEstado) {
    const err = new Error(
      `Transición de estado no permitida. El estado "${estadoActual}" solo puede avanzar a "${transicionPermitida || 'ninguno (ya está cerrado)'}"`
    )
    err.statusCode = 400
    throw err
  }

  // Regla de bloqueo estricto (Checklist RICE):
  // Para avanzar a "Derivado" o "Cerrado", todos los pasos normativos deben estar completados
  if (['Derivado', 'Cerrado'].includes(nuevoEstado)) {
    const { data: pasosPendientes, error: errorPasos } = await supabase
      .from('protocolo_pasos')
      .select('id, orden, accion, plazo_dias')
      .eq('protocolo_id', id)
      .eq('tenant_id', tenantId)
      .eq('completado', false)
      .order('orden', { ascending: true })

    if (errorPasos) throw errorPasos

    if (pasosPendientes && pasosPendientes.length > 0) {
      const err = new Error('No se puede avanzar el estado: existen pasos normativos pendientes')
      err.statusCode = 400
      err.pasos_pendientes = pasosPendientes
      throw err
    }
  }

  const update = {
    estado:        nuevoEstado,
    observaciones,
    fecha_ultimo_avance: new Date().toISOString(),
  }

  // Al cerrar, registrar fecha_cierre automáticamente
  if (nuevoEstado === 'Cerrado') {
    update.fecha_cierre = new Date().toISOString().split('T')[0]
  }

  const { data, error } = await supabase
    .from('protocolos_rice')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select('id, estado, fecha_cierre, observaciones')
    .single()

  if (error) throw error
  return data
}

/**
 * Lista los 10 tipos de protocolo RICE (catálogo).
 */
const listarTiposProtocolo = async () => {
  const { data, error } = await supabase
    .from('tipos_protocolo')
    .select('id, nombre')
    .order('id')

  if (error) throw error
  return data
}

/**
 * Llama a la función RPC calcular_acciones_pendientes para obtener el estado del semáforo.
 */
const calcularAccionesPendientes = async (tenantId) => {
  const { data, error } = await supabase
    .rpc('calcular_acciones_pendientes', { p_tenant_id: tenantId })

  if (error) {
    const err = new Error(`Error al calcular acciones pendientes: ${error.message}`)
    err.statusCode = 500
    throw err
  }

  return data
}

/**
 * Lista los pasos de un protocolo específico ordenados por orden ascendente.
 * Valida que el protocolo exista y pertenezca al tenantId (Aislamiento Multi-tenant).
 */
const listarPasosProtocolo = async (protocoloId, tenantId) => {
  // 1. Validar que el protocolo exista y pertenezca al tenant
  const { data: prot, error: protError } = await supabase
    .from('protocolos_rice')
    .select('id')
    .eq('id', protocoloId)
    .eq('tenant_id', tenantId)
    .single()

  if (protError || !prot) {
    const err = new Error('Protocolo no encontrado o no pertenece a este establecimiento')
    err.statusCode = 404
    throw err
  }

  // 2. Obtener pasos normativos
  const { data: pasos, error: pasosError } = await supabase
    .from('protocolo_pasos')
    .select(`
      id, orden, accion, plazo_dias, completado, fecha_completado, observacion, created_at, updated_at,
      responsable:usuarios ( id, nombre, apellido, rol )
    `)
    .eq('protocolo_id', protocoloId)
    .eq('tenant_id', tenantId)
    .order('orden', { ascending: true })

  if (pasosError) {
    const err = new Error(`Error al listar los pasos del protocolo: ${pasosError.message}`)
    err.statusCode = 500
    throw err
  }

  return pasos || []
}

/**
 * Actualiza el estado de un paso normativo (certificación / observación).
 * Exige observación obligatoria (mínimo 5 caracteres) al marcar como completado.
 * Registra fecha_completado y responsable_id en servidor.
 * Registra auditoría del cambio en la tabla auditoria.
 */
const actualizarPasoProtocolo = async (protocoloId, pasoId, tenantId, usuarioId, body, ip) => {
  const { completado, observacion } = body

  if (typeof completado !== 'boolean') {
    const err = new Error('El campo "completado" es requerido y debe ser un valor booleano')
    err.statusCode = 400
    throw err
  }

  const observacionLimpia = observacion ? observacion.trim() : ''

  if (completado && observacionLimpia.length < 5) {
    const err = new Error('La observación es obligatoria al completar un paso y debe tener al menos 5 caracteres')
    err.statusCode = 400
    throw err
  }

  // 1. Validar que el protocolo exista y pertenezca al tenant
  const { data: prot, error: protError } = await supabase
    .from('protocolos_rice')
    .select('id, estado')
    .eq('id', protocoloId)
    .eq('tenant_id', tenantId)
    .single()

  if (protError || !prot) {
    const err = new Error('Protocolo no encontrado o no pertenece a este establecimiento')
    err.statusCode = 404
    throw err
  }

  // Si el protocolo ya está cerrado, no se pueden modificar los pasos
  if (prot.estado === 'Cerrado') {
    const err = new Error('No se pueden modificar los pasos de un protocolo cerrado')
    err.statusCode = 400
    throw err
  }

  // 2. Obtener estado anterior del paso
  const { data: pasoActual, error: pasoError } = await supabase
    .from('protocolo_pasos')
    .select('*')
    .eq('id', pasoId)
    .eq('protocolo_id', protocoloId)
    .eq('tenant_id', tenantId)
    .single()

  if (pasoError || !pasoActual) {
    const err = new Error('Paso normativo no encontrado o no pertenece a este protocolo')
    err.statusCode = 404
    throw err
  }

  // 3. Preparar datos de actualización
  const updateData = {
    completado,
    fecha_completado: completado ? new Date().toISOString() : null,
    responsable_id: completado ? usuarioId : null,
    observacion: observacionLimpia || null,
  }

  const { data: pasoActualizado, error: updateError } = await supabase
    .from('protocolo_pasos')
    .update(updateData)
    .eq('id', pasoId)
    .eq('tenant_id', tenantId)
    .select(`
      id, orden, accion, plazo_dias, completado, fecha_completado, observacion, created_at, updated_at,
      responsable:usuarios ( id, nombre, apellido, rol )
    `)
    .single()

  if (updateError) throw updateError

  // 4. Registrar en auditoría
  await registrarAuditoria({
    tenantId,
    userId: usuarioId,
    accion: 'UPDATE',
    tabla: 'protocolo_pasos',
    registroId: pasoId,
    datosBefore: pasoActual,
    datosAfter: pasoActualizado,
    ip: ip || null,
  }).catch(err => {
    logger.error('Error al registrar auditoría en actualización de paso', {
      pasoId,
      error: err.message,
    })
  })

  return pasoActualizado
}

module.exports = {
  listarProtocolos,
  obtenerProtocolo,
  crearProtocolo,
  cambiarEstado,
  listarTiposProtocolo,
  calcularAccionesPendientes,
  listarPasosProtocolo,
  actualizarPasoProtocolo,
}
