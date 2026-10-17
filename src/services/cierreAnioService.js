const { z } = require('zod')
const { supabase } = require('../utils/db')
const logger = require('../utils/logger')
const { invalidateEstudiantes, invalidateDashboard } = require('../utils/cacheInvalidator')

// Secuencia de progresión oficial del sistema escolar chileno (Pre-Kínder a 4° Medio)
const SECUENCIA_NIVELES = [
  'Pre-Kínder',
  'Kínder',
  '1° Básico',
  '2° Básico',
  '3° Básico',
  '4° Básico',
  '5° Básico',
  '6° Básico',
  '7° Básico',
  '8° Básico',
  '1° Medio',
  '2° Medio',
  '3° Medio',
  '4° Medio',
]

/**
 * Normaliza nombres de niveles (ej. 'Prekinder' -> 'Pre-Kínder', '1 Medio' -> '1° Medio')
 */
const normalizarNivel = (nivelStr) => {
  if (!nivelStr) return ''
  const trimmed = nivelStr.trim().toLowerCase()
  if (trimmed.includes('pre-k') || trimmed.includes('prek') || trimmed.includes('pre k')) return 'Pre-Kínder'
  if (trimmed.includes('kínder') || trimmed.includes('kinder')) return 'Kínder'

  // Enseñanza Media (1° a 4° Medio) - Evaluar primero para evitar colisión con 'Básico'
  const matchMedia = trimmed.match(/([1-4])\s*(?:°|º)?\s*(?:m|medio|media)\b/)
  if (matchMedia) {
    return `${matchMedia[1]}° Medio`
  }

  // Enseñanza Básica (1° a 8° Básico)
  const matchBasica = trimmed.match(/([1-8])\s*(?:°|º)?\s*(?:b|básico|basico)?\b/)
  if (matchBasica) {
    return `${matchBasica[1]}° Básico`
  }

  return nivelStr.trim()
}

/**
 * Obtiene el siguiente nivel escolar. Si es el último nivel de la secuencia (4° Medio), retorna null (egresa).
 */
const obtenerSiguienteNivel = (nivelActual) => {
  const norm = normalizarNivel(nivelActual)
  const idx = SECUENCIA_NIVELES.indexOf(norm)
  if (idx === -1) return null
  if (idx === SECUENCIA_NIVELES.length - 1) return null // Egresado último nivel
  return SECUENCIA_NIVELES[idx + 1]
}

// =============================================================================
// ESQUEMAS DE VALIDACIÓN ZOD
// =============================================================================

const cursoConfigSchema = z.object({
  nombre: z.string().min(1, 'El nombre del curso es requerido'),
  nivel: z.string().min(1, 'El nivel es requerido'),
  letra: z.string().optional().default('A'),
  profesor_jefe_id: z.string().uuid().optional().nullable(),
})

const promocionEstudianteSchema = z.object({
  estudiante_id: z.string().uuid('estudiante_id debe ser UUID válido'),
  curso_anterior_id: z.string().uuid().optional().nullable(),
  estado_final: z.enum(['Promovido', 'Repitente', 'Egresado', 'Retirado'], {
    required_error: 'El estado final es requerido',
  }),
  nuevo_curso_nombre: z.string().optional().nullable(),
})

const ejecutarCierreSchema = z.object({
  periodo_anterior_id: z.string().uuid().optional().nullable(),
  nuevo_anio: z.number().int().min(2020).max(2050),
  fecha_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato fecha_inicio YYYY-MM-DD'),
  fecha_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato fecha_fin YYYY-MM-DD'),
  cursos_config: z.array(cursoConfigSchema).min(1, 'Debe configurar al menos un curso'),
  promociones: z.array(promocionEstudianteSchema).min(1, 'Debe incluir al menos un estudiante'),
})

// =============================================================================
// SERVICIOS
// =============================================================================

/**
 * Obtiene el estado actual del período lectivo y sus cursos para la Escuela El Salvador.
 */
