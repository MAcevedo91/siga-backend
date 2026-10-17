const { GoogleGenAI } = require('@google/genai')
const { supabase } = require('../utils/db')
const logger = require('../utils/logger')
const { registrarAuditoria } = require('./auditoriaService')
const {
  convertirBufferAMarkdown,
  segmentarMarkdownEnChunks,
} = require('./riceConverterService')

/**
 * Genera un vector simulado determinista de 768 dimensiones para entornos de prueba
 * o cuando no se dispone de una clave API configurada.
 */
const generarVectorSimulado = (texto = '') => {
  const vector = new Array(768).fill(0)
  for (let i = 0; i < texto.length; i++) {
    const code = texto.charCodeAt(i)
    vector[i % 768] = (vector[i % 768] + code / 255.0) % 1.0
  }
  return vector
}

/**
 * Genera un embedding vectorial de 768 dimensiones utilizando Google Gemini text-embedding-004.
 * 
 * @param {string} texto Texto a vectorizar
 * @returns {Promise<Array<number>>} Vector de 768 dimensiones
 */
const generarEmbeddingTexto = async (texto = '') => {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'your-gemini-api-key' || process.env.NODE_ENV === 'test') {
    return generarVectorSimulado(texto)
  }

  try {
    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: texto,
    })

    if (response?.embedding?.values) {
      return response.embedding.values
    }

    logger.warn('Formato inesperado en respuesta de embedContent, aplicando vector simulado')
    return generarVectorSimulado(texto)
  } catch (err) {
    logger.error('Error al generar embedding con Gemini text-embedding-004:', err.message)
    return generarVectorSimulado(texto)
  }
}

/**
 * Procesa un archivo RICE (PDF o Markdown), lo convierte a Markdown estructurado,
 * genera sus fragmentos y embeddings, y los almacena en Supabase con aislamiento por tenant.
 * 
 * @param {Object} params { tenantId, usuarioId, archivoBuffer, nombreArchivo, formato, anioVigencia }
 * @returns {Promise<Object>} Resumen del documento RICE activado
 */
const procesarYGuardarRice = async ({
  tenantId,
  usuarioId,
  archivoBuffer,
  nombreArchivo,
  formato = 'pdf',
  anioVigencia = new Date().getFullYear(),
}) => {
  if (!tenantId) throw new Error('El tenant_id es requerido')
  if (!archivoBuffer) throw new Error('El buffer del archivo es requerido')

  const anio = parseInt(anioVigencia, 10) || new Date().getFullYear()

  logger.info(`Iniciando procesamiento RICE para tenant ${tenantId}: ${nombreArchivo} (${formato})`)

  // 1. Conversión y limpieza a Markdown
  const markdownLimpio = await convertirBufferAMarkdown(archivoBuffer, formato)
  if (!markdownLimpio || markdownLimpio.trim().length < 50) {
    throw new Error('El documento no contiene texto legible o es demasiado corto')
  }

  // 2. Segmentación semántica en Chunks
  const chunks = segmentarMarkdownEnChunks(markdownLimpio)
  if (!chunks || chunks.length === 0) {
    throw new Error('No se pudieron extraer secciones o artículos válidos del documento')
  }

  // 3. Crear registro inicial en rice_documentos
  const { data: docCreado, error: errDoc } = await supabase
    .from('rice_documentos')
    .insert({
      tenant_id: tenantId,
      nombre_archivo: nombreArchivo,
      formato,
      anio_vigencia: anio,
      estado: 'procesando',
      total_chunks: chunks.length,
      subido_por: usuarioId,
      metadata: {
        tamano_bytes: archivoBuffer.length,
        total_caracteres_md: markdownLimpio.length,
      },
    })
    .select('*')
    .single()

  if (errDoc) {
    logger.error('Error al insertar registro en rice_documentos:', errDoc)
    throw new Error(`Error en base de datos al registrar documento: ${errDoc.message}`)
  }

  try {
    // 4. Generación de Embeddings en lotes pequeños (batch de 5 para no saturar)
    const chunksConEmbeddings = []
    const BATCH_SIZE = 5

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const lote = chunks.slice(i, i + BATCH_SIZE)
      const promesas = lote.map(async (c) => {
        const vector = await generarEmbeddingTexto(`${c.seccion} - ${c.articulo}: ${c.contenido}`)
        return {
          tenant_id: tenantId,
          documento_id: docCreado.id,
          numero_chunk: c.numero_chunk,
          seccion: (c.seccion || 'Disposiciones Generales').trim(),
          articulo: (c.articulo || 'General').trim(),
          contenido: c.contenido,
          embedding: vector,
        }
      })
      const resultadosLote = await Promise.all(promesas)
      chunksConEmbeddings.push(...resultadosLote)
    }

    // 5. Inserción masiva de Chunks en rice_chunks
    const { error: errChunks } = await supabase
      .from('rice_chunks')
      .insert(chunksConEmbeddings)

    if (errChunks) {
      throw new Error(`Error al persistir fragmentos vectoriales: ${errChunks.message}`)
    }

    // 6. Marcar documentos anteriores del mismo tenant como obsoletos
    await supabase
      .from('rice_documentos')
      .update({ estado: 'obsoleto' })
      .eq('tenant_id', tenantId)
      .neq('id', docCreado.id)
      .eq('estado', 'activo')

    // 7. Activar el nuevo documento
    const { data: docActivo, error: errActivar } = await supabase
      .from('rice_documentos')
      .update({
        estado: 'activo',
        total_chunks: chunksConEmbeddings.length,
      })
      .eq('id', docCreado.id)
      .select('*')
      .single()

    if (errActivar) throw errActivar

    // 8. Registro de Auditoría
    try {
      await registrarAuditoria({
        tenant_id: tenantId,
        usuario_id: usuarioId,
        accion: 'SUBIR_RICE',
        tabla_afectada: 'rice_documentos',
        registro_id: docCreado.id,
        detalles: {
          nombre_archivo: nombreArchivo,
          anio_vigencia: anio,
          total_chunks: chunks.length,
        },
      })
    } catch (auditErr) {
      logger.warn('Error no bloqueante al registrar auditoría de carga RICE:', auditErr.message)
    }

    logger.info(`✓ RICE procesado y activado exitosamente: ${docCreado.id} (${chunks.length} chunks)`)

    return {
      documento: docActivo,
      resumen: {
        nombreArchivo,
        totalChunks: chunks.length,
        primerosArticulos: chunks.slice(0, 5).map((c) => ({
          articulo: c.articulo,
          seccion: c.seccion,
        })),
      },
    }
  } catch (error) {
    // Si algo falla, marcar documento como error
    await supabase
      .from('rice_documentos')
      .update({ estado: 'error' })
      .eq('id', docCreado.id)

    logger.error('Fallo en el pipeline de ingesta RICE:', error)
    throw error
  }
}

/**
 * Obtiene el documento RICE activo de un tenant.
 */
const obtenerRiceActivo = async (tenantId) => {
  if (!tenantId) return null

  const { data, error } = await supabase
    .from('rice_documentos')
    .select('id, nombre_archivo, formato, anio_vigencia, version, estado, total_chunks, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .eq('estado', 'activo')
    .order('created_at', { ascending: false })
    .maybeSingle()

  if (error) {
    logger.error('Error al consultar RICE activo:', error)
    throw new Error('Error al consultar RICE del establecimiento')
  }

  return data
}

module.exports = {
  generarEmbeddingTexto,
  procesarYGuardarRice,
  obtenerRiceActivo,
}
