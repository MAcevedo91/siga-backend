/**
 * Servicio de Sanitización DLP (Data Loss Prevention) y Anonimización Escolar
 * Cumplimiento: Ley N° 19.628 de Protección de la Vida Privada y Circular N° 482
 * 
 * Garantiza que CERO datos personales identificables (PII) de menores de edad
 * sean transmitidos a la API externa de Google Gemini Flash.
 */

// =============================================================================
// PATRONES REGEX DE DATOS SENSIBLES EN CHILE
// =============================================================================

// RUT chileno con o sin puntos (ej: 12.345.678-9, 12345678-k, 9.876.543-K)
const REGEX_RUT = /\b(\d{1,2}(?:\.?\d{3}){2}-[\dkK]|\d{7,8}-[\dkK])\b/gi

// Correos electrónicos
const REGEX_EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g

// Teléfonos chilenos (+56 9 XXXX XXXX, +569XXXXXXXX, 9XXXXXXXX)
const REGEX_TELEFONO = /(?:\+?56\s?9|\b9)\s?\d{4}\s?\d{4}\b/g

/**
 * Remueve patrones generales de PII (RUTs, correos, teléfonos) de cualquier texto libre.
 */
const censurarPatronesPII = (texto = '') => {
  if (!texto || typeof texto !== 'string') return ''
  return texto
    .replace(REGEX_RUT, '[RUT_RESERVADO]')
    .replace(REGEX_EMAIL, '[EMAIL_RESERVADO]')
    .replace(REGEX_TELEFONO, '[TEL_RESERVADO]')
}

/**
 * Escapa caracteres especiales de regex para búsquedas literales seguras.
 */
const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Sanitiza el contexto completo de un incidente antes de enviarlo al LLM.
 * 
 * @param {Object} incidente Datos completos del incidente (relato, medidas, fecha, etc.)
 * @param {string} estudianteFocoId UUID del estudiante para el cual se genera este reporte
 * @returns {Object} { promptSanitizado, mapaRestauracion, estudianteFoco }
 */
