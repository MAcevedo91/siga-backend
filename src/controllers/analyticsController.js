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

// Jerarquía oficial de cursos en Chile para ordenamiento de matriz
const ORDEN_NIVELES_CHILE = [
  'Pre-Kínder', 'Prekinder', 'Pre-Kinder', 'Pre Kínder',
  'Kínder', 'Kinder',
  '1° Básico', '2° Básico', '3° Básico', '4° Básico',
  '5° Básico', '6° Básico', '7° Básico', '8° Básico',
  '1° Medio', '2° Medio', '3° Medio', '4° Medio',
]

const MESES_ESCOLAR = [
  { numero: 3, nombre: 'Mar', nombreCompleto: 'Marzo' },
  { numero: 4, nombre: 'Abr', nombreCompleto: 'Abril' },
  { numero: 5, nombre: 'May', nombreCompleto: 'Mayo' },
  { numero: 6, nombre: 'Jun', nombreCompleto: 'Junio' },
  { numero: 7, nombre: 'Jul', nombreCompleto: 'Julio' },
  { numero: 8, nombre: 'Ago', nombreCompleto: 'Agosto' },
  { numero: 9, nombre: 'Sep', nombreCompleto: 'Septiembre' },
  { numero: 10, nombre: 'Oct', nombreCompleto: 'Octubre' },
  { numero: 11, nombre: 'Nov', nombreCompleto: 'Noviembre' },
  { numero: 12, nombre: 'Dic', nombreCompleto: 'Diciembre' },
]

function calcularNivelAlerta(total, graves = 0, gravisimas = 0) {
  if (total >= 5 || gravisimas >= 1 || graves >= 2) return 'rojo'
  if ((total >= 2 && total <= 4) || graves === 1) return 'amarillo'
  return 'verde'
}

function generarRecomendacionPedagogica(total, graves, gravisimas) {
  if (gravisimas >= 1) {
    return 'Alerta Crítica: Activar de inmediato protocolo RICE normativo, notificar a Inspectoría General y convocar a equipo directivo.'
  }
  if (graves >= 2 || total >= 6) {
    return 'Alerta Alta: Focalizar intervención con Dupla Psicosocial, realizar dinámica de aula y citar a apoderados de alumnos involucrados.'
  }
  if (graves === 1 || total >= 2) {
    return 'Alerta Preventiva: Monitorear clima de aula en Consejo de Profesores y realizar taller de resolución pacífica de conflictos.'
  }
  return 'Clima Favorable: Mantener reforzamiento positivo y seguimiento regular de convivencia.'
}

/**
 * GET /api/v1/analytics/mapa-calor-cursos
 * Retorna matriz agregada Curso vs Mes del año con niveles de alerta y protección RBAC
 */