const obtenerEstadoActual = async (tenantId) => {
  // 1. Período activo
  const { data: periodos, error: errPer } = await supabase
    .from('periodos_academicos')
    .select('id, anio, fecha_inicio, fecha_fin, activo')
    .eq('tenant_id', tenantId)
    .eq('activo', true)
    .order('anio', { ascending: false })
    .limit(1)

  if (errPer) {
    logger.error('Error consultando período activo:', errPer)
    throw errPer
  }

  const periodoActivo = periodos && periodos.length > 0 ? periodos[0] : null

  // 2. Cursos del período activo (o los más recientes si no hay período)
  let cursosQuery = supabase
    .from('cursos')
    .select(`
      id, nombre, nivel, letra, periodo_id, anio_academico, profesor_jefe_id,
      usuarios!cursos_profesor_jefe_id_fkey ( id, nombre, apellido, email, avatar_url )
    `)
    .eq('tenant_id', tenantId)
    .order('nombre', { ascending: true })

  if (periodoActivo) {
    cursosQuery = cursosQuery.or(`periodo_id.eq.${periodoActivo.id},periodo_id.is.null`)
  }

  const { data: cursos, error: errCur } = await cursosQuery
  if (errCur) {
    logger.error('Error consultando cursos:', errCur)
    throw errCur
  }

  // 3. Conteo de estudiantes activos
  const { count: totalEstudiantes, error: errEst } = await supabase
    .from('estudiantes')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('activo', true)

  if (errEst) {
    logger.error('Error contando estudiantes:', errEst)
    throw errEst
  }

  // 4. Lista de docentes disponibles para asignación de jefatura (solo rol Docente)
  const { data: docentes, error: errDoc } = await supabase
    .from('usuarios')
    .select('id, nombre, apellido, email, rol, avatar_url')
    .eq('tenant_id', tenantId)
    .eq('activo', true)
    .eq('rol', 'Docente')
    .order('apellido', { ascending: true })

  if (errDoc) {
    logger.error('Error listando docentes:', errDoc)
  }

  return {
    periodo_activo: periodoActivo,
    total_estudiantes_activos: totalEstudiantes || 0,
    cursos: (cursos || []).map(c => ({
      ...c,
      profesor_jefe: c.usuarios ? `${c.usuarios.nombre} ${c.usuarios.apellido}` : null,
    })),
    docentes_disponibles: docentes || [],
  }
}

/**
 * Genera la propuesta automática de promoción (Opción A y B del cliente).
 * @param {string} tenantId
 * @param {Object} [opciones]
 * @param {'BASICA'|'MEDIA'|'AUTO'} [opciones.tipo_establecimiento='AUTO']
 */