const sanitizarContextoIncidente = (incidente, estudianteFocoId) => {
  if (!incidente) throw new Error('El objeto incidente es requerido para sanitización')

  // Extraer lista de estudiantes involucrados normalizada
  const rawEstudiantes = incidente.estudiantes || incidente.incidente_estudiantes || []
  const involucrados = rawEstudiantes.map((item) => {
    // Si viene anidado desde Supabase
    const est = item.estudiantes || item
    const cursoNombre = est.cursos?.nombre || item.curso || 'Curso no especificado'
    const rol = item.es_victima ? 'Víctima' : 'Involucrado / Agresor'

    return {
      id: est.id || item.estudiante_id,
      nombre: (est.nombre || '').trim(),
      apellido: (est.apellido || '').trim(),
      nombreCompleto: `${(est.nombre || '').trim()} ${(est.apellido || '').trim()}`.trim(),
      curso: cursoNombre,
      rol,
      observacion: item.observacion || '',
    }
  })

  // Identificar estudiante foco
  const estudianteFoco = involucrados.find((e) => e.id === estudianteFocoId)
  if (!estudianteFoco) {
    const error = new Error(`El estudiante ${estudianteFocoId} no figura como involucrado en este incidente`)
    error.status = 400
    throw error
  }

  // Construir mapa de tokens y reemplazos ordenados por longitud descendente
  const mapaTokens = []
  const mapaRestauracion = {
    nombreFoco: estudianteFoco.nombreCompleto,
    primerNombreFoco: estudianteFoco.nombre,
    reemplazosInvolucrados: {},
  }

  // Token para el estudiante foco
  mapaTokens.push({
    token: '[ESTUDIANTE_FOCO]',
    nombreCompleto: estudianteFoco.nombreCompleto,
    nombre: estudianteFoco.nombre,
    apellido: estudianteFoco.apellido,
    etiquetaRol: `[ESTUDIANTE_FOCO - Rol: ${estudianteFoco.rol}, Curso: ${estudianteFoco.curso}]`,
  })

  // Tokens para las demás partes involucradas (resguardo de confidencialidad)
  let contraparteCount = 1
  involucrados.forEach((inv) => {
    if (inv.id !== estudianteFocoId) {
      contraparteCount++
      const tokenClean = `INVOLUCRADO_${contraparteCount}`
      const token = `[${tokenClean}]`
      mapaTokens.push({
        token,
        nombreCompleto: inv.nombreCompleto,
        nombre: inv.nombre,
        apellido: inv.apellido,
        etiquetaRol: `[${tokenClean} - Rol: ${inv.rol}, Curso: ${inv.curso}]`,
      })
      // Para el informe del apoderado foco, los otros menores se identifican de manera neutra
      mapaRestauracion.reemplazosInvolucrados[token] = 'otro estudiante involucrado'
    }
  })

  // Sanitizar el relato y medidas sustituyendo nombres de estudiantes por tokens
  let relatoSanitizado = censurarPatronesPII(incidente.relato || '')
  let medidasSanitizadas = censurarPatronesPII(incidente.medidas || '')

  // Reemplazar nombres completos, nombres de pila y apellidos (incluso compuestos)
  const reemplazosTexto = []
  const palabrasComunes = new Set(['de', 'del', 'la', 'las', 'los', 'san', 'el'])
  const agregarBusqueda = (texto, token) => {
    if (!texto || typeof texto !== 'string') return
    const trimmed = texto.trim()
    if (trimmed.length > 2 && !palabrasComunes.has(trimmed.toLowerCase())) {
      reemplazosTexto.push({ busqueda: trimmed, token })
    }
  }

  mapaTokens.forEach((item) => {
    agregarBusqueda(item.nombreCompleto, item.token)
    agregarBusqueda(item.apellido, item.token)
    agregarBusqueda(item.nombre, item.token)

    const primerNombre = (item.nombre || '').split(/\s+/)[0]
    const primerApellido = (item.apellido || '').split(/\s+/)[0]

    if (primerNombre) agregarBusqueda(primerNombre, item.token)
    if (primerApellido) agregarBusqueda(primerApellido, item.token)
    if (primerNombre && primerApellido) agregarBusqueda(`${primerNombre} ${primerApellido}`, item.token)
  })

  // Ordenar de mayor a menor longitud para no reemplazar nombres parciales antes de nombres completos
  reemplazosTexto.sort((a, b) => b.busqueda.length - a.busqueda.length)

  reemplazosTexto.forEach(({ busqueda, token }) => {
    const regExp = new RegExp(`\\b${escapeRegExp(busqueda)}\\b`, 'gi')
    relatoSanitizado = relatoSanitizado.replace(regExp, token)
    medidasSanitizadas = medidasSanitizadas.replace(regExp, token)
  })

  // Armar nómina neutra de participantes para el prompt
  const participantesAnonimizados = mapaTokens.map((t) => `- ${t.etiquetaRol}`).join('\n')

  const promptSanitizado = {
    fechaIncidente: incidente.fecha || new Date().toISOString().split('T')[0],
    gravedad: incidente.gravedad || 'Leve',
    tipoAbordaje: incidente.tipo_abordaje || incidente.tipos_abordaje?.nombre || 'General',
    participantesAnonimizados,
    relatoSanitizado,
    medidasSanitizadas: medidasSanitizadas || 'No se registraron medidas inmediatas adicionales.',
  }

  return {
    promptSanitizado,
    mapaRestauracion,
    estudianteFoco,
  }
}

/**
 * Reconstituye el reporte devuelto por el LLM reemplazando los tokens sintácticos
 * por el nombre legítimo del estudiante foco y preservando la reserva de las contrapartes.
 * 
 * @param {Object} jsonReporte Objeto JSON con las 5 secciones
 * @param {Object} mapaRestauracion Mapa de sustitución generado en la sanitización
 * @returns {Object} Reporte desanonimizado listo para revisión
 */
const desanonimizarReporte = (jsonReporte, mapaRestauracion) => {
  if (!jsonReporte || typeof jsonReporte !== 'object') return jsonReporte

  const resultado = { ...jsonReporte }
  const { nombreFoco, reemplazosInvolucrados = {} } = mapaRestauracion

  const camposTexto = [
    'contexto',
    'hechos_objetivos',
    'medidas_adoptadas',
    'acuerdos_compromisos',
    'plan_seguimiento',
  ]

  camposTexto.forEach((campo) => {
    let texto = resultado[campo]
    if (typeof texto === 'string') {
      // 1. Reemplazar token del estudiante foco por su nombre institucional real
      texto = texto.replace(/\[ESTUDIANTE_FOCO\]/gi, nombreFoco)

      // 2. Reemplazar tokens de contrapartes por referencias neutras confidenciales
      Object.entries(reemplazosInvolucrados).forEach(([token, sustituto]) => {
        const tokenEscapado = escapeRegExp(token)
        const regexToken = new RegExp(tokenEscapado, 'gi')
        texto = texto.replace(regexToken, sustituto)
      })

      // 3. Limpieza de tokens residuales de seguridad
      texto = texto.replace(/\[INVOLUCRADO_\d+\]/gi, 'otro estudiante')

      resultado[campo] = texto.trim()
    }
  })

  return resultado
}

module.exports = {
  REGEX_RUT,
  REGEX_EMAIL,
  REGEX_TELEFONO,
  censurarPatronesPII,
  sanitizarContextoIncidente,
  desanonimizarReporte,
}
