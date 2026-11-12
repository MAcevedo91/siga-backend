const { GoogleGenAI } = require('@google/genai')
const { supabase } = require('../utils/db')
const logger = require('../utils/logger')
const { censurarPatronesPII } = require('./dlpSanitizer')
const { generarEmbeddingTexto } = require('./riceIngestaService')
const { registrarAuditoria } = require('./auditoriaService')

const SYSTEM_INSTRUCTION_RAG = `Eres el Asesor Normativo y Especialista en Convivencia Escolar de SIGA Escolar (Chile).
Tu propósito es orientar a docentes, directivos e inspectores sobre la aplicación del Reglamento Interno y de Convivencia Escolar (RICE) y la Circular N° 482 de la Superintendencia de Educación.

REGLAS DE ORO OBLIGATORIAS:
1. FUENTE ESTRICTA Y JERARQUÍA NORMATIVA: Basa tus respuestas en los fragmentos provistos dentro de la etiqueta <contexto_normativo_rice>.
   - Prioridad Local: Si el RICE del establecimiento cuenta con un artículo o procedimiento para la materia consultada, aplícalo con prioridad.
   - Subsidiariedad de la Circular N° 482 (Superintendencia de Educación): Si el RICE del establecimiento carece de un protocolo específico, guarda silencio o presenta una laguna sobre la situación consultada (por ejemplo: ciberacoso escolar, ideación suicida, violencia digital, etc.), rige de forma supletoria y obligatoria el protocolo de la Circular N° 482 de la Superintendencia provisto en el contexto. En este caso:
     * Entrega el procedimiento detallado paso a paso conforme a la Circular N° 482 (medidas de contención inmediata, notificación a apoderados en un plazo máximo de 24 horas, debido proceso y denuncia penal en 24 horas si reviste carácter de delito según Art. 175 letra e del CPP).
     * Finaliza SIEMPRE indicando con total claridad que, al no contar el RICE del establecimiento con dicho protocolo específico, se aplicó la Circular N° 482 de manera subsidiaria, e incluye una recomendación explícita para que el Encargado/a de Convivencia Escolar y la Dirección actualicen el RICE del colegio incorporando el protocolo obligatorio.
2. CITAS OBLIGATORIAS: Cita siempre de forma explícita el Artículo y Título/Capítulo correspondiente a cada recomendación o procedimiento, identificando si la fuente es el RICE del establecimiento o la Circular N° 482.
3. DEBIDO PROCESO Y PLAZOS: Si la consulta involucra una falta o incidente, destaca con precisión los plazos de citación a apoderados (máximo 24 horas), el derecho del estudiante a ser escuchado (descargos), y la gradualidad de medidas formativas antes de cualquier sanción disciplinaria.
4. CASOS CRÍTICOS (DELITOS): Si la situación describe hechos constitutivos de delito (abuso sexual, porte de armas, drogas, agresiones graves), recuerda la obligación legal de denuncia al Ministerio Público, Carabineros o PDI dentro de las 24 horas siguientes (Art. 175 letra e del Código Procesal Penal).
5. LIMITACIÓN FACTUAL: Si ni el RICE local ni la Circular N° 482 contienen información suficiente para responder a la consulta, indícalo con total transparencia y recomienda consultar directamente con el Encargado de Convivencia Escolar o la Superintendencia de Educación.
6. TONO: Institucional, pedagógico, restaurativo, claro y profesional.`

/**
 * Detecta si un fragmento corresponde a páginas de índice, tabla de contenidos
 * o presentación genérica sin articulado sustantivo.
 */
