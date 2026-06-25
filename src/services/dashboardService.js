const { supabase } = require('../utils/db')

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

module.exports = {
  getResumen,
  getIncidentesPorCurso,
  getIncidentesPorGravedad,
  getTendenciaMensual,
}