async function getMapaCalorCursos(req, res) {
  try {
    const tenantId = req.user.tenant_id
    const userRol = req.user.rol || 'Docente'
    const anio = parseInt(req.query.anio, 10) || new Date().getFullYear()

    // 1. Control de acceso RBAC
    const rolesDirectivos = ['Administrador', 'Directivo', 'Inspector', 'Equipo de Formación']
    if (!rolesDirectivos.includes(userRol) && userRol !== 'Docente') {
      return res.status(403).json({
        success: false,
        error: 'No tienes autorización para consultar el mapa de calor de convivencia escolar'
      })
    }

    // 2. Obtener cursos del tenant
    let cursosQuery = supabase
      .from('cursos')
      .select('id, nombre, nivel, letra, anio_academico')
      .eq('tenant_id', tenantId)

    // Si es docente con jefatura específica, restringir a su curso
    if (userRol === 'Docente' && req.user.curso_id) {
      cursosQuery = cursosQuery.eq('id', req.user.curso_id)
    }

    const { data: cursos, error: cursosError } = await cursosQuery
    if (cursosError) throw new Error(cursosError.message)

    if (!cursos || cursos.length === 0) {
      return res.json({
        success: true,
        data: {
          anio,
          meses: MESES_ESCOLAR,
          cursos: [],
          resumen_global: { total_incidentes: 0, cursos_rojos: 0, cursos_amarillos: 0, cursos_verdes: 0 }
        }
      })
    }

    // 3. Obtener incidentes del año vinculados a estudiantes de estos cursos
    const { data: incidentesRaw, error: incError } = await supabase
      .from('incidente_estudiantes')
      .select(`
        incidente_id,
        estudiantes!inner (
          id,
          curso_id,
          tenant_id
        ),
        incidentes!inner (
          id,
          fecha,
          gravedad
        )
      `)
      .eq('estudiantes.tenant_id', tenantId)
      .gte('incidentes.fecha', `${anio}-01-01`)
      .lte('incidentes.fecha', `${anio}-12-31`)

    if (incError) throw new Error(incError.message)

    // 4. Estructurar matriz por curso y mes (evitando duplicar un mismo incidente si hay varios alumnos del mismo curso)
    const matrizIncidentes = {}
    cursos.forEach(c => {
      matrizIncidentes[c.id] = {}
      MESES_ESCOLAR.forEach(m => {
        matrizIncidentes[c.id][m.numero] = {
          total: 0,
          leves: 0,
          graves: 0,
          gravisimas: 0,
          incidentesIds: new Set()
        }
      })
    })

    ;(incidentesRaw || []).forEach(row => {
      const cursoId = row.estudiantes?.curso_id
      const inc = row.incidentes
      if (!cursoId || !matrizIncidentes[cursoId] || !inc?.fecha) return

      const mes = new Date(inc.fecha).getUTCMonth() + 1 // 1 a 12
      if (matrizIncidentes[cursoId][mes]) {
        const celda = matrizIncidentes[cursoId][mes]
        if (!celda.incidentesIds.has(inc.id)) {
          celda.incidentesIds.add(inc.id)
          celda.total += 1
          if (inc.gravedad === 'Leve') celda.leves += 1
          else if (inc.gravedad === 'Grave') celda.graves += 1
          else if (inc.gravedad === 'Gravísima' || inc.gravedad === 'Gravísimo') celda.gravisimas += 1
        }
      }
    })

    // 5. Formatear y calcular semáforos por celda y por curso
    let totalIncidentesAnio = 0
    let cursosRojos = 0
    let cursosAmarillos = 0
    let cursosVerdes = 0

    const cursosFormateados = cursos.map(curso => {
      const mesesObj = {}
      let totalAnualCurso = 0
      let gravesAnualCurso = 0
      let gravisimasAnualCurso = 0

      MESES_ESCOLAR.forEach(m => {
        const celda = matrizIncidentes[curso.id][m.numero]
        const alerta = calcularNivelAlerta(celda.total, celda.graves, celda.gravisimas)
        mesesObj[m.numero] = {
          total: celda.total,
          leves: celda.leves,
          graves: celda.graves,
          gravisimas: celda.gravisimas,
          alerta
        }
        totalAnualCurso += celda.total
        gravesAnualCurso += celda.graves
        gravisimasAnualCurso += celda.gravisimas
      })

      const alertaGeneral = calcularNivelAlerta(totalAnualCurso, gravesAnualCurso, gravisimasAnualCurso)
      totalIncidentesAnio += totalAnualCurso
      if (alertaGeneral === 'rojo') cursosRojos += 1
      else if (alertaGeneral === 'amarillo') cursosAmarillos += 1
      else cursosVerdes += 1

      return {
        id: curso.id,
        nombre: curso.nombre,
        nivel: curso.nivel,
        letra: curso.letra,
        meses: mesesObj,
        total_anual: totalAnualCurso,
        graves_anual: gravesAnualCurso,
        gravisimas_anual: gravisimasAnualCurso,
        alerta_general: alertaGeneral
      }
    })

    // 6. Ordenar según jerarquía escolar de Chile
    cursosFormateados.sort((a, b) => {
      const idxA = ORDEN_NIVELES_CHILE.findIndex(n => n.toLowerCase() === (a.nivel || '').trim().toLowerCase())
      const idxB = ORDEN_NIVELES_CHILE.findIndex(n => n.toLowerCase() === (b.nivel || '').trim().toLowerCase())
      if (idxA !== -1 && idxB !== -1) {
        if (idxA !== idxB) return idxA - idxB
        return (a.letra || '').localeCompare(b.letra || '')
      }
      if (idxA !== -1) return -1
      if (idxB !== -1) return 1
      return a.nombre.localeCompare(b.nombre, 'es', { numeric: true })
    })

    res.json({
      success: true,
      data: {
        anio,
        meses: MESES_ESCOLAR,
        cursos: cursosFormateados,
        resumen_global: {
          total_incidentes: totalIncidentesAnio,
          cursos_rojos: cursosRojos,
          cursos_amarillos: cursosAmarillos,
          cursos_verdes: cursosVerdes
        }
      }
    })
  } catch (error) {
    logger.error('Error al obtener mapa de calor de cursos:', {
      error: error.message,
      tenantId: req.user.tenant_id
    })
    res.status(500).json({
      success: false,
      error: 'Error al procesar el mapa de calor escolar'
    })
  }
}

/**
 * GET /api/v1/analytics/mapa-calor-cursos/detalle
 * Retorna diagnóstico pedagógico agregado sin nombres de estudiantes (drill-down no estigmatizante)
 */