const esChunkDeIndice = (chunk) => {
  if (!chunk || !chunk.contenido) return false
  const contenido = chunk.contenido
  // Detecta patrones típicos de índices (ej. "........ 130", "..... 52" o múltiples series de 3 o más puntos)
  const tienePuntosIndice = /\.{4,}\s*\d+/g.test(contenido) || (contenido.match(/\.{3,}/g) || []).length >= 3
  const tienePalabraIndice = /índice|indice|tabla de contenidos/i.test(contenido)
  const esArticuloGeneral = chunk.articulo === 'General' || !chunk.articulo
  return Boolean((tienePuntosIndice && esArticuloGeneral) || (tienePalabraIndice && tienePuntosIndice))
}

/**
 * Limpia y normaliza el texto de un fragmento normativo para evitar cortes abruptos
 * o caracteres huérfanos sin alterar el contenido legal original.
 */
const limpiarContenidoFragmento = (texto = '') => {
  if (!texto) return ''
  let limpio = texto
    .replace(/^(\.\.\.|\.\s*)+/g, '') // Quitar puntos suspensivos iniciales huérfanos
    .replace(/(\.\.\.|\.\s*)+$/g, '.') // Normalizar final
    .replace(/\n{3,}/g, '\n\n') // Reducir saltos excesivos
    .trim()

  // Si supera 900 caracteres, recortar respetando el final de una oración completa
  if (limpio.length > 900) {
    const corte = limpio.slice(0, 900)
    const ultimoPunto = corte.lastIndexOf('.')
    if (ultimoPunto > 400) {
      limpio = corte.slice(0, ultimoPunto + 1)
    } else {
      limpio = corte + '...'
    }
  }
  return limpio
}

/**
 * Genera una respuesta estructurada de contingencia (fallback) basada en los chunks recuperados
 * cuando la API de Gemini no está disponible o no hay API Key configurada.
 */
const generarRespuestaFallback = (pregunta, chunks = []) => {
  const chunksValidos = (chunks || []).filter((c) => !esChunkDeIndice(c))
  const chunksAProcesar = chunksValidos.length > 0 ? chunksValidos : chunks

  if (!chunksAProcesar || chunksAProcesar.length === 0) {
    return 'Estimado/a funcionario/a: Tras consultar el contexto normativo disponible, le informo que **No se encontraron artículos o procedimientos específicos** en el RICE del establecimiento ni en la Circular N° 482 de la Superintendencia de Educación vinculados a su consulta.\n\nLe recomendamos consultar directamente con el **Encargado/a de Convivencia Escolar o con la Dirección del establecimiento**, quienes cuentan con el documento íntegro.'
  }

  const tieneNormativaNacional = chunksAProcesar.some((c) => Boolean(c.es_normativa_nacional || c.tenant_id === null))
  const tieneNormativaLocal = chunksAProcesar.some((c) => !c.es_normativa_nacional && c.tenant_id !== null)

  let encabezado = 'Estimado/a funcionario/a:\n\nA continuación, se detalla el procedimiento y las directrices normativas identificadas en el **Reglamento Interno y de Convivencia Escolar (RICE)** de la Escuela Coeducacional N° 1 El Salvador para orientar su actuación:'

  if (tieneNormativaNacional && !tieneNormativaLocal) {
    encabezado = 'Estimado/a funcionario/a:\n\nDado que en el RICE del establecimiento no se visualiza un protocolo específico para esta materia, **se aplica de forma supletoria y obligatoria la Circular N° 482 de la Superintendencia de Educación**, la cual fija los estándares mínimos de convivencia escolar a nivel nacional:'
  }

  const detalleArticulos = chunksAProcesar
    .map((c, idx) => {
      const esNacional = Boolean(c.es_normativa_nacional || c.tenant_id === null)
      const origen = esNacional ? 'Circular N° 482 — Superintendencia' : 'RICE Establecimiento'
      const tituloArticulo = c.articulo ? c.articulo.trim() : `Artículo ${idx + 1}`
      const seccion = c.seccion ? ` (${c.seccion})` : ''
      const textoLimpio = limpiarContenidoFragmento(c.contenido)

      return `### ${idx + 1}. ${tituloArticulo} [${origen}]${seccion}\n\n${textoLimpio}`
    })
    .join('\n\n---\n\n')

  let recomendacionesGenerales = `\n\n### Consideraciones Clave del Debido Proceso Escolar:
• **Plazos de Notificación:** Citar e informar a los apoderados en un plazo máximo de **24 horas** desde que se toma conocimiento de la situación.
• **Derecho a ser Escuchado:** Realizar entrevistas individuales garantizando el derecho a descargos de los estudiantes, evitando confrontaciones directas entre las partes.
• **Obligación Legal de Denuncia:** Si la situación reviste carácter de presunto delito (agresiones graves, abuso sexual, porte de armas), la Dirección tiene el deber de denunciar ante Carabineros, PDI o Fiscalía dentro de las **24 horas siguientes** (Art. 175 letra e del Código Procesal Penal).`

  if (tieneNormativaNacional && !tieneNormativaLocal) {
    recomendacionesGenerales += `\n\n***\n\n> ⚠️ **Recomendación de Gestión Institucional:** Al haberse aplicado la **Circular N° 482 de manera subsidiaria**, se sugiere expresamente al Encargado/a de Convivencia Escolar y al Equipo Directivo actualizar el RICE del establecimiento incorporando formalmente este protocolo obligatorio para asegurar el debido proceso local.`
  }

  return `${encabezado}\n\n${detalleArticulos}${recomendacionesGenerales}`
}

