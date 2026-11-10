const { supabase } = require('../utils/db')
const logger = require('../utils/logger')

// =============================================================================
// SERVICIO DE SOCIOGRAMA ESCOLAR: MATRIZ DE ADYACENCIA PONDERADA (TASK 8.1.1.1 & 8.1.2.1)
// =============================================================================

// Ponderaciones oficiales por gravedad de falta y acuerdos restaurativos
const PONDERACION_PESOS = {
  LEVE: 1,
  GRAVE: 3,
  GRAVISIMO: 5,
  MEDIACION: -2,
}

/**
 * Normaliza la gravedad textual de un incidente al peso matemático correspondiente.
 * Soporta variaciones tipográficas: 'Leve', 'Grave', 'Gravísima', 'Gravísimo'.
 *
 * @param {string} gravedad - Gravedad del incidente
 * @returns {number} Peso ponderado
 */
const obtenerPesoPorGravedad = (gravedad) => {
  if (!gravedad) return PONDERACION_PESOS.LEVE
  const normalizada = gravedad.trim().toLowerCase()
  if (
    normalizada.includes('gravisim') ||
    normalizada.includes('gravísim') ||
    normalizada.includes('gravísima') ||
    normalizada.includes('gravísimo')
  ) {
    return PONDERACION_PESOS.GRAVISIMO
  }
  if (normalizada.includes('grave')) {
    return PONDERACION_PESOS.GRAVE
  }
  return PONDERACION_PESOS.LEVE
}

/**
 * Clasifica el tipo cualitativo de vínculo según el peso neto acumulado.
 *
 * @param {number} peso - Peso acumulado de la arista
 * @returns {string} Clasificación cualitativa
 */
const clasificarTipoVinculo = (peso) => {
  if (peso >= 5) return 'conflicto_severo'
  if (peso >= 3) return 'conflicto_moderado'
  if (peso > 0) return 'conflicto_leve'
  if (peso < 0) return 'acuerdo_restaurativo'
  return 'neutro'
}

/**
 * Calcula la centralidad de grado absoluta y normalizada (0 a 100)
 * para cada nodo a partir de la matriz de adyacencia simétrica.
 *
 * C_D(i) = k_i / (N - 1) * 100
 *
 * @param {Array<Array<number>>} matriz - Matriz de adyacencia N x N
 * @param {number} n - Cantidad de nodos
 * @returns {Array<{ grado: number, centralidad_grado_pct: number }>}
 */
const calcularCentralidadGrado = (matriz, n) => {
  if (!matriz || n <= 0) return []
  return matriz.map((fila, i) => {
    let k = 0
    for (let j = 0; j < n; j++) {
      if (i !== j && fila[j] !== 0) {
        k++
      }
    }
    const pct = n > 1 ? Number(((k / (n - 1)) * 100).toFixed(2)) : 0
    return {
      grado: k,
      centralidad_grado_pct: pct,
    }
  })
}

/**
 * Calcula el coeficiente de agrupamiento local de Watts-Strogatz para cada nodo
 * y el coeficiente de agrupamiento promedio global del aula (normalizados de 0 a 100).
 *
 * C_i = (2 * e_i) / (k_i * (k_i - 1))  si k_i >= 2; de lo contrario 0.
 *
 * @param {Array<Array<number>>} matriz - Matriz de adyacencia N x N
 * @param {number} n - Cantidad de nodos
 * @returns {{ coeficientesLocales: Array<{ clustering_local: number, clustering_local_pct: number, triangulos: number }>, coeficienteAgrupamientoPromedioPct: number }}
 */