async function getDetalleCeldaMapaCalor(req, res) {
  try {
    const tenantId = req.user.tenant_id
    const userRol = req.user.rol || 'Docente'
    const { curso_id, mes, anio } = req.query

    if (!curso_id || !mes) {
      return res.status(400).json({
        success: false,
        error: 'Los parámetros curso_id y mes son obligatorios'
      })
    }

    const mesNum = parseInt(mes, 10)
    const anioNum = parseInt(anio, 10) || new Date().getFullYear()

    if (mesNum < 1 || mesNum > 12) {
      return res.status(400).json({
        success: false,
        error: 'El mes debe estar comprendido entre 1 y 12'
      })
    }

    // Control RBAC
    if (userRol === 'Docente' && req.user.curso_id && req.user.curso_id !== curso_id) {
      return res.status(403).json({
        success: false,
        error: 'No tienes autorización para consultar el detalle de otro curso'
      })
    }

    // 1. Obtener curso
    const { data: curso, error: cursoErr } = await supabase
      .from('cursos')
      .select('id, nombre, nivel, letra')
      .eq('id', curso_id)
      .eq('tenant_id', tenantId)
      .single()

    if (cursoErr || !curso) {
      return res.status(404).json({
        success: false,
        error: 'Curso no encontrado en este establecimiento'
      })
    }

    // 2. Rango de fechas para el mes
    const startDate = `${anioNum}-${String(mesNum).padStart(2, '0')}-01`
    const lastDay = new Date(Date.UTC(anioNum, mesNum, 0)).getDate()
    const endDate = `${anioNum}-${String(mesNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    // 3. Consultar incidentes
    const { data: incidentesRaw, error: incErr } = await supabase
      .from('incidente_estudiantes')
      .select(`
        incidente_id,
        estudiante_id,
        estudiantes!inner (
          id,
          curso_id,
          tenant_id
        ),
        incidentes!inner (
          id,
          fecha,
          gravedad,
          estado,
          tipo_abordaje_id,
          tipos_abordaje ( nombre )
        )
      `)
      .eq('estudiantes.tenant_id', tenantId)
      .eq('estudiantes.curso_id', curso_id)
      .gte('incidentes.fecha', startDate)
      .lte('incidentes.fecha', endDate)

    if (incErr) throw new Error(incErr.message)

    // 4. Agregar métricas éticas y pedagógicas
    const incidentesVistos = new Set()
    const estudiantesVistos = new Set()
    const gravedadConteo = { Leve: 0, Grave: 0, 'Gravísima': 0 }
    const tipologiasConteo = {}
    const estadosConteo = { 'En Investigación': 0, Derivado: 0, Cerrado: 0 }

    ;(incidentesRaw || []).forEach(row => {
      const inc = row.incidentes
      if (!inc) return

      if (row.estudiante_id) estudiantesVistos.add(row.estudiante_id)

      if (!incidentesVistos.has(inc.id)) {
        incidentesVistos.add(inc.id)
        if (gravedadConteo[inc.gravedad] !== undefined) {
          gravedadConteo[inc.gravedad] += 1
        } else if (inc.gravedad === 'Gravísimo') {
          gravedadConteo['Gravísima'] += 1
        }

        const tipoNombre = inc.tipos_abordaje?.nombre || 'General / Sin clasificar'
        tipologiasConteo[tipoNombre] = (tipologiasConteo[tipoNombre] || 0) + 1

        if (estadosConteo[inc.estado] !== undefined) {
          estadosConteo[inc.estado] += 1
        }
      }
    })

    const total = incidentesVistos.size
    const alerta = calcularNivelAlerta(total, gravedadConteo.Grave, gravedadConteo['Gravísima'])
    const recomendacion = generarRecomendacionPedagogica(total, gravedadConteo.Grave, gravedadConteo['Gravísima'])
    const nombreMes = MESES_ESCOLAR.find(m => m.numero === mesNum)?.nombreCompleto || `Mes ${mesNum}`

    res.json({
      success: true,
      data: {
        curso,
        mes: {
          numero: mesNum,
          nombre: nombreMes,
          anio: anioNum
        },
        diagnostico: {
          total_incidentes: total,
          estudiantes_involucrados_total: estudiantesVistos.size,
          nivel_alerta: alerta,
          gravedad: gravedadConteo,
          tipologias: Object.entries(tipologiasConteo).map(([nombre, cantidad]) => ({
            nombre,
            cantidad,
            porcentaje: total > 0 ? Math.round((cantidad / total) * 100) : 0
          })).sort((a, b) => b.cantidad - a.cantidad),
          estados: estadosConteo,
          recomendacion_pedagogica: recomendacion,
          nota_privacidad: 'Información agregada con propósitos pedagógicos y formativos. Conforme a la Ley N° 19.628, se resguarda la privacidad de los menores.'
        }
      }
    })
  } catch (error) {
    logger.error('Error al obtener detalle de celda del mapa de calor:', {
      error: error.message,
      tenantId: req.user.tenant_id
    })
    res.status(500).json({
      success: false,
      error: 'Error al procesar el diagnóstico del curso'
    })
  }
}

module.exports = {
  getResumen,
  getTendenciaMensual,
  getPorGravedad,
  getTopEstudiantes,
  getTiempoResolucion,
  getMapaCalorCursos,
  getDetalleCeldaMapaCalor
}
