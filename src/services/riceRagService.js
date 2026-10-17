const { GoogleGenAI } = require('@google/genai')
const { supabase } = require('../utils/db')
const logger = require('../utils/logger')
const { censurarPatronesPII } = require('./dlpSanitizer')
const { generarEmbeddingTexto } = require('./riceIngestaService')
const { registrarAuditoria } = require('./auditoriaService')

const SYSTEM_INSTRUCTION_RAG = `Eres el Asesor Normativo y Especialista en Convivencia Escolar de SIGA Escolar (Chile).
Tu propósito es orientar a docentes, directivos e inspectores sobre la aplicación del Reglamento Interno y de Convivencia Escolar (RICE) y la Circular N° 482 de la Superintendencia de Educación.

REGLAS DE ORO OBLIGATORIAS:
1. FUENTE ESTRICTA: Basa tus respuestas EXCLUSIVAMENTE en los fragmentos del RICE provistos dentro de la etiqueta <contexto_normativo_rice>. Queda estrictamente prohibido inventar o extrapolar sanciones, plazos o procedimientos no descritos.
2. CITAS OBLIGATORIAS: Cita siempre de forma explícita el Artículo y Título/Capítulo correspondiente a cada recomendación o procedimiento.
3. DEBIDO PROCESO Y PLAZOS: Si la consulta involucra una falta, destaca con precisión los plazos de citación a apoderados, el derecho del estudiante a ser escuchado (descargos), y la gradualidad de medidas formativas antes de cualquier sanción disciplinaria.
4. CASOS CRÍTICOS (DELITOS): Si la situación describe hechos constitutivos de delito (abuso, armas, drogas, agresiones graves), recuerda la obligación legal de denuncia al Ministerio Público, Carabineros o PDI dentro de las 24 horas siguientes (Art. 175 letra e del Código Procesal Penal).
5. LIMITACIÓN FACTUAL: Si el contexto provisto no contiene información suficiente para responder a la consulta, indícalo con total transparencia y recomienda revisar el documento oficial completo con el Encargado de Convivencia Escolar.
6. TONO: Institucional, pedagógico, restaurativo, claro y profesional.`

/**
 * Genera una respuesta estructurada de contingencia (fallback) basada en los chunks recuperados
 * cuando la API de Gemini no está disponible o no hay API Key configurada.
 */
const generarRespuestaFallback = (pregunta, chunks = []) => {
  if (!chunks || chunks.length === 0) {
    return 'No se encontraron artículos o procedimientos específicos en el RICE del establecimiento vinculados a su consulta. Se recomienda consultar directamente con el Encargado/a de Convivencia Escolar o la Dirección del establecimiento.'
  }

  const resumenArticulos = chunks
    .map((c) => `• **${c.articulo || 'Artículo'}** (${c.seccion || 'Normativa'}):\n  "${c.contenido.slice(0, 300)}..."`)
    .join('\n\n')

  return `Orientación preliminar basada en los fragmentos vigentes del RICE del establecimiento:\n\n${resumenArticulos}\n\n*Nota: Para detalles adicionales de plazos y debidos procesos, verifique los artículos citados en el documento institucional oficial.*`
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
      p_match_count: 4,
      p_similarity_threshold: 0.35,
    })

    if (error) {
      logger.warn('Error al invocar RPC buscar_contexto_rice en Supabase:', error.message)
      // Si la RPC no está instalada aún, intentar consulta directa a rice_chunks
      const { data: chunksDirectos } = await supabase
        .from('rice_chunks')
        .select('id, documento_id, seccion, articulo, contenido')
        .eq('tenant_id', tenantId)
        .limit(4)
      chunksRecuperados = (chunksDirectos || []).map((c) => ({ ...c, similitud: 0.8 }))
    } else {
      chunksRecuperados = data || []
    }
  } catch (dbErr) {
    logger.error('Error de base de datos en recuperación de contexto RICE:', dbErr)
  }

  // 4. Inferencia con Google Gemini Flash
  const apiKey = process.env.GEMINI_API_KEY
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
  let respuestaFinal = ''

  if (!apiKey || apiKey === 'your-gemini-api-key' || process.env.NODE_ENV === 'test') {
    respuestaFinal = generarRespuestaFallback(consultaLimpia, chunksRecuperados)
  } else {
    try {
      const ai = new GoogleGenAI({ apiKey })

      const contextoXml = chunksRecuperados.length > 0
        ? chunksRecuperados
            .map((c, idx) => `<fragmento id="${idx + 1}" articulo="${c.articulo || ''}" seccion="${c.seccion || ''}">\n${c.contenido}\n</fragmento>`)
            .join('\n\n')
        : 'No se encontraron fragmentos específicos en el RICE del colegio para esta consulta.'

      const userPrompt = `
<contexto_normativo_rice>
${contextoXml}
</contexto_normativo_rice>

CONSULTA DEL FUNCIONARIO:
"${consultaLimpia}"

Por favor entrega tu orientación conforme a las reglas del sistema, citando los artículos aplicables.
`

      const candidateModels = [modelName, 'gemini-2.0-flash', 'gemini-1.5-flash']
      let errorGeneracion = null

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
            respuestaFinal = resp.text
            errorGeneracion = null
            break
          }
        } catch (mErr) {
          errorGeneracion = mErr
          logger.warn(`Modelo ${m} falló en consulta RICE (${mErr.message}). Probando alternativo...`)
        }
      }

      if (!respuestaFinal) {
        logger.error('No se pudo generar respuesta con Gemini Flash, recurriendo a fallback', errorGeneracion)
        respuestaFinal = generarRespuestaFallback(consultaLimpia, chunksRecuperados)
      }
    } catch (llmErr) {
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
    })),
    totalFuentes: chunksRecuperados.length,
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
    const ai = new GoogleGenAI({ apiKey })
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
      'gemini-3-flash-preview',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
    ].filter(Boolean)

    let textoRespuesta = ''

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
          textoRespuesta = resp.text
          break
        }
      } catch (err) {
        logger.warn(`Modelo ${m} falló en orientacion clima aula (${err.message}). Probando siguiente...`)
      }
    }

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