const calcularCoeficienteAgrupamiento = (matriz, n) => {
  if (!matriz || n <= 0) {
    return {
      coeficientesLocales: [],
      coeficienteAgrupamientoPromedioPct: 0,
    }
  }

  // Identificar vecinos de cada nodo
  const vecinosPorNodo = Array.from({ length: n }, () => [])
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j && matriz[i][j] !== 0) {
        vecinosPorNodo[i].push(j)
      }
    }
  }

  let sumaClustering = 0
  const coeficientesLocales = vecinosPorNodo.map((vecinos) => {
    const k = vecinos.length
    if (k < 2) {
      return {
        clustering_local: 0,
        clustering_local_pct: 0,
        triangulos: 0,
      }
    }

    // Contar aristas entre los vecinos del nodo actual
    let enlacesEntreVecinos = 0
    for (let uIdx = 0; uIdx < k; uIdx++) {
      for (let vIdx = uIdx + 1; vIdx < k; vIdx++) {
        const u = vecinos[uIdx]
        const v = vecinos[vIdx]
        if (matriz[u][v] !== 0) {
          enlacesEntreVecinos++
        }
      }
    }

    const posiblesEnlaces = (k * (k - 1)) / 2
    const cLocal = posiblesEnlaces > 0 ? enlacesEntreVecinos / posiblesEnlaces : 0
    sumaClustering += cLocal

    return {
      clustering_local: Number(cLocal.toFixed(4)),
      clustering_local_pct: Number((cLocal * 100).toFixed(2)),
      triangulos: enlacesEntreVecinos,
    }
  })

  const cPromedio = n > 0 ? sumaClustering / n : 0
  const cPromedioPct = Number((cPromedio * 100).toFixed(2))

  return {
    coeficientesLocales,
    coeficienteAgrupamientoPromedioPct: cPromedioPct,
  }
}

/**
 * Calcula el índice integral de cohesión de aula y diagnóstico pedagógico no estigmatizante (0 a 100).
 *
 * @param {Object} params
 * @param {number} params.n - Total de estudiantes
 * @param {number} params.aisladosCount - Cantidad de estudiantes aislados
 * @param {number} params.coeficienteAgrupamientoPromedioPct - Coeficiente de agrupamiento promedio (0-100)
 * @param {number} params.totalConflictividad - Suma de pesos positivos de tensión
 * @param {number} params.mediacionesCount - Cantidad de mediaciones realizadas
 * @param {number} params.densidadRedPct - Densidad de red en porcentaje (0-100)
 * @returns {{ indice_cohesion: number, diagnostico_clima: string, tasa_integracion_pct: number }}
 */
const calcularIndiceCohesion = ({
  n,
  aisladosCount = 0,
  coeficienteAgrupamientoPromedioPct = 0,
  totalConflictividad = 0,
  mediacionesCount = 0,
  densidadRedPct = 0,
}) => {
  if (n <= 1) {
    return {
      indice_cohesion: 100,
      diagnostico_clima: 'Cohesión positiva y clima colaborativo',
      tasa_integracion_pct: 100,
    }
  }

  // Tasa de integración (estudiantes no aislados)
  const noAislados = Math.max(0, n - aisladosCount)
  const tasaIntegracionPct = Number(((noAislados / n) * 100).toFixed(2))

  // Si no hay ningún conflicto ni enlaces en el curso, el clima es armónico y colaborativo
  if (totalConflictividad === 0 && mediacionesCount === 0) {
    return {
      indice_cohesion: 100,
      diagnostico_clima: 'Cohesión positiva y clima colaborativo',
      tasa_integracion_pct: tasaIntegracionPct,
    }
  }

  // Factor de armonía: penaliza el conflicto per cápita y bonifica las mediaciones restaurativas
  const conflictoPerCapita = totalConflictividad / n
  const bonoMediacion = Math.min(25, mediacionesCount * 5)
  const penalizacionConflicto = conflictoPerCapita * 12
  const factorArmonia = Math.max(0, Math.min(100, 100 - penalizacionConflicto + bonoMediacion))

  // Ponderación de cohesión: 50% armonía/baja tensión, 30% integración grupal, 20% agrupamiento
  const cohesionCruda =
    factorArmonia * 0.5 +
    tasaIntegracionPct * 0.3 +
    coeficienteAgrupamientoPromedioPct * 0.2

  const indiceCohesion = Number(Math.max(0, Math.min(100, cohesionCruda)).toFixed(2))

  // Diagnóstico pedagógico institucional (terminología formativa y no estigmatizante)
  let diagnosticoClima = 'Cohesión positiva y clima colaborativo'
  if (indiceCohesion < 25) {
    diagnosticoClima = 'Foco de atención prioritaria para mediación grupal'
  } else if (indiceCohesion < 50) {
    diagnosticoClima = 'Requiere fortalecimiento de vínculos formativos'
  } else if (indiceCohesion < 75) {
    diagnosticoClima = 'Cohesión moderada con dinámicas estables'
  }

  return {
    indice_cohesion: indiceCohesion,
    diagnostico_clima: diagnosticoClima,
    tasa_integracion_pct: tasaIntegracionPct,
  }
}