/**
 * Realiza una consulta RAG al RICE del establecimiento del usuario.
 * 
 * @param {Object} params { tenantId, usuarioId, consulta, contextoIncidente }
 * @returns {Promise<Object>} { respuesta, fuentes, totalFuentes }
 */
const consultarRice = async ({
  tenantId,
  usuarioId,
  consulta = '',
  contextoIncidente = null,
}) => {
  if (!tenantId) throw new Error('El tenant_id es requerido')
  if (!consulta || consulta.trim() === '') throw new Error('La consulta no puede estar vacía')

  // 1. Sanitización estricta DLP de la consulta y del posible incidente adjunto
  const consultaLimpia = censurarPatronesPII(consulta.trim())
  const textoParaEmbedding = contextoIncidente
    ? `${consultaLimpia}\nContexto: ${censurarPatronesPII(JSON.stringify(contextoIncidente))}`
    : consultaLimpia

  logger.info(`Ejecutando consulta RAG RICE para tenant ${tenantId}`)

  // 2. Generar embedding vectorial de la consulta
  const vectorConsulta = await generarEmbeddingTexto(textoParaEmbedding)

  // 3. Buscar contexto mediante RPC en Supabase
  let chunksRecuperados = []
  try {
    const { data, error } = await supabase.rpc('buscar_contexto_rice', {
      p_tenant_id: tenantId,
      p_embedding: vectorConsulta,
      p_match_count: 8,
      p_similarity_threshold: 0.35,
    })

    if (error) {
      logger.warn('Error al invocar RPC buscar_contexto_rice en Supabase:', error.message)
      // Si la RPC no está instalada aún o falla, intentar consulta directa a rice_chunks excluyendo índices
      const { data: chunksDirectos } = await supabase
        .from('rice_chunks')
        .select('id, documento_id, seccion, articulo, contenido, tenant_id')
        .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
        .not('contenido', 'ilike', '%.....%')
        .limit(8)
      chunksRecuperados = (chunksDirectos || []).map((c) => ({
        ...c,
        similitud: 0.8,
        es_normativa_nacional: c.tenant_id === null,
      }))
    } else {
      chunksRecuperados = (data || []).map((c) => ({
        ...c,
        es_normativa_nacional: c.es_normativa_nacional !== undefined ? Boolean(c.es_normativa_nacional) : (c.tenant_id === null),
      }))
    }
  } catch (dbErr) {
    logger.error('Error de base de datos en recuperación de contexto RICE:', dbErr)
  }

  // 3.1 Filtrar fragmentos que correspondan a páginas de índice o tablas de contenidos
  const chunksUtiles = chunksRecuperados.filter((c) => !esChunkDeIndice(c))
  chunksRecuperados = chunksUtiles.slice(0, 4)

  // 3.2 Búsqueda de rescate híbrida (léxica): Si la similitud vectorial no trajo chunks útiles, buscar coincidencias léxicas sustantivas
  if (chunksRecuperados.length === 0) {
    try {
      const palabrasClave = consultaLimpia
        .toLowerCase()
        .replace(/[¿?¡!.,;:()]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 3 && !['cual', 'cuales', 'como', 'pasos', 'debo', 'hacer', 'caso', 'para', 'ante', 'sobre', 'este', 'esta', 'estos'].includes(w))

      if (palabrasClave.length > 0) {
        logger.info(`Búsqueda vectorial sin resultados útiles, ejecutando rescate léxico con términos: ${palabrasClave.join(', ')}`)
        
        // Intentar coincidencias en articulo o contenido excluyendo índices
        for (const termino of palabrasClave) {
          const { data: chunksTermino } = await supabase
            .from('rice_chunks')
            .select('id, documento_id, seccion, articulo, contenido, tenant_id')
            .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
            .or(`articulo.ilike.%${termino}%,contenido.ilike.%${termino}%`)
            .not('contenido', 'ilike', '%.....%')
            .limit(6)

          const chunksValidos = (chunksTermino || []).filter((c) => !esChunkDeIndice(c))

          if (chunksValidos.length > 0) {
            chunksRecuperados = chunksValidos.slice(0, 4).map((c) => ({
              ...c,
              similitud: 0.85,
              es_normativa_nacional: c.tenant_id === null,
            }))
            logger.info(`Rescate léxico exitoso: ${chunksRecuperados.length} fragmentos sustantivos recuperados para "${termino}"`)
            break
          }
        }
      }
    } catch (rescateErr) {
      logger.warn('Error no bloqueante en rescate léxico RICE:', rescateErr.message)
    }
  }

  // 4. Inferencia con Google Gemini Flash
  const apiKey = process.env.GEMINI_API_KEY
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
  let respuestaFinal = ''
  let modoEjecucion = 'ia_gemini'
  let motivoFallback = null

  if (!apiKey || apiKey === 'your-gemini-api-key' || process.env.NODE_ENV === 'test') {
    modoEjecucion = 'fallback'
    motivoFallback = !apiKey || apiKey === 'your-gemini-api-key'
      ? 'GEMINI_API_KEY no detectada en las variables de entorno del servidor (Render)'
      : 'Modo de pruebas automatizadas (NODE_ENV=test)'
    if (!apiKey || apiKey === 'your-gemini-api-key') {
      logger.warn('[RAG] GEMINI_API_KEY no detectada en process.env. Activando fallback determinista estructurado.')
    }
    respuestaFinal = generarRespuestaFallback(consultaLimpia, chunksRecuperados)
  } else {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          timeout: 4500, // Timeout estricto de 4.5 segundos por intento
          retryOptions: { attempts: 1 }, // 1 intento, sin reintentos lentos que causen minutos de espera
        },
      })

      const contextoXml = chunksRecuperados.length > 0
        ? chunksRecuperados
            .map((c, idx) => {
              const fuenteLabel = c.es_normativa_nacional
                ? 'Circular N° 482 Superintendencia de Educación (Normativa Nacional Subsidiaria)'
                : 'RICE Establecimiento'
              return `<fragmento id="${idx + 1}" articulo="${c.articulo || ''}" seccion="${c.seccion || ''}" fuente="${fuenteLabel}">\n${c.contenido}\n</fragmento>`
            })
            .join('\n\n')
        : 'No se encontraron fragmentos específicos en el RICE del colegio ni en la Circular N° 482 para esta consulta.'

      const userPrompt = `
<contexto_normativo_rice>
${contextoXml}
</contexto_normativo_rice>

CONSULTA DEL FUNCIONARIO:
"${consultaLimpia}"

Por favor entrega tu orientación conforme a las reglas del sistema, citando los artículos aplicables.
`

      const candidateModels = [
        modelName,
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-2.0-flash-lite',
        'gemini-3.8-flash',
      ].filter((m, i, arr) => m && arr.indexOf(m) === i)

      const tareaInferencia = (async () => {
        let errUltimo = null
        for (const m of candidateModels) {
          try {
            const resp = await ai.models.generateContent({
              model: m,
              contents: userPrompt,
              config: {
                systemInstruction: SYSTEM_INSTRUCTION_RAG,
                temperature: 0.1, // apego factual estricto
              },
            })
            if (resp?.text) {
              return { texto: resp.text, error: null }
            }
          } catch (mErr) {
            errUltimo = mErr
            logger.warn(`Modelo ${m} no respondió inmediatamente (${mErr.message}). Probando alternativo...`)
          }
        }
        return { texto: null, error: errUltimo }
      })()

      // Guardrail de 5.5 segundos para garantizar que el usuario nunca espere más de ese tiempo
      const guardrailTimeout = new Promise((resolve) => {
        const timer = setTimeout(() => resolve({ timeout: true }), 5500)
        if (timer?.unref) timer.unref()
      })

      const resultadoInferencia = await Promise.race([tareaInferencia, guardrailTimeout])

      if (resultadoInferencia?.timeout) {
        modoEjecucion = 'fallback'
        motivoFallback = 'Tiempo de respuesta LLM excedió guardrail de seguridad (5.5s)'
        logger.warn('[RAG] LLM demoró más de 5.5s. Conmutando a respuesta determinista estructurada inmediata.')
        respuestaFinal = generarRespuestaFallback(consultaLimpia, chunksRecuperados)
      } else if (resultadoInferencia?.texto) {
        respuestaFinal = resultadoInferencia.texto
      } else {
        modoEjecucion = 'fallback'
        motivoFallback = resultadoInferencia?.error
          ? `Modelos Gemini no disponibles: ${resultadoInferencia.error.message}`
          : 'Modelos Gemini no respondieron'
        logger.warn('[RAG] Fallo en modelos Gemini. Activando fallback determinista estructurado.')
        respuestaFinal = generarRespuestaFallback(consultaLimpia, chunksRecuperados)
      }
    } catch (llmErr) {
      modoEjecucion = 'fallback'
      motivoFallback = `Error en cliente LLM: ${llmErr.message}`
      logger.error('Error en pipeline de inferencia LLM RAG:', llmErr)
      respuestaFinal = generarRespuestaFallback(consultaLimpia, chunksRecuperados)
    }
  }

  // 5. Auditoría
  try {
    await registrarAuditoria({
      tenant_id: tenantId,
      usuario_id: usuarioId,
      accion: 'CONSULTA_RICE_RAG',
      tabla_afectada: 'rice_chunks',
      detalles: {
        total_fuentes_encontradas: chunksRecuperados.length,
        consulta_sanitizada: consultaLimpia.slice(0, 150),
        modo_ejecucion: modoEjecucion,
      },
    })
  } catch (auditErr) {
    logger.warn('Error no bloqueante al auditar consulta RICE:', auditErr.message)
  }

  return {
    consulta: consultaLimpia,
    respuesta: respuestaFinal,
    fuentes: chunksRecuperados.map((c) => ({
      seccion: c.seccion,
      articulo: c.articulo,
      contenido: c.contenido,
      similitud: c.similitud ? Math.round(c.similitud * 100) / 100 : undefined,
      es_normativa_nacional: Boolean(c.es_normativa_nacional),
    })),
    totalFuentes: chunksRecuperados.length,
    tiene_normativa_nacional: chunksRecuperados.some((c) => Boolean(c.es_normativa_nacional)),
    modo: modoEjecucion,
    motivo_fallback: motivoFallback,
  }
}

