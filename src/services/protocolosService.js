const { z }        = require('zod')
const { supabase } = require('../utils/db')

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

  return mapProtocolo(data)
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

  const update = {
    estado:        nuevoEstado,
    observaciones,
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

module.exports = {
  listarProtocolos,
  obtenerProtocolo,
  crearProtocolo,
  cambiarEstado,
  listarTiposProtocolo,
}
