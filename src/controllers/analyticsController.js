const { supabase } = require('../utils/db')
const logger = require('../utils/logger')

// Helper: Get date range for current and previous month
function getMonthRanges() {
  const now = new Date()
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)

  return {
    currentMonthStart: currentMonthStart.toISOString(),
    previousMonthStart: previousMonthStart.toISOString(),
    previousMonthEnd: previousMonthEnd.toISOString()
  }
}

async function getResumen(req, res) {
  try {
    const tenantId = req.user.tenant_id
    const { currentMonthStart, previousMonthStart, previousMonthEnd } = getMonthRanges()

    // Total incidentes mes actual
    const { count: totalIncidentes } = await supabase
      .from('incidentes')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('fecha', currentMonthStart)

    // Total incidentes mes anterior
    const { count: totalPrevMonth } = await supabase
      .from('incidentes')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('fecha', previousMonthStart)
      .lte('fecha', previousMonthEnd)

    // Variación porcentual
    const variacion = totalPrevMonth > 0
      ? Math.round(((totalIncidentes - totalPrevMonth) / totalPrevMonth) * 100)
      : 0

    // Incidentes abiertos
    const { count: abiertos } = await supabase
      .from('incidentes')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('estado', 'Abierto')

    // Estudiantes con > 3 incidentes (últimos 3 meses)
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

    const { data: estudiantesData } = await supabase.rpc('contar_estudiantes_con_muchos_incidentes', {
      p_tenant_id: tenantId,
      p_fecha_desde: threeMonthsAgo.toISOString(),
      p_minimo_incidentes: 3
    })

    const estudiantesRiesgo = estudiantesData || 0

    res.json({
      success: true,
      data: {
        totalIncidentes,
        variacion,
        abiertos,
        estudiantesRiesgo
      }
    })
  } catch (error) {
    logger.error('Error al obtener resumen de analytics', {
      error: error.message,
      tenantId: req.user.tenant_id
    })
    res.status(500).json({
      success: false,
      error: 'Error al obtener resumen de analytics'
    })
  }
}

async function getTendenciaMensual(req, res) {
  try {
    const tenantId = req.user.tenant_id

    // Últimos 12 meses
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

    const { data, error } = await supabase
      .from('incidentes')
      .select('fecha, gravedad')
      .eq('tenant_id', tenantId)
      .gte('fecha', twelveMonthsAgo.toISOString())
      .order('fecha', { ascending: true })

    if (error) throw new Error(error.message)

    // Agrupar por mes y gravedad
    const monthlyData = {}
    data.forEach(incidente => {
      const date = new Date(incidente.fecha)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { mes: monthKey, Leve: 0, Grave: 0, Gravísimo: 0 }
      }

      monthlyData[monthKey][incidente.gravedad] = (monthlyData[monthKey][incidente.gravedad] || 0) + 1
    })

    const result = Object.values(monthlyData).sort((a, b) => a.mes.localeCompare(b.mes))

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    logger.error('Error al obtener tendencia mensual', {
      error: error.message,
      tenantId: req.user.tenant_id
    })
    res.status(500).json({
      success: false,
      error: 'Error al obtener tendencia mensual'
    })
  }
}

async function getPorGravedad(req, res) {
  try {
    const tenantId = req.user.tenant_id

    const { data, error } = await supabase
      .from('incidentes')
      .select('gravedad')
      .eq('tenant_id', tenantId)

    if (error) throw new Error(error.message)

    // Contar por gravedad
    const counts = { Leve: 0, Grave: 0, Gravísimo: 0 }
    data.forEach(incidente => {
      counts[incidente.gravedad] = (counts[incidente.gravedad] || 0) + 1
    })

    const total = data.length
    const result = Object.entries(counts).map(([gravedad, cantidad]) => ({
      gravedad,
      cantidad,
      porcentaje: total > 0 ? Math.round((cantidad / total) * 100) : 0
    }))

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    logger.error('Error al obtener distribución por gravedad', {
      error: error.message,
      tenantId: req.user.tenant_id
    })
    res.status(500).json({
      success: false,
      error: 'Error al obtener distribución por gravedad'
    })
  }
}

async function getTopEstudiantes(req, res) {
  try {
    const tenantId = req.user.tenant_id

    const { data, error } = await supabase.rpc('obtener_top_estudiantes_incidentes', {
      p_tenant_id: tenantId,
      p_limite: 5
    })

    if (error) throw new Error(error.message)

    res.json({
      success: true,
      data: data || []
    })
  } catch (error) {
    logger.error('Error al obtener top estudiantes', {
      error: error.message,
      tenantId: req.user.tenant_id
    })
    res.status(500).json({
      success: false,
      error: 'Error al obtener top estudiantes'
    })
  }
}

async function getTiempoResolucion(req, res) {
  try {
    const tenantId = req.user.tenant_id

    const { data, error } = await supabase
      .from('incidentes')
      .select('fecha, fecha_cierre')
      .eq('tenant_id', tenantId)
      .eq('estado', 'Cerrado')
      .not('fecha_cierre', 'is', null)

    if (error) throw new Error(error.message)

    if (data.length === 0) {
      return res.json({
        success: true,
        data: { promedio: 0, meta: 7 }
      })
    }

    // Calcular promedio de días entre fecha y fecha_cierre
    const totalDias = data.reduce((sum, incidente) => {
      const inicio = new Date(incidente.fecha)
      const cierre = new Date(incidente.fecha_cierre)
      const dias = Math.ceil((cierre - inicio) / (1000 * 60 * 60 * 24))
      return sum + dias
    }, 0)

    const promedio = Math.round(totalDias / data.length)

    res.json({
      success: true,
      data: {
        promedio,
        meta: 7
      }
    })
  } catch (error) {
    logger.error('Error al obtener tiempo de resolución', {
      error: error.message,
      tenantId: req.user.tenant_id
    })
    res.status(500).json({
      success: false,
      error: 'Error al obtener tiempo de resolución'
    })
  }
}

module.exports = {
  getResumen,
  getTendenciaMensual,
  getPorGravedad,
  getTopEstudiantes,
  getTiempoResolucion
}