const SYSTEM_INSTRUCTION_CLIMA_AULA = `Eres el Especialista en Convivencia Escolar y Asesor RICE de SIGA Escolar (Chile).
Tu propósito es entregar una orientación pedagógica breve (1 o 2 párrafos concisos, entre 60 y 90 palabras), formativa y con fundamentación normativa para un curso escolar específico durante un mes lectivo determinado, basada estrictamente en los fragmentos del RICE provistos dentro de la etiqueta <contexto_normativo_rice>.

REGLAS DE ORO OBLIGATORIAS:
1. CITAS AL RICE: Cita de forma explícita el Artículo o Capítulo del RICE más relevante para abordar las tipologías observadas (ej: "Conforme al Art. 28 sobre resolución formativa de conflictos...").
2. ENFOQUE RESTAURATIVO: Recomienda acciones formativas concretas y pedagógicas (ej: mediación escolar entre pares, dinámica de aula con el Profesor Jefe, refuerzo de acuerdos de convivencia en Consejo de Curso, monitoreo preventivo de patio en recreos).
3. PRIVACIDAD TOTAL: Los datos son estrictamente agregados por curso. No asumas ni menciones identidades individuales (cumplimiento Ley N° 19.628).
4. TONO: Profesional, constructivo, institucional y claro.`

