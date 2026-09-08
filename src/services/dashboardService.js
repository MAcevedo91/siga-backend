const { supabase } = require('../utils/db')

const UMBRAL_RIESGO_COMPORTAMIENTO = 6

/**
 * Resumen general del tenant:
 * total incidentes, total graves+gravísimos, protocolos activos, estudiantes con incidentes
 */
const getResumen = async (tenantId) => {
  // Total incidentes
  const { count: totalIncidentes } = await supabase
    .from('incidentes')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  // Total graves y gravísimos
  const { count: totalGraves } = await supabase
    .from('incidentes')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .in('gravedad', ['Grave', 'Gravísima'])

  // Protocolos activos (En Investigación o Derivado)
  const { count: protocolosActivos } = await supabase
    .from('protocolos_rice')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .in('estado', ['En Investigación', 'Derivado'])

  // Estudiantes únicos con al menos un incidente
  const { data: estudiantesRaw } = await supabase
    .from('incidente_estudiantes')
    .select('estudiante_id')
    .eq('estudiante_id', supabase.from('estudiantes').select('id').eq('tenant_id', tenantId))

  // Conteo de estudiantes únicos con incidentes via join
  const { data: estudiantesConIncidentes } = await supabase
    .from('incidente_estudiantes')
    .select('estudiante_id, estudiantes!inner(tenant_id)')
    .eq('estudiantes.tenant_id', tenantId)

  const estudiantesUnicos = new Set(
    (estudiantesConIncidentes || []).map(r => r.estudiante_id)
  ).size

  return {
    total_incidentes:          totalIncidentes  || 0,
    total_graves:              totalGraves      || 0,
    protocolos_activos:        protocolosActivos || 0,
    estudiantes_con_incidentes: estudiantesUnicos,
  }
}

/**
 * Incidentes agrupados por curso — para el gráfico de barras
 */
const getIncidentesPorCurso = async (tenantId) => {
  const { data, error } = await supabase
    .from('incidente_estudiantes')
    .select(`
      estudiantes!inner (
        tenant_id,
        cursos ( nombre )
      )
    `)
    .eq('estudiantes.tenant_id', tenantId)

  if (error) throw error

  // Agrupar por nombre de curso
  const conteo = {}
  for (const row of data || []) {
    const curso = row.estudiantes?.cursos?.nombre || 'Sin curso'
    conteo[curso] = (conteo[curso] || 0) + 1
  }

  return Object.entries(conteo)
    .map(([curso, total]) => ({ curso, total }))
    .sort((a, b) => b.total - a.total)
}

/**
 * Distribución de incidentes por gravedad — para el gráfico de torta
 */
const getIncidentesPorGravedad = async (tenantId) => {
  const { data, error } = await supabase
    .from('incidentes')
    .select('gravedad')
    .eq('tenant_id', tenantId)

  if (error) throw error

  const conteo = { Leve: 0, Grave: 0, Gravísima: 0 }
  for (const row of data || []) {
    if (conteo[row.gravedad] !== undefined) {
      conteo[row.gravedad]++
    }
  }

  const total = Object.values(conteo).reduce((a, b) => a + b, 0)

  return Object.entries(conteo).map(([gravedad, cantidad]) => ({
    gravedad,
    cantidad,
    porcentaje: total > 0 ? Math.round((cantidad / total) * 100) : 0,
  }))
}

/**
 * Tendencia mensual de incidentes — para el gráfico de líneas
 */
const getTendenciaMensual = async (tenantId) => {
  const { data, error } = await supabase
    .from('incidentes')
    .select('fecha')
    .eq('tenant_id', tenantId)
    .order('fecha', { ascending: true })

  if (error) throw error

  // Agrupar por mes
  const conteo = {}
  for (const row of data || []) {
    const mes = row.fecha.substring(0, 7) // YYYY-MM
    conteo[mes] = (conteo[mes] || 0) + 1
  }

  return Object.entries(conteo).map(([mes, total]) => ({ mes, total }))
}

/**
 * Retorna estudiantes cuyo comportamiento en los últimos 30 días supera el umbral de riesgo
 */
const getEstudiantesEnRiesgo = async (tenantId) => {
  // Fecha de hace 30 días
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const dateStr = thirtyDaysAgo.toISOString().split('T')[0]

  // Consultar incidentes de los últimos 30 días y los estudiantes asociados
  // Usamos inner join en estudiantes para asegurar que pertenezcan al tenant
  const { data, error } = await supabase
    .from('incidente_estudiantes')
    .select(`
      estudiante_id,
      estudiantes!inner (
        id, nombre, apellido, rut,
        cursos ( nombre )
      ),
      incidentes!inner (
        id, fecha, gravedad
      )
    `)
    .eq('estudiantes.tenant_id', tenantId)
    .gte('incidentes.fecha', dateStr)

  if (error) throw error

  // Agrupar y calcular score en JS
  const estudiantesMap = new Map()

  for (const row of data || []) {
    const est = row.estudiantes
    const incidente = row.incidentes

    if (!estudiantesMap.has(est.id)) {
      estudiantesMap.set(est.id, {
        id: est.id,
        nombre: est.nombre,
        apellido: est.apellido,
        rut: est.rut,
        curso: est.cursos?.nombre || 'Sin curso',
        score_riesgo: 0,
        total_incidentes_30d: 0,
        total_graves: 0
      })
    }

    const current = estudiantesMap.get(est.id)
    current.total_incidentes_30d += 1

    let puntosPorGravedad = 0
    if (incidente.gravedad === 'Grave') {
      current.total_graves += 1
      puntosPorGravedad = 3
    } else if (incidente.gravedad === 'Gravísima') {
      puntosPorGravedad = 5
    }

    // Fórmula: (1 por estar en últimos 30 días * 2) + (puntos_gravedad)
    // Se suma por CADA incidente individualmente.
    current.score_riesgo += (1 * 2) + puntosPorGravedad
  }

  // Filtrar los que superan el umbral y ordenar
  const enRiesgo = Array.from(estudiantesMap.values())
    .filter(e => e.score_riesgo >= UMBRAL_RIESGO_COMPORTAMIENTO)
    .sort((a, b) => b.score_riesgo - a.score_riesgo)

  return enRiesgo
}

const { getAntecedentesEscalada } = require('./alertasService')

module.exports = {
  getResumen,
  getIncidentesPorCurso,
  getIncidentesPorGravedad,
  getTendenciaMensual,
  getEstudiantesEnRiesgo,
  getAntecedentesEscalada,
}