const generarPropuestaPromocion = async (tenantId, opciones = {}) => {
  const estado = await obtenerEstadoActual(tenantId)
  const periodoActual = estado.periodo_activo
  const anioActual = periodoActual ? periodoActual.anio : new Date().getFullYear()
  const nuevoAnioSugerido = anioActual + 1

  // 1. Obtener todos los estudiantes activos con su curso actual
  const { data: estudiantes, error: errEst } = await supabase
    .from('estudiantes')
    .select(`
      id, rut, nombre, apellido, curso_id, es_pie,
      cursos ( id, nombre, nivel, letra, profesor_jefe_id )
    `)
    .eq('tenant_id', tenantId)
    .eq('activo', true)
    .order('apellido', { ascending: true })

  if (errEst) {
    logger.error('Error consultando nómina de estudiantes:', errEst)
    throw errEst
  }

  // 2. Proyectar cursos para el nuevo año con jefatura sugerida (Pregunta 5: Opción B)
  // Agrupamos los cursos base existentes
  const cursosExistentes = estado.cursos || []
  const cursosProyectadosMap = new Map()

  // Determinar si el establecimiento es solo Básica o tiene Media
  // Si viene explícito en opciones (ej. 'BASICA'), se respeta; sino se autodetecta por cursos existentes
  const tipoEstablecimiento = opciones.tipo_establecimiento || 'AUTO'
  const tieneEnsenanzaMedia = tipoEstablecimiento === 'MEDIA' 
    ? true 
    : tipoEstablecimiento === 'BASICA'
    ? false
    : cursosExistentes.some(c => normalizarNivel(c.nivel).includes('Medio'))

  // Si el colegio solo tiene Básica, los niveles base van de Pre-Kínder a 8° Básico; si tiene Media, hasta 4° Medio
  const secuenciaActiva = tieneEnsenanzaMedia
    ? SECUENCIA_NIVELES
    : SECUENCIA_NIVELES.filter(n => !n.includes('Medio'))

  // Generar la grilla de cursos proyectados según la oferta educativa activa
  secuenciaActiva.forEach(nivel => {
    // Si en el colegio hay letra A y B en ese nivel o por defecto A
    const cursosDeEseNivel = cursosExistentes.filter(
      c => normalizarNivel(c.nivel) === nivel
    )

    if (cursosDeEseNivel.length > 0) {
      cursosDeEseNivel.forEach(c => {
        const letra = c.letra || 'A'
        const nombre = `${nivel} ${letra}`.trim()
        cursosProyectadosMap.set(nombre, {
          nombre,
          nivel,
          letra,
          profesor_jefe_id: c.profesor_jefe_id || null, // Clona asignación previa sugerida
          profesor_jefe_nombre: c.profesor_jefe || null,
        })
      })
    } else {
      // Curso por defecto A
      const nombre = `${nivel} A`
      cursosProyectadosMap.set(nombre, {
        nombre,
        nivel,
        letra: 'A',
        profesor_jefe_id: null,
        profesor_jefe_nombre: null,
      })
    }
  })

  // Si además existen cursos específicos en BD que no estuvieran en la secuencia, los preservamos
  cursosExistentes.forEach(c => {
    const normNivel = normalizarNivel(c.nivel)
    const nombre = c.nombre || `${normNivel} ${c.letra || 'A'}`.trim()
    if (!cursosProyectadosMap.has(nombre) && normNivel) {
      cursosProyectadosMap.set(nombre, {
        nombre,
        nivel: normNivel,
        letra: c.letra || 'A',
        profesor_jefe_id: c.profesor_jefe_id || null,
        profesor_jefe_nombre: c.profesor_jefe || null,
      })
    }
  })

  // 3. Armar propuesta por cada estudiante
  const propuestaAlumnos = (estudiantes || []).map(est => {
    const cursoActual = est.cursos
    const nivelActual = cursoActual?.nivel ? normalizarNivel(cursoActual.nivel) : null
    const letraActual = cursoActual?.letra || 'A'
    const siguienteNivel = nivelActual ? obtenerSiguienteNivel(nivelActual) : null

    // Es egresado si:
    // - Si el establecimiento solo tiene Básica: 8° Básico es el nivel de egreso.
    // - Si el establecimiento tiene Media: 4° Medio es el nivel de egreso (o si no hay siguiente nivel en la secuencia).
    const esEgresadoCiclo = tieneEnsenanzaMedia
      ? nivelActual === '4° Medio' || !siguienteNivel
      : nivelActual === '8° Básico' || !siguienteNivel

    let estadoPropuesto = 'Promovido'
    let nuevoCursoSugerido = null

    if (esEgresadoCiclo) {
      estadoPropuesto = 'Egresado'
      nuevoCursoSugerido = null
    } else {
      nuevoCursoSugerido = `${siguienteNivel} ${letraActual}`.trim()
      // Si el curso sugerido no estuviera en el mapa proyectado, lo agregamos para que exista como opción de destino
      if (!cursosProyectadosMap.has(nuevoCursoSugerido)) {
        cursosProyectadosMap.set(nuevoCursoSugerido, {
          nombre: nuevoCursoSugerido,
          nivel: siguienteNivel,
          letra: letraActual,
          profesor_jefe_id: null,
          profesor_jefe_nombre: null,
        })
      }
    }

    return {
      estudiante_id: est.id,
      rut: est.rut,
      nombre: est.nombre,
      apellido: est.apellido,
      es_pie: est.es_pie,
      curso_anterior_id: est.curso_id,
      curso_anterior_nombre: cursoActual?.nombre || 'Sin Curso',
      nivel_anterior: nivelActual || 'Sin Nivel',
      estado_propuesto: estadoPropuesto,
      nuevo_curso_nombre_sugerido: nuevoCursoSugerido,
      es_egresado_automatico: esEgresadoCiclo,
    }
  })

  const totalPromovidos = propuestaAlumnos.filter(a => a.estado_propuesto === 'Promovido').length
  const totalEgresados = propuestaAlumnos.filter(a => a.estado_propuesto === 'Egresado').length

  return {
    periodo_actual: periodoActual,
    nuevo_anio_sugerido: nuevoAnioSugerido,
    fecha_inicio_sugerida: `${nuevoAnioSugerido}-03-01`,
    fecha_fin_sugerida: `${nuevoAnioSugerido}-12-31`,
    tipo_establecimiento: tieneEnsenanzaMedia ? 'MEDIA' : 'BASICA',
    tiene_ensenanza_media: tieneEnsenanzaMedia,
    cursos_proyectados: Array.from(cursosProyectadosMap.values()),
    alumnos_propuesta: propuestaAlumnos,
    resumen: {
      total_estudiantes: propuestaAlumnos.length,
      promovidos_propuestos: totalPromovidos,
      egresados_propuestos: totalEgresados,
    },
    docentes_disponibles: estado.docentes_disponibles,
  }
}

