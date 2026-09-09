const { supabase } = require('../utils/db')
const logger = require('../utils/logger')

/**
 * Calcula la diferencia en días calendario enteros entre dos fechas YYYY-MM-DD
 * usando UTC para evitar discrepancias por zonas horarias o cambios de hora.
 * @param {string} fechaStr1 - Fecha base YYYY-MM-DD
 * @param {string} fechaStr2 - Fecha de comparación YYYY-MM-DD
 * @returns {number} Días calendario transcurridos (fechaStr2 - fechaStr1)
 */
function calcularDiasDiferencia(fechaStr1, fechaStr2) {
  const [y1, m1, d1] = fechaStr1.split('-').map(Number)
  const [y2, m2, d2] = fechaStr2.split('-').map(Number)
  const utc1 = Date.UTC(y1, m1 - 1, d1)
  const utc2 = Date.UTC(y2, m2 - 1, d2)
  return Math.floor((utc2 - utc1) / (24 * 60 * 60 * 1000))
}

/**
 * Analiza los antecedentes disciplinarios de un estudiante en los últimos 45 días
 * para detectar patrones críticos de convivencia:
 * 1. Regla de Reincidencia de Ámbito (>= 2 faltas del mismo tipo_abordaje_id en 45 días)
 * 2. Regla de Escalada de Gravedad (salto Leve -> Grave/Gravísima en <= 15 días en ventana de 30 días)
 *
 * @param {string} tenantId - UUID del establecimiento educativo
 * @param {string} estudianteId - UUID del estudiante
 * @returns {Promise<Object>} Diagnóstico analítico estructurado
 */