/**
 * Calcula el sociograma de aula mediante el algoritmo de co-ocurrencias
 * y matriz de adyacencia ponderada para un curso escolar específico.
 *
 * @param {string} tenantId - UUID del colegio
 * @param {string} cursoId - UUID del curso
 * @returns {Promise<Object>} Grafo { nodes, links, metricas }
 */
const obtenerSociogramaPorCurso = async (tenantId, cursoId) => {
  const tInicio = performance.now()

  if (!cursoId) {
    const err = new Error('cursoId es requerido')
    err.statusCode = 400
    throw err
  }

  // 1. Validar existencia del curso en el tenant
  const { data: curso, error: cursoErr } = await supabase
    .from('cursos')
    .select('id, nombre, nivel, letra, anio_academico')
    .eq('id', cursoId)
    .eq('tenant_id', tenantId)
    .single()

  if (cursoErr || !curso) {
    const err = new Error('Curso no encontrado en el establecimiento')
    err.statusCode = 404
    throw err
  }

  // 2. Obtener nómina de estudiantes activos del curso (Nodos V)
  const { data: estudiantes, error: estErr } = await supabase
    .from('estudiantes')
    .select('id, rut, nombre, apellido, avatar_url, genero, estado_matricula')
    .eq('curso_id', cursoId)
    .eq('tenant_id', tenantId)
    .order('apellido', { ascending: true })

  if (estErr) {
    logger.error('Error al consultar estudiantes para sociograma:', estErr)
    const err = new Error('Error al consultar nómina de estudiantes')
    err.statusCode = 500
    throw err
  }

  const listaEstudiantes = estudiantes || []
  const n = listaEstudiantes.length

  // Si no hay estudiantes en el curso, retornar grafo vacío
  if (n === 0) {
    const tFin = performance.now()
    return {
      curso: { id: curso.id, nombre: curso.nombre },
      nodes: [],
      links: [],
      matriz_adyacencia: [],
      metricas: {
        total_estudiantes: 0,
        total_aristas_activas: 0,
        densidad_red: 0,
        densidad_red_pct: 0,
        coeficiente_agrupamiento_promedio: 0,
        indice_cohesion: 100,
        diagnostico_clima: 'Cohesión positiva y clima colaborativo',
        tasa_integracion_pct: 100,
        estudiantes_aislados: 0,
        conflictividad_global: 0,
        estudiantes_en_riesgo: [],
        pares_criticos: [],
        tiempo_ejecucion_ms: Number((tFin - tInicio).toFixed(2)),
      },
    }
  }

  // Mapeos de búsqueda rápida
  const estudianteIds = listaEstudiantes.map((e) => e.id)
  const idToIndexMap = new Map()
  const indexToEstudianteMap = new Map()

  listaEstudiantes.forEach((est, idx) => {
    idToIndexMap.set(est.id, idx)
    indexToEstudianteMap.set(idx, est)
  })

  // 3. Inicializar matriz de adyacencia simétrica A[N][N] y tracking de detalles
  const matrizAdyacencia = Array.from({ length: n }, () => Array(n).fill(0))

  // Mapa de pares ordenados (u, v) con u < v para consolidar detalles de interacción
  const aristasMap = new Map() // key: "idxMenor-idxMayor"

  const obtenerOCrearArista = (idxU, idxV) => {
    const menor = Math.min(idxU, idxV)
    const mayor = Math.max(idxU, idxV)
    const key = `${menor}-${mayor}`

    if (!aristasMap.has(key)) {
      aristasMap.set(key, {
        sourceIdx: menor,
        targetIdx: mayor,
        sourceId: indexToEstudianteMap.get(menor).id,
        targetId: indexToEstudianteMap.get(mayor).id,
        pesoNeto: 0,
        incidentes_count: 0,
        mediaciones_count: 0,
        gravedades: {
          leves: 0,
          graves: 0,
          gravisimas: 0,
          mediaciones: 0,
        },
      })
    }
    return aristasMap.get(key)
  }

  // Contadores por nodo
  const incidentesCountPorNodo = Array(n).fill(0)
  const mediacionesCountPorNodo = Array(n).fill(0)

  // 4. Consultar y procesar co-ocurrencias en INCIDENTES
  const { data: incidentesParticipantes, error: incErr } = await supabase
    .from('incidente_estudiantes')
    .select(`
      incidente_id,
      estudiante_id,
      es_victima,
      incidentes!inner ( id, gravedad, fecha, tenant_id )
    `)
    .eq('incidentes.tenant_id', tenantId)
    .in('estudiante_id', estudianteIds)

  if (incErr) {
    logger.warn('Advertencia al consultar incidentes para sociograma:', incErr.message)
  } else if (incidentesParticipantes) {
    // Agrupar participantes por cada incidente
    const incidentesGrupos = new Map() // incidente_id -> { gravedad, estudiantes: Set<idx> }

    incidentesParticipantes.forEach((item) => {
      const idx = idToIndexMap.get(item.estudiante_id)
      if (idx !== undefined) {
        incidentesCountPorNodo[idx]++
        const incId = item.incidente_id
        if (!incidentesGrupos.has(incId)) {
          incidentesGrupos.set(incId, {
            gravedad: item.incidentes?.gravedad || 'Leve',
            estudiantes: new Set(),
          })
        }
        incidentesGrupos.get(incId).estudiantes.add(idx)
      }
    })

    // Calcular co-ocurrencias para cada par de estudiantes en el mismo incidente
    incidentesGrupos.forEach((incInfo) => {
      const participantesArr = Array.from(incInfo.estudiantes)
      const pesoIncidente = obtenerPesoPorGravedad(incInfo.gravedad)
      const esGravisimo = pesoIncidente === PONDERACION_PESOS.GRAVISIMO
      const esGrave = pesoIncidente === PONDERACION_PESOS.GRAVE

      for (let i = 0; i < participantesArr.length; i++) {
        for (let j = i + 1; j < participantesArr.length; j++) {
          const u = participantesArr[i]
          const v = participantesArr[j]

          matrizAdyacencia[u][v] += pesoIncidente
          matrizAdyacencia[v][u] += pesoIncidente

          const arista = obtenerOCrearArista(u, v)
          arista.pesoNeto += pesoIncidente
          arista.incidentes_count++

          if (esGravisimo) arista.gravedades.gravisimas++
          else if (esGrave) arista.gravedades.graves++
          else arista.gravedades.leves++
        }
      }
    })
  }

  // 5. Consultar y procesar co-ocurrencias en MEDIACIONES ESCOLARES
  const { data: mediacionesParticipantes, error: medErr } = await supabase
    .from('mediacion_participantes')
    .select(`
      mediacion_id,
      estudiante_id,
      rol_participante,
      mediaciones!inner ( id, estado, fecha_programada, tenant_id )
    `)
    .eq('mediaciones.tenant_id', tenantId)
    .in('estudiante_id', estudianteIds)

  if (medErr) {
    logger.warn('Advertencia al consultar mediaciones para sociograma:', medErr.message)
  } else if (mediacionesParticipantes) {
    const mediacionesGrupos = new Map() // mediacion_id -> Set<idx>

    mediacionesParticipantes.forEach((item) => {
      const idx = idToIndexMap.get(item.estudiante_id)
      if (idx !== undefined) {
        mediacionesCountPorNodo[idx]++
        const medId = item.mediacion_id
        if (!mediacionesGrupos.has(medId)) {
          mediacionesGrupos.set(medId, new Set())
        }
        mediacionesGrupos.get(medId).add(idx)
      }
    })

    // Atenuar tensión (-2 puntos por mediación) entre pares que compartieron mediación
    mediacionesGrupos.forEach((participantesSet) => {
      const participantesArr = Array.from(participantesSet)
      const pesoMediacion = PONDERACION_PESOS.MEDIACION // -2

      for (let i = 0; i < participantesArr.length; i++) {
        for (let j = i + 1; j < participantesArr.length; j++) {
          const u = participantesArr[i]
          const v = participantesArr[j]

          matrizAdyacencia[u][v] += pesoMediacion
          matrizAdyacencia[v][u] += pesoMediacion

          const arista = obtenerOCrearArista(u, v)
          arista.pesoNeto += pesoMediacion
          arista.mediaciones_count++
          arista.gravedades.mediaciones++
        }
      }
    })
  }

  // 6. Construir lista de enlaces (links) filtrando vínculos con interacción
  const links = []
  aristasMap.forEach((arista) => {
    // Solo se incluyen vínculos donde existió al menos una interacción registrada
    if (arista.incidentes_count > 0 || arista.mediaciones_count > 0) {
      links.push({
        source: arista.sourceId,
        target: arista.targetId,
        weight: arista.pesoNeto,
        tipo_vinculo: clasificarTipoVinculo(arista.pesoNeto),
        incidentes_count: arista.incidentes_count,
        co_ocurrencias_incidentes: arista.incidentes_count,
        mediaciones_count: arista.mediaciones_count,
        mediaciones_realizadas: arista.mediaciones_count,
        gravedades: arista.gravedades,
      })
    }
  })

  // 7. Calcular métricas por estudiante (nodos) y análisis de redes (SNA)
  let totalConflictividadGlobal = 0
  let estudiantesAisladosCount = 0

  // Centralidad de grado y agrupamiento local/global
  const gradosSNA = calcularCentralidadGrado(matrizAdyacencia, n)
  const agrupamientoSNA = calcularCoeficienteAgrupamiento(matrizAdyacencia, n)

  const nodes = listaEstudiantes.map((est, idx) => {
    let conflictividadTotal = 0
    let gradoCentralidad = 0

    for (let j = 0; j < n; j++) {
      if (idx !== j && matrizAdyacencia[idx][j] !== 0) {
        gradoCentralidad++
        // Solo sumamos tensión positiva a la conflictividad neta
        if (matrizAdyacencia[idx][j] > 0) {
          conflictividadTotal += matrizAdyacencia[idx][j]
        }
      }
    }

    totalConflictividadGlobal += conflictividadTotal

    if (gradoCentralidad === 0 && incidentesCountPorNodo[idx] === 0 && mediacionesCountPorNodo[idx] === 0) {
      estudiantesAisladosCount++
    }

    // Clasificación de estado de riesgo individual (retrocompatibilidad)
    let estadoRiesgo = 'nulo'
    if (conflictividadTotal >= 8) estadoRiesgo = 'critico'
    else if (conflictividadTotal >= 4) estadoRiesgo = 'alto'
    else if (conflictividadTotal >= 2) estadoRiesgo = 'medio'
    else if (conflictividadTotal === 1) estadoRiesgo = 'bajo'
    else if (conflictividadTotal === 0 && gradoCentralidad > 0) estadoRiesgo = 'neutro'
    else estadoRiesgo = 'nulo'

    // Clasificación pedagógica formativa (no estigmatizante)
    let nivelAcompanamiento = 'convivencia_positiva'
    let clasificacionFormativa = 'Convivencia positiva y armónica'
    if (conflictividadTotal >= 8) {
      nivelAcompanamiento = 'prioritario'
      clasificacionFormativa = 'Acompañamiento formativo prioritario'
    } else if (conflictividadTotal >= 4) {
      nivelAcompanamiento = 'apoyo_formativo'
      clasificacionFormativa = 'Apoyo formativo focalizado'
    } else if (conflictividadTotal >= 1) {
      nivelAcompanamiento = 'observacion_preventiva'
      clasificacionFormativa = 'Observación preventiva formativa'
    }

    const gradoInfo = gradosSNA[idx] || { grado: gradoCentralidad, centralidad_grado_pct: 0 }
    const clusteringInfo = agrupamientoSNA.coeficientesLocales[idx] || { clustering_local_pct: 0, triangulos: 0 }

    return {
      id: est.id,
      rut: est.rut,
      nombre: `${est.nombre} ${est.apellido}`.trim(),
      avatar_url: est.avatar_url || null,
      genero: est.genero || 'No especificado',
      incidentes_count: incidentesCountPorNodo[idx],
      mediaciones_count: mediacionesCountPorNodo[idx],
      conflictividad_total: conflictividadTotal,
      grado_centralidad: gradoInfo.grado,
      centralidad_grado_pct: gradoInfo.centralidad_grado_pct,
      coeficiente_agrupamiento_pct: clusteringInfo.clustering_local_pct,
      triangulos_enlaces: clusteringInfo.triangulos,
      estado_riesgo: estadoRiesgo,
      nivel_acompanamiento: nivelAcompanamiento,
      clasificacion_formativa: clasificacionFormativa,
    }
  })

  // 8. Métricas globales de la red de aula y cohesión grupal
  const maxEnlacesPosibles = (n * (n - 1)) / 2
  const densidadRed = maxEnlacesPosibles > 0
    ? Number((links.length / maxEnlacesPosibles).toFixed(4))
    : 0
  const densidadRedPct = Number((densidadRed * 100).toFixed(2))

  const totalMediacionesRed = links.reduce((acc, l) => acc + (l.mediaciones_count || 0), 0)

  const cohesionResult = calcularIndiceCohesion({
    n,
    aisladosCount: estudiantesAisladosCount,
    coeficienteAgrupamientoPromedioPct: agrupamientoSNA.coeficienteAgrupamientoPromedioPct,
    totalConflictividad: totalConflictividadGlobal,
    mediacionesCount: totalMediacionesRed,
    densidadRedPct,
  })

  // Top estudiantes en mayor acompañamiento formativo (ordenados por conflictividad descendente)
  const estudiantesEnRiesgo = nodes
    .filter((node) => node.conflictividad_total > 0)
    .sort((a, b) => b.conflictividad_total - a.conflictividad_total)
    .slice(0, 5)
    .map((node) => ({
      id: node.id,
      nombre: node.nombre,
      conflictividad: node.conflictividad_total,
      estado_riesgo: node.estado_riesgo,
      nivel_acompanamiento: node.nivel_acompanamiento,
      clasificacion_formativa: node.clasificacion_formativa,
    }))

  // Pares críticos (pares de estudiantes con mayor peso de conflicto)
  const paresCriticos = links
    .filter((link) => link.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5)
    .map((link) => {
      const uEst = indexToEstudianteMap.get(idToIndexMap.get(link.source))
      const vEst = indexToEstudianteMap.get(idToIndexMap.get(link.target))
      return {
        source_id: link.source,
        target_id: link.target,
        source_nombre: uEst ? `${uEst.nombre} ${uEst.apellido}`.trim() : 'Estudiante',
        target_nombre: vEst ? `${vEst.nombre} ${vEst.apellido}`.trim() : 'Estudiante',
        weight: link.weight,
        tipo_vinculo: link.tipo_vinculo,
      }
    })

  const tFin = performance.now()
  const tiempoEjecucionMs = Number((tFin - tInicio).toFixed(2))

  return {
    curso: {
      id: curso.id,
      nombre: curso.nombre,
      nivel: curso.nivel,
      letra: curso.letra,
      anio_academico: curso.anio_academico,
    },
    nodes,
    links,
    matriz_adyacencia: matrizAdyacencia,
    metricas: {
      total_estudiantes: n,
      total_aristas_activas: links.length,
      densidad_red: densidadRed,
      densidad_red_pct: densidadRedPct,
      coeficiente_agrupamiento_promedio: agrupamientoSNA.coeficienteAgrupamientoPromedioPct,
      indice_cohesion: cohesionResult.indice_cohesion,
      diagnostico_clima: cohesionResult.diagnostico_clima,
      tasa_integracion_pct: cohesionResult.tasa_integracion_pct,
      estudiantes_aislados: estudiantesAisladosCount,
      conflictividad_global: totalConflictividadGlobal,
      estudiantes_en_riesgo: estudiantesEnRiesgo,
      pares_criticos: paresCriticos,
      tiempo_ejecucion_ms: tiempoEjecucionMs,
    },
  }
}

module.exports = {
  PONDERACION_PESOS,
  obtenerPesoPorGravedad,
  clasificarTipoVinculo,
  calcularCentralidadGrado,
  calcularCoeficienteAgrupamiento,
  calcularIndiceCohesion,
  obtenerSociogramaPorCurso,
}