/**
 * Genera una recomendación pedagógica basada en IA y el RICE para el clima de aula de un curso
 * 
 * @param {Object} params { tenantId, cursoNombre, mesNombre, anio, metricas, tipologias }
 * @returns {Promise<{ recomendacion: string, fuentes: Array<{ articulo, seccion }>, es_ia: boolean }>}
 */
const generarOrientacionClimaAulaRICE = async ({
  tenantId,
  cursoNombre,
  mesNombre,
  anio,
  metricas = {},
  tipologias = [],
}) => {
  const { total = 0, graves = 0, gravisimas = 0, leves = 0 } = metricas

  // 1. Si no hay incidentes, retorno de clima favorable inmediato
  if (total === 0) {
    return {
      recomendacion: `Clima favorable para ${cursoNombre} durante ${mesNombre} ${anio}: Sin incidentes registrados. Se aconseja mantener el reforzamiento positivo y las dinámicas regulares de convivencia.`,
      fuentes: [],
      es_ia: false,
    }
  }

  // 2. Consulta semántica construida a partir de tipologías y severidad
  const nombresTipologias = tipologias.map((t) => t.nombre).filter(Boolean).join(', ')
  const consultaSemantica = `procedimiento formativo y medidas ante ${nombresTipologias || 'conflictos de convivencia escolar'} faltas leves y graves`

  let chunksRecuperados = []
  try {
    const vectorConsulta = await generarEmbeddingTexto(consultaSemantica)
    const { data, error } = await supabase.rpc('buscar_contexto_rice', {
      p_tenant_id: tenantId,
      p_embedding: vectorConsulta,
      p_match_count: 3,
      p_similarity_threshold: 0.35,
    })

    if (error) {
      logger.warn('Error al buscar contexto RICE para clima de aula:', error.message)
      const { data: chunksDirectos } = await supabase
        .from('rice_chunks')
        .select('id, seccion, articulo, contenido')
        .eq('tenant_id', tenantId)
        .limit(3)
      chunksRecuperados = chunksDirectos || []
    } else {
      chunksRecuperados = data || []
    }
  } catch (err) {
    logger.warn('Fallo en recuperación vectorial RICE para clima de aula:', err.message)
  }

  // Fallback determinista resiliente
  const fallbackDeterministic = () => {
    let base = 'Clima Favorable: Mantener reforzamiento positivo y seguimiento regular de convivencia.'
    if (gravisimas >= 1) {
      base = 'Alerta Crítica: Activar de inmediato protocolo RICE normativo, notificar a Inspectoría General y convocar a equipo directivo.'
    } else if (graves >= 2 || total >= 6) {
      base = 'Alerta Alta: Focalizar intervención con Dupla Psicosocial, realizar dinámica de aula y citar a apoderados de alumnos involucrados.'
    } else if (graves === 1 || total >= 2) {
      base = 'Alerta Preventiva: Monitorear clima de aula en Consejo de Profesores y realizar taller de resolución pacífica de conflictos.'
    }
    return {
      recomendacion: base,
      fuentes: chunksRecuperados.map((c) => ({ articulo: c.articulo, seccion: c.seccion })),
      es_ia: false,
    }
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'your-gemini-api-key' || process.env.NODE_ENV === 'test') {
    return fallbackDeterministic()
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        timeout: 4000,
        retryOptions: { attempts: 1 },
      },
    })
    const contextoXml = chunksRecuperados.length > 0
      ? chunksRecuperados.map((c, i) => `<fragmento id="${i + 1}" articulo="${c.articulo || ''}" seccion="${c.seccion || ''}">\n${c.contenido}\n</fragmento>`).join('\n')
      : `<fragmento id="1" articulo="Circular N° 482 Supereduc y Principios RICE" seccion="Gestión Formativa y Restaurativa">
Toda situación de convivencia debe priorizar el diálogo pedagógico, la escucha activa, la mediación formativa entre pares y el fortalecimiento de acuerdos de aula con el Profesor Jefe y Dupla Psicosocial antes de aplicar medidas sancionatorias.
</fragmento>`

    const promptUsuario = `Curso: ${cursoNombre}
Período: ${mesNombre} ${anio}
Métricas acumuladas del aula: ${total} incidentes en total (${leves} leves, ${graves} graves, ${gravisimas} gravísimas).
Tipologías detectadas: ${nombresTipologias || 'Conflictos generales de convivencia'}.

Fragmentos del Reglamento Interno (RICE):
<contexto_normativo_rice>
${contextoXml}
</contexto_normativo_rice>

Entrega la orientación formativa y pedagógica pertinente para el Encargado de Convivencia y el Profesor Jefe fundamentada en el RICE.`

    const candidateModels = [
      process.env.GEMINI_MODEL,
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-2.0-flash-lite',
    ].filter((m, i, arr) => m && arr.indexOf(m) === i)

    const tareaOrientacion = (async () => {
      for (const m of candidateModels) {
        try {
          const resp = await ai.models.generateContent({
            model: m,
            contents: promptUsuario,
            config: {
              systemInstruction: SYSTEM_INSTRUCTION_CLIMA_AULA,
              temperature: 0.2,
            },
          })
          if (resp?.text) {
            return resp.text
          }
        } catch (err) {
          logger.warn(`Modelo ${m} falló en orientacion clima aula (${err.message}). Probando siguiente...`)
        }
      }
      return null
    })()

    const timeoutGuard = new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), 4500)
      if (timer?.unref) timer.unref()
    })
    const textoRespuesta = await Promise.race([tareaOrientacion, timeoutGuard])

    if (!textoRespuesta) {
      return fallbackDeterministic()
    }

    return {
      recomendacion: textoRespuesta.trim(),
      fuentes: chunksRecuperados.length > 0
        ? chunksRecuperados.map((c) => ({
            articulo: c.articulo,
            seccion: c.seccion,
          }))
        : [{ articulo: 'Circular N° 482', seccion: 'Superintendencia de Educación' }],
      es_ia: true,
    }
  } catch (error) {
    logger.error('Error generando orientación clima aula con IA:', error)
    return fallbackDeterministic()
  }
}

module.exports = {
  SYSTEM_INSTRUCTION_RAG,
  SYSTEM_INSTRUCTION_CLIMA_AULA,
  generarRespuestaFallback,
  consultarRice,
  generarOrientacionClimaAulaRICE,
}
