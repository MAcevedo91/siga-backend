const { z } = require('zod')
const { supabase } = require('../utils/db')
const { validarRut, formatearRut } = require('../utils/rutValidator')
const { invalidateEstudiantes } = require('../utils/cacheInvalidator')

// =============================================================================
// ESQUEMAS DE VALIDACIÓN ZOD
// =============================================================================

const apoderadoSchema = z.object({
  nombre: z.string().min(1, 'El nombre del apoderado es requerido').max(100).optional(),
  apellido: z.string().min(1, 'El apellido del apoderado es requerido').max(100).optional(),
  rut: z.string().max(12).optional().nullable(),
  email: z.string().email('Email inválido').optional().nullable(),
  telefono: z.string().max(20).optional().nullable(),
  direccion: z.string().max(255, 'La dirección no puede exceder 255 caracteres').optional().nullable(),
}).optional().nullable()

const estudianteSchema = z.object({
  rut: z.string().min(1, 'El RUT es requerido'),
  nombre: z.string().min(1, 'El nombre es requerido').max(100, 'El nombre no puede exceder 100 caracteres'),
  apellido: z.string().min(1, 'El apellido es requerido').max(100, 'El apellido no puede exceder 100 caracteres'),
  curso_id: z.union([z.string(), z.number()]).optional().nullable(),
  fecha_nacimiento: z.string().optional().nullable(),
  es_pie: z.preprocess(
    val => (typeof val === 'string' ? ['true', '1', 'si', 'sí', 's', 'yes', 'y'].includes(val.trim().toLowerCase()) : val),
    z.boolean().optional().default(false)
  ),
  direccion: z.preprocess(
    val => (typeof val === 'string' ? val.trim() || null : val),
    z.string().max(255, 'La dirección no puede exceder 255 caracteres').optional().nullable()
  ),
  apoderado: apoderadoSchema,
})

const actualizarEstudianteSchema = z.object({
  nombre: z.string().min(1, 'El nombre no puede estar vacío').max(100).optional(),
  apellido: z.string().min(1, 'El apellido no puede estar vacío').max(100).optional(),
  curso_id: z.union([z.string(), z.number()]).optional().nullable(),
  fecha_nacimiento: z.string().optional().nullable(),
  activo: z.boolean().optional(),
  es_pie: z.preprocess(
    val => (typeof val === 'string' ? ['true', '1', 'si', 'sí', 's', 'yes', 'y'].includes(val.trim().toLowerCase()) : val),
    z.boolean().optional()
  ),
  direccion: z.preprocess(
    val => (typeof val === 'string' ? val.trim() || null : val),
    z.string().max(255, 'La dirección no puede exceder 255 caracteres').optional().nullable()
  ),
  direccion_apoderado: z.preprocess(
    val => (typeof val === 'string' ? val.trim() || null : val),
    z.string().max(255, 'La dirección del apoderado no puede exceder 255 caracteres').optional().nullable()
  ),
  apoderado: apoderadoSchema,
})

