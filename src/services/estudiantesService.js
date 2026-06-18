const { supabase } = require('../utils/db')
const { validarRut, formatearRut } = require('../utils/rutValidator')

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Busca un curso por nombre en el tenant. Si no existe, lo crea.
 */
const buscarOCrearCurso = async (nombreCurso, tenantId) => {
  if (!nombreCurso) return null

  // Buscar primero
  const { data: existente } = await supabase
    .from('cursos')
    .select('id')
    .eq('tenant_id', tenantId)
    .ilike('nombre', nombreCurso.trim())
    .single()

  if (existente) return existente.id

  // Crear si no existe
  const { data: nuevo, error } = await supabase
    .from('cursos')
    .insert({
      tenant_id:      tenantId,
      nombre:         nombreCurso.trim(),
      nivel:          'Sin clasificar',
      anio_academico: new Date().getFullYear(),
    })
    .select('id')
    .single()

  if (error) return null
  return nuevo.id
}

// =============================================================================
// CRUD
// =============================================================================

const sanitizeSearch = (text) => {
  return text
    .replace(/[aáAÁäÄ]/g, '_')
    .replace(/[eéEÉëË]/g, '_')
    .replace(/[iíIÍïÏ]/g, '_')
    .replace(/[oóOÓöÖ]/g, '_')
    .replace(/[uúUÚüÜ]/g, '_')
}

const listarEstudiantes = async (tenantId, filtros = {}) => {
  const { nombre, rut, curso_id, activo, search } = filtros

  let query = supabase
    .from('estudiantes')
    .select('id, tenant_id, rut, nombre, apellido, curso_id, fecha_nacimiento, activo')
    .eq('tenant_id', tenantId)
    .order('apellido', { ascending: true })

  if (search && search.trim()) {
    const tokens = search.trim().split(/\s+/)
    tokens.forEach(token => {
      const looseSearch = sanitizeSearch(token)
      query = query.or(`nombre.ilike.%${looseSearch}%,apellido.ilike.%${looseSearch}%,rut.ilike.%${looseSearch}%`)
    })
  }

  if (nombre)    query = query.ilike('nombre', `%${nombre}%`)
  if (rut)       query = query.ilike('rut', `%${rut}%`)
  if (curso_id)  query = query.eq('curso_id', curso_id)
  if (activo !== undefined) query = query.eq('activo', activo === 'true')

  const { data, error } = await query
  if (error) throw error
  return data
}

/**
 * Retorna el perfil completo de un estudiante:
 * datos personales + apoderados + historial de incidentes.
 */