/**
 * Ejecuta la transacción de cierre de año lectivo y promoción en Supabase (RPC atómica).
 */
const ejecutarCierreYPromocion = async (tenantId, usuarioId, payload) => {
  // 1. Validar payload con Zod
  const parseResult = ejecutarCierreSchema.safeParse(payload)
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map(i => i.message).join('. ')
    const err = new Error(errorMsg)
    err.statusCode = 400
    throw err
  }

  const {
    periodo_anterior_id,
    nuevo_anio,
    fecha_inicio,
    fecha_fin,
    cursos_config,
    promociones,
  } = parseResult.data

  logger.info(`[CIERRE_ANIO] Iniciando cierre transaccional para tenant ${tenantId}. Nuevo año: ${nuevo_anio}. Alumnos: ${promociones.length}`)

  // 2. Invocar la función RPC transaccional en PostgreSQL
  const { data, error } = await supabase.rpc('ejecutar_cierre_anio_y_promocion', {
    p_tenant_id:           tenantId,
    p_usuario_id:          usuarioId || null,
    p_periodo_anterior_id: periodo_anterior_id || null,
    p_nuevo_anio:          nuevo_anio,
    p_fecha_inicio:        fecha_inicio,
    p_fecha_fin:           fecha_fin,
    p_cursos_config:       cursos_config,
    p_promociones:         promociones,
  })

  if (error) {
    logger.error('[CIERRE_ANIO] Error ejecutando RPC en base de datos:', error)
    const dbErr = new Error(`Fallo en el cierre de año escolar: ${error.message}`)
    dbErr.statusCode = 500
    throw dbErr
  }

  // 3. Invalidar cachés en Redis/memoria
  try {
    await invalidateEstudiantes(tenantId)
    await invalidateDashboard(tenantId)
  } catch (cacheErr) {
    logger.warn('[CIERRE_ANIO] Advertencia al invalidar caché:', cacheErr.message)
  }

  logger.info(`[CIERRE_ANIO] Cierre completado con éxito: ${JSON.stringify(data)}`)
  return data
}

module.exports = {
  obtenerEstadoActual,
  generarPropuestaPromocion,
  ejecutarCierreYPromocion,
  SECUENCIA_NIVELES,
  obtenerSiguienteNivel,
}