const formatearErrorZod = (error) => {
  const issues = error.issues || error.errors || []
  if (issues.length > 0) {
    return issues.map(i => i.message).join('. ')
  }
  return 'Datos inválidos en el body del request'
}

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
    .select('id, tenant_id, rut, nombre, apellido, curso_id, fecha_nacimiento, es_pie, direccion, activo, cursos ( id, nombre )')
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
  return (data || []).map((e) => {
    if (e.cursos !== undefined) {
      return { ...e, curso: e.cursos }
    }
    return e
  })
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
      fecha_nacimiento, activo, es_pie, direccion,
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
    .select('id, nombre, apellido, rut, email, telefono, es_titular, direccion')
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
  // 1. Validar esquema con Zod
  const resultado = estudianteSchema.safeParse(datos)
  if (!resultado.success) {
    const err = new Error(formatearErrorZod(resultado.error))
    err.statusCode = 400
    throw err
  }

  const { rut, nombre, apellido, curso_id, fecha_nacimiento, es_pie, direccion, apoderado } = resultado.data

  // 2. Validar formato RUT
  if (!validarRut(rut)) {
    const err = new Error('RUT inválido')
    err.statusCode = 400
    throw err
  }

  const rutFormateado = formatearRut(rut)

  // 3. Insertar estudiante
  const { data, error } = await supabase
    .from('estudiantes')
    .insert({
      tenant_id:        tenantId,
      rut:              rutFormateado,
      nombre:           nombre.trim(),
      apellido:         apellido.trim(),
      curso_id:         curso_id || null,
      fecha_nacimiento: fecha_nacimiento || null,
      es_pie:           es_pie ?? false,
      direccion:        direccion || null,
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

  // 4. Si se proporcionaron datos de apoderado, insertar en apoderados
  if (apoderado && (apoderado.nombre || apoderado.direccion || apoderado.email || apoderado.telefono)) {
    try {
      await supabase
        .from('apoderados')
        .insert({
          tenant_id:     tenantId,
          estudiante_id: data.id,
          nombre:        apoderado.nombre ? apoderado.nombre.trim() : 'Apoderado Titular',
          apellido:      apoderado.apellido ? apoderado.apellido.trim() : data.apellido,
          rut:           apoderado.rut ? formatearRut(apoderado.rut) : null,
          email:         apoderado.email || null,
          telefono:      apoderado.telefono || null,
          direccion:     apoderado.direccion || null,
          es_titular:    true,
        })
    } catch (errApod) {
      console.error('[CREAR_ESTUDIANTE] Error al insertar apoderado:', errApod.message)
    }
  }

  // Invalidar cache después de crear
  await invalidateEstudiantes(tenantId)

  return data
}

/**
 * Actualiza datos de un estudiante.
 */
const actualizarEstudiante = async (id, tenantId, datos) => {
  // 1. Validar esquema con Zod
  const resultado = actualizarEstudianteSchema.safeParse(datos)
  if (!resultado.success) {
    const err = new Error(formatearErrorZod(resultado.error))
    err.statusCode = 400
    throw err
  }

  const {
    nombre,
    apellido,
    curso_id,
    fecha_nacimiento,
    activo,
    es_pie,
    direccion,
    direccion_apoderado,
    apoderado
  } = resultado.data

  const update = {}
  if (nombre !== undefined)           update.nombre           = nombre.trim()
  if (apellido !== undefined)         update.apellido         = apellido.trim()
  if (curso_id !== undefined)         update.curso_id         = curso_id
  if (fecha_nacimiento !== undefined) update.fecha_nacimiento = fecha_nacimiento
  if (activo !== undefined)           update.activo           = activo
  if (es_pie !== undefined)           update.es_pie           = es_pie
  if (direccion !== undefined)        update.direccion        = direccion

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

  // 2. Si se proporciona dirección o datos para el apoderado, actualizarlo
  const dirApoderado = direccion_apoderado || apoderado?.direccion
  if (dirApoderado !== undefined || (apoderado && Object.keys(apoderado).length > 0)) {
    try {
      const { data: apoderados } = await supabase
        .from('apoderados')
        .select('id')
        .eq('estudiante_id', id)
        .eq('tenant_id', tenantId)
        .limit(1)

      if (apoderados && apoderados.length > 0) {
        const updateApod = {}
        if (dirApoderado !== undefined) updateApod.direccion = dirApoderado
        if (apoderado?.telefono !== undefined) updateApod.telefono = apoderado.telefono
        if (apoderado?.email !== undefined) updateApod.email = apoderado.email
        if (apoderado?.nombre !== undefined) updateApod.nombre = apoderado.nombre.trim()
        if (apoderado?.apellido !== undefined) updateApod.apellido = apoderado.apellido.trim()
        if (Object.keys(updateApod).length > 0) {
          await supabase.from('apoderados').update(updateApod).eq('id', apoderados[0].id)
        }
      } else if (dirApoderado || apoderado?.nombre) {
        await supabase.from('apoderados').insert({
          tenant_id:     tenantId,
          estudiante_id: id,
          nombre:        apoderado?.nombre ? apoderado.nombre.trim() : 'Apoderado Titular',
          apellido:      apoderado?.apellido ? apoderado.apellido.trim() : data.apellido,
          rut:           apoderado?.rut ? formatearRut(apoderado.rut) : null,
          email:         apoderado?.email || null,
          telefono:      apoderado?.telefono || null,
          direccion:     dirApoderado || null,
          es_titular:    true,
        })
      }
    } catch (errApod) {
      console.error('[ACTUALIZAR_ESTUDIANTE] Error al actualizar apoderado:', errApod.message)
    }
  }

  // Invalidar cache después de actualizar
  await invalidateEstudiantes(tenantId)

  return data
}

// =============================================================================
// IMPORTACIÓN MASIVA
// =============================================================================

// Definición de variantes de cabeceras toleradas en CSV / Excel
const ALIASES = {
  rut: ['rut', 'RUT', 'Rut'],
  nombre: ['nombre', 'Nombre', 'NOMBRE', 'nombres', 'Nombres'],
  apellido: ['apellido', 'Apellido', 'APELLIDO', 'apellidos', 'Apellidos'],
  curso: ['curso', 'Curso', 'CURSO'],
  pie: ['pie', 'PIE', 'Pie', 'es_pie', 'ES_PIE', 'Es_Pie', 'esPie', 'EsPie'],
  direccion: [
    'direccion', 'Direccion', 'DIRECCION',
    'domicilio', 'Domicilio', 'DOMICILIO',
    'direccion_estudiante', 'domicilio_estudiante',
    'direccion_alumno', 'domicilio_alumno'
  ],
  direccion_apoderado: [
    'direccion_apoderado', 'Direccion_Apoderado', 'DIRECCION_APODERADO',
    'domicilio_apoderado', 'Domicilio_Apoderado', 'DOMICILIO_APODERADO',
    'apoderado_direccion', 'apoderado_domicilio',
    'direccion_tutor', 'domicilio_tutor'
  ],
  apoderado_nombre: [
    'apoderado_nombre', 'nombre_apoderado',
    'Apoderado_Nombre', 'Nombre_Apoderado'
  ],
  apoderado_apellido: [
    'apoderado_apellido', 'apellido_apoderado',
    'Apoderado_Apellido', 'Apellido_Apoderado'
  ],
  apoderado_rut: [
    'apoderado_rut', 'rut_apoderado',
    'Apoderado_Rut', 'Rut_Apoderado'
  ],
  apoderado_email: [
    'apoderado_email', 'email_apoderado',
    'Apoderado_Email', 'Email_Apoderado'
  ],
  apoderado_telefono: [
    'apoderado_telefono', 'telefono_apoderado',
    'Apoderado_Telefono', 'Telefono_Apoderado'
  ],
}

const obtenerValorFila = (fila, listaAliases) => {
  for (const alias of listaAliases) {
    if (fila[alias] !== undefined && fila[alias] !== null) {
      const val = String(fila[alias]).trim()
      if (val !== '') return val
    }
  }
  return ''
}

const parsearBooleanoPie = (valor) => {
  if (!valor) return false
  const limpio = String(valor).trim().toLowerCase()
  return ['si', 'sí', 'true', '1', 's', 'yes', 'y'].includes(limpio)
}

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

    const rut          = obtenerValorFila(fila, ALIASES.rut)
    const nombre       = obtenerValorFila(fila, ALIASES.nombre)
    const apellido     = obtenerValorFila(fila, ALIASES.apellido)
    const curso        = obtenerValorFila(fila, ALIASES.curso)
    const pieRaw       = obtenerValorFila(fila, ALIASES.pie)
    const dirEstRaw    = obtenerValorFila(fila, ALIASES.direccion)
    const dirApodRaw   = obtenerValorFila(fila, ALIASES.direccion_apoderado)
    const apodNombre   = obtenerValorFila(fila, ALIASES.apoderado_nombre)
    const apodApellido = obtenerValorFila(fila, ALIASES.apoderado_apellido)
    const apodRut      = obtenerValorFila(fila, ALIASES.apoderado_rut)
    const apodEmail    = obtenerValorFila(fila, ALIASES.apoderado_email)
    const apodTelefono = obtenerValorFila(fila, ALIASES.apoderado_telefono)

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
    const esPie = parsearBooleanoPie(pieRaw)
    const direccionEstudiante = dirEstRaw || null

    try {
      // Buscar o crear curso
      const cursoId = curso ? await buscarOCrearCurso(curso, tenantId) : null
      let estudianteId = null

      // Verificar si el RUT ya existe (upsert)
      const { data: existente } = await supabase
        .from('estudiantes')
        .select('id')
        .eq('rut', rutFormateado)
        .eq('tenant_id', tenantId)
        .single()

      if (existente) {
        estudianteId = existente.id
        // Actualizar
        const updatePayload = {
          nombre:   nombre.trim(),
          apellido: apellido.trim(),
          curso_id: cursoId,
        }
        if (pieRaw !== '') {
          updatePayload.es_pie = esPie
        }
        if (dirEstRaw !== '') {
          updatePayload.direccion = direccionEstudiante
        }

        await supabase
          .from('estudiantes')
          .update(updatePayload)
          .eq('id', existente.id)
          .eq('tenant_id', tenantId)

        actualizados++
      } else {
        // Insertar
        const { data: nuevo, error: insertError } = await supabase
          .from('estudiantes')
          .insert({
            tenant_id:        tenantId,
            rut:              rutFormateado,
            nombre:           nombre.trim(),
            apellido:         apellido.trim(),
            curso_id:         cursoId,
            es_pie:           esPie,
            direccion:        direccionEstudiante,
            activo:           true,
          })
          .select('id')
          .single()

        if (insertError) throw insertError
        estudianteId = nuevo?.id
        importados++
      }

      // Procesar datos de apoderado si vienen en la fila
      if (estudianteId && (dirApodRaw || apodNombre || apodEmail || apodTelefono)) {
        try {
          const { data: apoderadosExistentes } = await supabase
            .from('apoderados')
            .select('id')
            .eq('estudiante_id', estudianteId)
            .eq('tenant_id', tenantId)
            .limit(1)

          if (apoderadosExistentes && apoderadosExistentes.length > 0) {
            const apodUpdate = {}
            if (dirApodRaw)   apodUpdate.direccion = dirApodRaw
            if (apodNombre)   apodUpdate.nombre    = apodNombre
            if (apodApellido) apodUpdate.apellido  = apodApellido
            if (apodRut && validarRut(apodRut)) apodUpdate.rut = formatearRut(apodRut)
            if (apodEmail)    apodUpdate.email     = apodEmail
            if (apodTelefono) apodUpdate.telefono  = apodTelefono

            if (Object.keys(apodUpdate).length > 0) {
              await supabase
                .from('apoderados')
                .update(apodUpdate)
                .eq('id', apoderadosExistentes[0].id)
            }
          } else if (dirApodRaw || apodNombre) {
            await supabase
              .from('apoderados')
              .insert({
                tenant_id:     tenantId,
                estudiante_id: estudianteId,
                nombre:        apodNombre || 'Apoderado Titular',
                apellido:      apodApellido || apellido.trim(),
                rut:           apodRut && validarRut(apodRut) ? formatearRut(apodRut) : null,
                email:         apodEmail || null,
                telefono:      apodTelefono || null,
                direccion:     dirApodRaw || null,
                es_titular:    true,
              })
          }
        } catch (apodErr) {
          console.error(`[IMPORTAR_ESTUDIANTES] Error al procesar apoderado en fila ${numFila}:`, apodErr.message)
        }
      }
    } catch (err) {
      errores.push({ fila: numFila, rut, motivo: err.message || 'Error al procesar fila' })
    }
  }

  // Invalidar cache después de importación masiva
  if (importados > 0 || actualizados > 0) {
    await invalidateEstudiantes(tenantId)
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
