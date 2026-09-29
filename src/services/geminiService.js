const { GoogleGenAI } = require('@google/genai')
const logger = require('../utils/logger')
const {
  sanitizarContextoIncidente,
  desanonimizarReporte,
} = require('./dlpSanitizer')
const { seccionesReporteSchema } = require('./reportesService')

// =============================================================================
// SYSTEM INSTRUCTIONS: DIRECTRICES NORMATIVAS (CIRCULAR N° 482 SUPEREDUC)
// =============================================================================

const SYSTEM_INSTRUCTION_REPORTE = `Eres un especialista senior en Convivencia Escolar y redacción normativa para establecimientos educativos de Chile.
Tu función es generar un borrador formal, empático, estrictamente objetivo e institucional para un reporte de incidente escolar conforme a la Circular N° 482 de la Superintendencia de Educación y los principios del Reglamento Interno de Convivencia Escolar (RICE).

Reglas mandatorias de redacción:
1. TONO Y PERSPECTIVA: Redacta siempre en tercera persona, con tono institucional, objetivo, pedagógico y sereno.
2. ENFOQUE FORMATIVO Y RESTAURATIVO: Queda estrictamente prohibido utilizar adjetivos peyorativos, calificativos condenatorios, términos estigmatizantes o juicios morales sobre los menores de edad.
3. ENFOQUE INDIVIDUALIZADO (INFORMES DIFERENCIADOS): El reporte debe estar enfocado en las actuaciones, acuerdos y medidas correspondientes a [ESTUDIANTE_FOCO]. Las otras partes involucradas deben mantenerse bajo reserva de identidad o mencionarse únicamente como 'otro estudiante involucrado' cuando sea indispensable para la coherencia narrativa.
4. ESTRUCTURA OBLIGATORIA (JSON): Debes retornar exclusivamente un objeto JSON con las siguientes 5 secciones:
   - "contexto": Descripción clara del espacio físico, fecha aproximada y circunstancias ambientales donde ocurrió el suceso.
   - "hechos_objetivos": Relato cronológico y fidedigno basado únicamente en hechos observables, testimonios recibidos y actuaciones constatadas, sin emitir veredictos de culpabilidad prematuros.
   - "medidas_adoptadas": Detalle de las acciones formativas, pedagógicas o de contención inicial tomadas de inmediato por inspectores o docentes.
   - "acuerdos_compromisos": Acuerdos pedagógicos, formativos y de sana convivencia suscritos con el estudiante y su apoderado.
   - "plan_seguimiento": Acciones de acompañamiento posterior por parte del profesor jefe, equipo de convivencia o dupla psicosocial.
5. PRESERVACIÓN DE TOKENS: Utiliza exactamente los tokens proporcionados como [ESTUDIANTE_FOCO] y [INVOLUCRADO_N] sin alterarlos ni agregarles apellidos ficticios.`

// Schema JSON forzado para Google Gemini Flash
const JSON_SCHEMA_REPORTE = {
  type: 'object',
  properties: {
    contexto: {
      type: 'string',
      description: 'Espacio físico, fecha y circunstancias donde ocurrió el hecho.',
    },
    hechos_objetivos: {
      type: 'string',
      description: 'Relato cronológico de hechos observables en tercera persona.',
    },
    medidas_adoptadas: {
      type: 'string',
      description: 'Medidas pedagógicas y de contención inmediata adoptadas.',
    },
    acuerdos_compromisos: {
      type: 'string',
      description: 'Compromisos y acuerdos formativos asumidos con el estudiante.',
    },
    plan_seguimiento: {
      type: 'string',
      description: 'Plan de acompañamiento pedagógico por parte de la escuela.',
    },
  },
  required: [
    'contexto',
    'hechos_objetivos',
    'medidas_adoptadas',
    'acuerdos_compromisos',
    'plan_seguimiento',
  ],
}

/**
 * Genera una plantilla estructurada de contingencia (fallback) cuando la API de Gemini
 * no está disponible, excede cuota o carece de API Key configurada.
 */