async function getAntecedentesEscalada(tenantId, estudianteId) {
  // 1. Validar existencia del estudiante en el tenant (Aislamiento Multi-Tenant)
  const { data: estudiante, error: errorEst } = await supabase
    .from('estudiantes')
    .select('id, nombre, apellido')
    .eq('id', estudianteId)
    .eq('tenant_id', tenantId)
    .single()

  if (errorEst || !estudiante) {
    const err = new Error('Estudiante no encontrado o no pertenece a este establecimiento')
    err.statusCode = 404
    throw err
  }

  // 2. Definir ventanas de análisis temporal desde configuración (con fallback por defecto)
  const { data: config } = await supabase
    .from('configuracion_tenant')
    .select('ventana_dias_reincidencia, ventana_dias_escalada, ventana_dias_riesgo')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  const diasReincidencia = config?.ventana_dias_reincidencia ?? 45
  const diasEscalada = config?.ventana_dias_escalada ?? 15
  const diasVentanaGravedad = config?.ventana_dias_riesgo ?? 30

  const hoy = new Date()
  const haceReincidencia = new Date(hoy.getTime() - diasReincidencia * 24 * 60 * 60 * 1000)
  const hace30Dias = new Date(hoy.getTime() - diasVentanaGravedad * 24 * 60 * 60 * 1000)

  const fecha45Str = haceReincidencia.toISOString().split('T')[0]
  const fecha30Str = hace30Dias.toISOString().split('T')[0]

  // 3. Consulta única optimizada: recuperar incidentes del estudiante en la ventana máxima
  const { data: rows, error: errorInc } = await supabase
    .from('incidente_estudiantes')
    .select(`

      incidente_id,
      es_victima,
      observacion,
      incidentes!inner (
        id,
        fecha,
        gravedad,
        tipo_abordaje_id,
        tenant_id,
        tipos_abordaje ( id, nombre )
      )
    `)
    .eq('estudiante_id', estudianteId)
    .eq('incidentes.tenant_id', tenantId)
    .gte('incidentes.fecha', fecha45Str)
    .order('incidentes(fecha)', { ascending: true })

  if (errorInc) {
    logger.error('Error al consultar antecedentes de escalada', {
      tenantId,
      estudianteId,
      error: errorInc.message,
    })
    const err = new Error(`Error al consultar antecedentes: ${errorInc.message}`)
    err.statusCode = 500
    throw err
  }

  // Aplanar estructura de incidentes
  const incidentes45d = (rows || []).map(r => ({
    id: r.incidentes.id,
    fecha: r.incidentes.fecha,
    gravedad: r.incidentes.gravedad,
    tipo_abordaje_id: r.incidentes.tipo_abordaje_id,
    tipo_abordaje_nombre: r.incidentes.tipos_abordaje?.nombre || 'Sin ámbito definido',
    es_victima: r.es_victima,
  }))

  // 4. REGLA 1: Reincidencia de Ámbito (últimos 45 días)
  // Agrupar por tipo_abordaje_id
  const conteoAmbitos = new Map()
  for (const inc of incidentes45d) {
    if (!inc.tipo_abordaje_id) continue
    const actual = conteoAmbitos.get(inc.tipo_abordaje_id) || {
      tipo_abordaje_id: inc.tipo_abordaje_id,
      nombre: inc.tipo_abordaje_nombre,
      cantidad: 0,
    }
    actual.cantidad += 1
    conteoAmbitos.set(inc.tipo_abordaje_id, actual)
  }

  const ambitosReincidentes = Array.from(conteoAmbitos.values()).filter(a => a.cantidad >= 2)
  const reincidenciaAmbito = ambitosReincidentes.length > 0

  // 5. REGLA 2: Escalada de Gravedad (últimos 30 días)
  // Filtrar incidentes de los últimos 30 días y ordenar cronológicamente
  const incidentes30d = incidentes45d
    .filter(inc => inc.fecha >= fecha30Str)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))

  const patronEscalada = []
  for (let i = 0; i < incidentes30d.length; i++) {
    if (incidentes30d[i].gravedad === 'Leve') {
      for (let j = i + 1; j < incidentes30d.length; j++) {
        const gravedadPosterior = incidentes30d[j].gravedad
        if (gravedadPosterior === 'Grave' || gravedadPosterior === 'Gravísima') {
          const diasDiferencia = calcularDiasDiferencia(incidentes30d[i].fecha, incidentes30d[j].fecha)
          if (diasDiferencia >= 0 && diasDiferencia <= diasEscalada) {
            patronEscalada.push({

              fecha_anterior: incidentes30d[i].fecha,
              gravedad_anterior: incidentes30d[i].gravedad,
              fecha_posterior: incidentes30d[j].fecha,
              gravedad_posterior: gravedadPosterior,
              dias_diferencia: diasDiferencia,
            })
          }
        }
      }
    }
  }

  const escaladaGravedad = patronEscalada.length > 0

  // 6. Diagnóstico y Clasificación de Riesgo
  const tieneAlerta = reincidenciaAmbito || escaladaGravedad
  let nivel = null
  if (escaladaGravedad) {
    nivel = 'critico'
  } else if (reincidenciaAmbito) {
    nivel = 'advertencia'
  }

  // 7. Redacción de motivos formativos no estigmatizantes
  const motivos = []
  if (reincidenciaAmbito) {
    for (const amb of ambitosReincidentes) {
      motivos.push(
        `Reincidencia detectada: ${amb.cantidad} faltas registradas en el ámbito "${amb.nombre}" durante los últimos 45 días.`
      )
    }
  }

  if (escaladaGravedad) {
    for (const esc of patronEscalada) {
      motivos.push(
        `Escalada rápida de gravedad: Falta ${esc.gravedad_anterior} seguida de una falta ${esc.gravedad_posterior} en un lapso de ${esc.dias_diferencia} día(s).`
      )
    }
  }

  // 8. Sugerencia formativa institucional
  let sugerenciaAccion = 'Comportamiento dentro de los parámetros esperados; sin alertas activas.'
  if (nivel === 'critico') {
    sugerenciaAccion =
      'Se recomienda convocar al Comité de Buena Convivencia Escolar para evaluación de intervención psicosocial y considerar activación de protocolo RICE según el RIE.'
  } else if (nivel === 'advertencia') {
    sugerenciaAccion =
      'Se sugiere citar a entrevista formativa con apoderado y acordar compromisos de conducta preventivos.'
  }

  return {
    estudiante_id: estudianteId,
    estudiante_nombre: `${estudiante.nombre} ${estudiante.apellido}`,
    tiene_alerta: tieneAlerta,
    nivel,
    motivos,
    reincidencia_ambito: reincidenciaAmbito,
    escalada_gravedad: escaladaGravedad,
    total_incidentes_recientes: incidentes45d.length,
    sugerencia_accion: sugerenciaAccion,
    detalles: {
      ambitos_reincidentes: ambitosReincidentes,
      patron_escalada: patronEscalada,
    },
  }
}

module.exports = {
  getAntecedentesEscalada,
  calcularDiasDiferencia,
}