const obtenerPerfil = async (id, tenantId) => {
  // Datos del estudiante con su curso
  const { data: estudiante, error } = await supabase
    .from('estudiantes')
    .select(`
      id, tenant_id, rut, nombre, apellido,
      fecha_nacimiento, activo,
      cursos ( id, nombre, nivel, anio_academico )
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (error || !estudiante) {
    const err = new Error('Estudiante no encontrado')
    err.statusCode = 404
    throw err
  }

  // Apoderados
  const { data: apoderados } = await supabase
    .from('apoderados')
    .select('id, nombre, apellido, rut, email, telefono, es_titular')
    .eq('estudiante_id', id)
    .eq('tenant_id', tenantId)

  // Historial de incidentes via tabla intermedia
  const { data: incidentesRaw } = await supabase
    .from('incidente_estudiantes')
    .select(`
      es_victima,
      observacion,
      incidentes (
        id, fecha, gravedad, relato, medidas, estado, fecha_creacion,
        tipos_abordaje ( nombre )
      )
    `)
    .eq('estudiante_id', id)
    .order('incidente_id', { ascending: false })

  // Aplanar estructura de incidentes
  const incidentes = (incidentesRaw || []).map(item => ({
    ...item.incidentes,
    tipo_abordaje: item.incidentes?.tipos_abordaje?.nombre || null,
    es_victima:    item.es_victima,
    observacion:   item.observacion,
  }))

  return {
    ...estudiante,
    apoderados: apoderados || [],
    incidentes,
  }
}

/**
 * Crea un estudiante individual.
 */
const crearEstudiante = async (tenantId, datos) => {
  const { rut, nombre, apellido, curso_id, fecha_nacimiento } = datos

  if (!validarRut(rut)) {
    const err = new Error('RUT inválido')
    err.statusCode = 400
    throw err
  }

  const rutFormateado = formatearRut(rut)

  const { data, error } = await supabase
    .from('estudiantes')
    .insert({
      tenant_id:        tenantId,
      rut:              rutFormateado,
      nombre:           nombre.trim(),
      apellido:         apellido.trim(),
      curso_id:         curso_id || null,
      fecha_nacimiento: fecha_nacimiento || null,
      activo:           true,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      const err = new Error('El RUT ya está registrado en este establecimiento')
      err.statusCode = 409
      throw err
    }
    throw error
  }

  return data
}

/**
 * Actualiza datos de un estudiante.
 */
const actualizarEstudiante = async (id, tenantId, datos) => {
  const { nombre, apellido, curso_id, fecha_nacimiento } = datos

  const update = {}
  if (nombre)           update.nombre           = nombre.trim()
  if (apellido)         update.apellido         = apellido.trim()
  if (curso_id)         update.curso_id         = curso_id
  if (fecha_nacimiento) update.fecha_nacimiento = fecha_nacimiento

  const { data, error } = await supabase
    .from('estudiantes')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error || !data) {
    const err = new Error('Estudiante no encontrado')
    err.statusCode = 404
    throw err
  }

  return data
}

// =============================================================================
// IMPORTACIÓN MASIVA
// =============================================================================

/**
 * Procesa un array de filas CSV/Excel e importa los estudiantes.
 * Retorna un resumen { importados, actualizados, errores }.
 */
const importarEstudiantes = async (filas, tenantId) => {
  let importados  = 0
  let actualizados = 0
  const errores   = []

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i]
    const numFila = i + 2 // +2 porque la fila 1 es el header

    const rut      = fila.rut      || fila.RUT      || fila.Rut      || ''
    const nombre   = fila.nombre   || fila.Nombre   || fila.NOMBRE   || ''
    const apellido = fila.apellido || fila.Apellido || fila.APELLIDO || ''
    const curso    = fila.curso    || fila.Curso    || fila.CURSO    || ''

    // Validar campos obligatorios
    if (!rut) {
      errores.push({ fila: numFila, rut: '', motivo: 'RUT requerido' })
      continue
    }

    if (!nombre || !apellido) {
      errores.push({ fila: numFila, rut, motivo: 'Nombre y apellido son requeridos' })
      continue
    }

    // Validar RUT
    if (!validarRut(rut)) {
      errores.push({ fila: numFila, rut, motivo: 'RUT inválido' })
      continue
    }

    const rutFormateado = formatearRut(rut)

    try {
      // Buscar o crear curso
      const cursoId = curso ? await buscarOCrearCurso(curso, tenantId) : null

      // Verificar si el RUT ya existe (upsert)
      const { data: existente } = await supabase
        .from('estudiantes')
        .select('id')
        .eq('rut', rutFormateado)
        .eq('tenant_id', tenantId)
        .single()

      if (existente) {
        // Actualizar
        await supabase
          .from('estudiantes')
          .update({
            nombre:   nombre.trim(),
            apellido: apellido.trim(),
            curso_id: cursoId,
          })
          .eq('id', existente.id)
          .eq('tenant_id', tenantId)

        actualizados++
      } else {
        // Insertar
        await supabase
          .from('estudiantes')
          .insert({
            tenant_id: tenantId,
            rut:       rutFormateado,
            nombre:    nombre.trim(),
            apellido:  apellido.trim(),
            curso_id:  cursoId,
            activo:    true,
          })

        importados++
      }
    } catch (err) {
      errores.push({ fila: numFila, rut, motivo: err.message || 'Error al procesar fila' })
    }
  }

  return { importados, actualizados, errores }
}

module.exports = {
  listarEstudiantes,
  obtenerPerfil,
  crearEstudiante,
  actualizarEstudiante,
  importarEstudiantes,
}