const generarPlantillaFallback = (incidente, estudianteFoco, promptSanitizado) => {
  logger.warn('Generando propuesta de reporte mediante plantilla de contingencia (Fallback local)')

  const fechaFormateada = promptSanitizado.fechaIncidente || 'fecha registrada'
  const abordaje = promptSanitizado.tipoAbordaje || 'Abordaje de convivencia'
  const relato = promptSanitizado.relatoSanitizado || 'Sin relato detallado registrado.'
  const medidas = promptSanitizado.medidasSanitizadas || 'Se realiza atención pedagógica inicial en inspectoría.'

  return {
    contexto: `Situación de convivencia escolar abordada bajo la modalidad de ${abordaje} con fecha ${fechaFormateada} en las dependencias del establecimiento educacional.`,
    hechos_objetivos: `En el marco de la jornada escolar, se constata la siguiente situación informada: ${relato}. Se procede a la individualización y atención de las partes para salvaguardar la sana convivencia escolar.`,
    medidas_adoptadas: `${medidas}. Se activa protocolo formativo conforme al Reglamento Interno de Convivencia Escolar (RICE).`,
    acuerdos_compromisos: `Se establece compromiso formal con [ESTUDIANTE_FOCO] para mantener una conducta de respeto mutuo con la comunidad escolar, resolver controversias mediante el diálogo y colaborar con los lineamientos del establecimiento.`,
    plan_seguimiento: `El Profesor/a Jefe y el Equipo de Convivencia Escolar realizarán acompañamiento formativo y observación del estudiante durante las próximas semanas, manteniendo informada a la familia.`,
  }
}

/**
 * Genera la propuesta de informe con Google Gemini Flash aplicando el pipeline DLP.
 * 
 * @param {Object} incidente Objeto con datos del incidente e involucrados
 * @param {string} estudianteFocoId UUID del estudiante objetivo para el reporte
 * @returns {Promise<Object>} Reporte estructurado y desanonimizado en 5 secciones
 */
const generarPropuestaReporteIA = async (incidente, estudianteFocoId) => {
  // 1. Sanitización estricta DLP previa al despacho
  const { promptSanitizado, mapaRestauracion, estudianteFoco } =
    sanitizarContextoIncidente(incidente, estudianteFocoId)

  const apiKey = process.env.GEMINI_API_KEY
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

  let reporteConTokens = null

  // 2. Si no hay API Key configurada, utilizar inmediatamente el fallback local
  if (!apiKey || apiKey.trim() === '' || apiKey === 'your-gemini-api-key') {
    logger.warn('GEMINI_API_KEY no configurada. Utilizando fallback local normativo.')
    reporteConTokens = generarPlantillaFallback(incidente, estudianteFoco, promptSanitizado)
  } else {
    try {
      const ai = new GoogleGenAI({ apiKey })

      const promptContenido = `
Fecha del Incidente: ${promptSanitizado.fechaIncidente}
Nivel de Gravedad: ${promptSanitizado.gravedad}
Tipo de Abordaje: ${promptSanitizado.tipoAbordaje}

Participantes de la situación:
${promptSanitizado.participantesAnonimizados}

Estudiante para quien se emite este informe:
[ESTUDIANTE_FOCO - Rol: ${estudianteFoco.rol}, Curso: ${estudianteFoco.curso}]

Relato de los hechos registrados:
"""${promptSanitizado.relatoSanitizado}"""

Medidas iniciales adoptadas:
"""${promptSanitizado.medidasSanitizadas}"""

Instrucción: Genera el borrador del informe estructurado en formato JSON enfocado en [ESTUDIANTE_FOCO].
`

      const response = await ai.models.generateContent({
        model: modelName,
        contents: promptContenido,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION_REPORTE,
          responseMimeType: 'application/json',
          responseSchema: JSON_SCHEMA_REPORTE,
          temperature: 0.2, // Baja temperatura para apego factual y determinismo
        },
      })

      const textoRespuesta = response.text
      if (!textoRespuesta) {
        throw new Error('Respuesta vacía devuelta por Google Gemini Flash')
      }

      reporteConTokens = JSON.parse(textoRespuesta)
    } catch (apiError) {
      logger.error('Error al invocar Google Gemini Flash API:', apiError.message)
      // Degradación grácil ante fallos de conectividad o cuota de API
      reporteConTokens = generarPlantillaFallback(incidente, estudianteFoco, promptSanitizado)
    }
  }

  // 3. Desanonimización y Reconstitución local
  const reporteDesanonimizado = desanonimizarReporte(reporteConTokens, mapaRestauracion)

  // 4. Validación de contrato Zod antes de la entrega
  const reporteValidado = seccionesReporteSchema.parse(reporteDesanonimizado)

  return {
    estudiante_id: estudianteFocoId,
    estudiante_nombre: estudianteFoco.nombreCompleto,
    estudiante_curso: estudianteFoco.curso,
    secciones: reporteValidado,
    generado_con_ia: true,
  }
}

module.exports = {
  SYSTEM_INSTRUCTION_REPORTE,
  JSON_SCHEMA_REPORTE,
  generarPlantillaFallback,
  generarPropuestaReporteIA,
}
