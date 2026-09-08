const { supabase } = require('../utils/db')
const logger = require('../utils/logger')

// Jerarquía oficial de ordenamiento para cursos del sistema escolar chileno
const ORDEN_NIVELES_CHILE = [
  'Pre-Kínder', 'Prekinder', 'Pre-Kinder', 'Pre Kínder',
  'Kínder', 'Kinder',
  '1° Básico', '2° Básico', '3° Básico', '4° Básico',
  '5° Básico', '6° Básico', '7° Básico', '8° Básico',
  '1° Medio', '2° Medio', '3° Medio', '4° Medio',
]

/**
 * Ordena niveles según la secuencia escolar chilena.
 */
const ordenarNiveles = (niveles) => {
  return [...niveles].sort((a, b) => {
    const idxA = ORDEN_NIVELES_CHILE.findIndex(n => n.toLowerCase() === a.trim().toLowerCase())
    const idxB = ORDEN_NIVELES_CHILE.findIndex(n => n.toLowerCase() === b.trim().toLowerCase())

    if (idxA !== -1 && idxB !== -1) return idxA - idxB
    if (idxA !== -1) return -1
    if (idxB !== -1) return 1
    return a.localeCompare(b, 'es', { numeric: true })
  })
}

/**
 * Obtiene el período académico activo para el tenant.
 */
const obtenerPeriodoActivo = async (tenantId) => {
  const { data, error } = await supabase
    .from('periodos_academicos')
    .select('id, anio, fecha_inicio, fecha_fin, activo')
    .eq('tenant_id', tenantId)
    .eq('activo', true)
    .order('anio', { ascending: false })
    .limit(1)

  if (error) {
    logger.warn(`[CURSOS_SERVICE] Error consultando periodo activo: ${error.message}`)
    return null
  }

  return (data && data.length > 0) ? data[0] : null
}

/**
 * Lista todos los cursos del tenant con soporte de filtros (compatibilidad hacia atrás).
 */
const listarCursos = async (tenantId, filtros = {}) => {
  let query = supabase
    .from('cursos')
    .select('id, nombre, nivel, letra, periodo_id, anio_academico')
    .eq('tenant_id', tenantId)
    .order('nombre', { ascending: true })

  if (filtros.periodo_id) {
    query = query.eq('periodo_id', filtros.periodo_id)
  }

  const { data, error } = await query
  if (error) {
    logger.error('Error al listar cursos:', error)
    throw error
  }

  return data || []
}

/**
 * Obtiene la lista ordenada de niveles disponibles en el período activo sin duplicados.
 */
const obtenerNiveles = async (tenantId) => {
  const periodoActivo = await obtenerPeriodoActivo(tenantId)

  let query = supabase
    .from('cursos')
    .select('nivel')
    .eq('tenant_id', tenantId)

  if (periodoActivo) {
    query = query.or(`periodo_id.eq.${periodoActivo.id},periodo_id.is.null`)
  }

  const { data, error } = await query
  if (error) {
    logger.error('Error al obtener niveles de cursos:', error)
    throw error
  }

  const nivelesSet = new Set()
  ;(data || []).forEach(c => {
    if (c.nivel && c.nivel.trim() && c.nivel.trim().toLowerCase() !== 'sin clasificar') {
      nivelesSet.add(c.nivel.trim())
    }
  })

  // Si no hay clasificados pero hay cursos, incluir lo que haya
  if (nivelesSet.size === 0 && data && data.length > 0) {
    data.forEach(c => {
      if (c.nivel && c.nivel.trim()) nivelesSet.add(c.nivel.trim())
    })
  }

  return ordenarNiveles(Array.from(nivelesSet))
}

/**
 * Obtiene las letras disponibles para un nivel consultado (ej. ["A", "B"]) junto con su curso_id.
 */
const obtenerLetrasPorNivel = async (tenantId, nivel) => {
  if (!nivel || !nivel.trim()) {
    const err = new Error("El parámetro 'nivel' es requerido")
    err.statusCode = 400
    throw err
  }

  const periodoActivo = await obtenerPeriodoActivo(tenantId)

  let query = supabase
    .from('cursos')
    .select('id, nombre, nivel, letra')
    .eq('tenant_id', tenantId)
    .ilike('nivel', nivel.trim())
    .order('letra', { ascending: true })

  if (periodoActivo) {
    query = query.or(`periodo_id.eq.${periodoActivo.id},periodo_id.is.null`)
  }

  const { data, error } = await query
  if (error) {
    logger.error(`Error al obtener letras para nivel ${nivel}:`, error)
    throw error
  }

  return (data || []).map(c => {
    let letra = c.letra
    if (!letra && c.nombre) {
      const match = c.nombre.trim().match(/\s+([A-Za-z0-9]{1,2})$/)
      letra = match ? match[1].toUpperCase() : 'A'
    }
    return {
      id: c.id,
      letra: letra || 'A',
      nombre: c.nombre,
      nivel: c.nivel,
    }
  })
}

/**
 * Obtiene la nómina de estudiantes activos matriculados en un curso específico, ordenada alfabéticamente.
 */
const obtenerEstudiantesPorCurso = async (tenantId, cursoId) => {
  if (!cursoId) {
    const err = new Error('El ID de curso es requerido')
    err.statusCode = 400
    throw err
  }

  // 1. Verificar que el curso pertenezca al tenant (aislamiento multi-tenant)
  const { data: curso, error: cursoErr } = await supabase
    .from('cursos')
    .select('id, nombre, nivel, letra')
    .eq('id', cursoId)
    .eq('tenant_id', tenantId)
    .single()

  if (cursoErr || !curso) {
    const err = new Error('Curso no encontrado o no pertenece a este establecimiento')
    err.statusCode = 404
    throw err
  }

  // 2. Consultar estudiantes activos del curso
  const { data: estudiantes, error } = await supabase
    .from('estudiantes')
    .select('id, nombre, apellido, rut, es_pie, activo')
    .eq('curso_id', cursoId)
    .eq('tenant_id', tenantId)
    .eq('activo', true)
    .order('apellido', { ascending: true })
    .order('nombre', { ascending: true })

  if (error) {
    logger.error(`Error al obtener estudiantes del curso ${cursoId}:`, error)
    throw error
  }

  return (estudiantes || []).map(e => ({
    id: e.id,
    nombre: e.nombre,
    apellido: e.apellido,
    rut: e.rut,
    es_pie: Boolean(e.es_pie),
  }))
}

module.exports = {
  obtenerPeriodoActivo,
  listarCursos,
  obtenerNiveles,
  obtenerLetrasPorNivel,
  obtenerEstudiantesPorCurso,
}
