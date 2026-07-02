const { supabase } = require('../utils/db')

/**
 * Calculate risk score for a student
 *
 * Algorithm:
 * - Frequency: # incidents in last 30 days (max 20 points)
 * - Severity: Weighted by gravedad (Leve: 5pts, Grave: 15pts, Gravísimo: 30pts)
 * - Recency: Recent incidents weighted more (last 7 days = 1.5x multiplier)
 *
 * Score Range: 0-100
 * - 0-25: Bajo
 * - 26-50: Medio
 * - 51-75: Alto
 * - 76-100: Crítico
 */

const SEVERITY_WEIGHTS = {
  'Leve': 5,
  'Grave': 15,
  'Gravísimo': 30
}

const RECENCY_MULTIPLIER = 1.5

async function calcularRiesgoEstudiante(estudianteId, tenantId) {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  // Get incidents from last 30 days
  const { data: incidentes, error } = await supabase
    .from('incidentes')
    .select('id, gravedad, fecha')
    .eq('estudiante_id', estudianteId)
    .eq('tenant_id', tenantId)
    .gte('fecha', thirtyDaysAgo.toISOString())
    .order('fecha', { ascending: false })

  if (error) throw new Error(error.message)
  if (!incidentes || incidentes.length === 0) {
    return { score: 0, level: 'Bajo', details: { total: 0, recent: 0 } }
  }

  // Frequency score (max 20 points)
  const frequencyScore = Math.min(incidentes.length * 2, 20)

  // Severity score (weighted)
  let severityScore = 0
  let recentCount = 0

  for (const incidente of incidentes) {
    const basePoints = SEVERITY_WEIGHTS[incidente.gravedad] || 5
    const incidentDate = new Date(incidente.fecha)

    // Apply recency multiplier
    const multiplier = incidentDate >= sevenDaysAgo ? RECENCY_MULTIPLIER : 1.0
    severityScore += basePoints * multiplier

    if (incidentDate >= sevenDaysAgo) {
      recentCount++
    }
  }

  // Total score (cap at 100)
  const totalScore = Math.min(frequencyScore + severityScore, 100)

  // Determine level
  let level
  if (totalScore < 26) level = 'Bajo'
  else if (totalScore < 51) level = 'Medio'
  else if (totalScore < 76) level = 'Alto'
  else level = 'Crítico'

  return {
    score: Math.round(totalScore),
    level,
    details: {
      total: incidentes.length,
      recent: recentCount,
      frequencyScore,
      severityScore: Math.round(severityScore)
    }
  }
}

async function getEstudiantesConRiesgo(tenantId, minScore = 0) {
  // Get all estudiantes
  const { data: estudiantes, error } = await supabase
    .from('estudiantes')
    .select('id, nombre, apellido, rut')
    .eq('tenant_id', tenantId)

  if (error) throw new Error(error.message)
  if (!estudiantes || estudiantes.length === 0) {
    return []
  }

  // OPTIMIZATION: Fetch ALL incidents for ALL students in ONE query
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const estudianteIds = estudiantes.map(e => e.id)

  const { data: allIncidentes, error: incidentesError } = await supabase
    .from('incidentes')
    .select('id, estudiante_id, gravedad, fecha')
    .eq('tenant_id', tenantId)
    .in('estudiante_id', estudianteIds)
    .gte('fecha', thirtyDaysAgo.toISOString())
    .order('fecha', { ascending: false })

  if (incidentesError) throw new Error(incidentesError.message)

  // Group incidents by estudiante_id in memory
  const incidentesByEstudiante = {}
  for (const incidente of (allIncidentes || [])) {
    if (!incidentesByEstudiante[incidente.estudiante_id]) {
      incidentesByEstudiante[incidente.estudiante_id] = []
    }
    incidentesByEstudiante[incidente.estudiante_id].push(incidente)
  }

  // Calculate risk for each student using grouped data
  const estudiantesConRiesgo = []

  for (const estudiante of estudiantes) {
    const incidentes = incidentesByEstudiante[estudiante.id] || []

    // Calculate risk inline (same algorithm as calcularRiesgoEstudiante)
    let riesgo
    if (incidentes.length === 0) {
      riesgo = { score: 0, level: 'Bajo', details: { total: 0, recent: 0 } }
    } else {
      // Frequency score (max 20 points)
      const frequencyScore = Math.min(incidentes.length * 2, 20)

      // Severity score (weighted)
      let severityScore = 0
      let recentCount = 0

      for (const incidente of incidentes) {
        const basePoints = SEVERITY_WEIGHTS[incidente.gravedad] || 5
        const incidentDate = new Date(incidente.fecha)

        // Apply recency multiplier
        const multiplier = incidentDate >= sevenDaysAgo ? RECENCY_MULTIPLIER : 1.0
        severityScore += basePoints * multiplier

        if (incidentDate >= sevenDaysAgo) {
          recentCount++
        }
      }

      // Total score (cap at 100)
      const totalScore = Math.min(frequencyScore + severityScore, 100)

      // Determine level
      let level
      if (totalScore < 26) level = 'Bajo'
      else if (totalScore < 51) level = 'Medio'
      else if (totalScore < 76) level = 'Alto'
      else level = 'Crítico'

      riesgo = {
        score: Math.round(totalScore),
        level,
        details: {
          total: incidentes.length,
          recent: recentCount,
          frequencyScore,
          severityScore: Math.round(severityScore)
        }
      }
    }

    if (riesgo.score >= minScore) {
      estudiantesConRiesgo.push({
        ...estudiante,
        riesgo
      })
    }
  }

  // Sort by score descending
  estudiantesConRiesgo.sort((a, b) => b.riesgo.score - a.riesgo.score)

  return estudiantesConRiesgo
}

module.exports = {
  calcularRiesgoEstudiante,
  getEstudiantesConRiesgo
}
