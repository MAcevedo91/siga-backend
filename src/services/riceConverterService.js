const pdfParse = require('pdf-parse')
const logger = require('../utils/logger')

/**
 * Limpia y normaliza texto crudo extraído de un PDF eliminando ruido típico.
 * 
 * @param {string} rawText Texto sin procesar
 * @returns {string} Texto limpio
 */
const limpiarTextoCrudo = (rawText = '') => {
  if (!rawText || typeof rawText !== 'string') return ''

  return rawText
    // Reemplaza saltos de página especiales y retornos de carro
    .replace(/\f/g, '\n\n')
    .replace(/\r\n/g, '\n')
    // Elimina encabezados y pies de página recurrentes (ej: "Página 12 de 100", "Pág. 12")
    .replace(/(?:p[áa]gina|p[áa]g\.?)\s*\d+(?:\s*(?:de|\/)\s*\d+)?/gi, '')
    // Reemplaza múltiples espacios en una misma línea por un espacio único
    .replace(/[ \t]+/g, ' ')
    // Normaliza secuencias de 3 o más saltos de línea a doble salto
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Convierte texto limpio en Markdown estructurado detectando Títulos, Capítulos y Artículos.
 * 
 * @param {string} text Texto limpio
 * @returns {string} Texto formateado en Markdown
 */
const formatearAMarkdown = (text = '') => {
  const lineas = text.split('\n')
  const lineasMd = []

  // Regex para jerarquías normativas típicas en RICE chileno
  const regexTitulo = /^(?:T[ÍI]TULO|TITULO)\s+([0-9IVXLCDM]+)(?:[\s:.-]+(.*))?$/i
  const regexCapitulo = /^(?:CAP[ÍI]TULO|CAPITULO)\s+([0-9IVXLCDM]+)(?:[\s:.-]+(.*))?$/i
  const regexArticulo = /^(?:ART[ÍI]CULO|ARTICULO|ART\.?)\s+([0-9]+)(?:[\s:.-]+(.*))?$/i

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i].trim()
    if (!linea) {
      lineasMd.push('')
      continue
    }

    if (regexTitulo.test(linea)) {
      lineasMd.push(`\n# ${linea}\n`)
    } else if (regexCapitulo.test(linea)) {
      lineasMd.push(`\n## ${linea}\n`)
    } else if (regexArticulo.test(linea)) {
      lineasMd.push(`\n### ${linea}\n`)
    } else {
      lineasMd.push(linea)
    }
  }

  return lineasMd.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * Convierte un buffer de PDF o texto plano a Markdown estructurado.
 * 
 * @param {Buffer} buffer Contenido en memoria
 * @param {string} formato 'pdf' o 'md'
 * @returns {Promise<string>} Contenido en Markdown
 */
const convertirBufferAMarkdown = async (buffer, formato = 'pdf') => {
  if (formato === 'md' || formato === 'txt') {
    const rawText = buffer.toString('utf-8')
    return formatearAMarkdown(limpiarTextoCrudo(rawText))
  }

  // Procesamiento PDF
  try {
    let rawText = ''

    if (typeof pdfParse === 'function') {
      // API estándar y probada pdf-parse v1
      const data = await pdfParse(buffer)
      rawText = data?.text || ''
    } else if (typeof pdfParse?.default === 'function') {
      const data = await pdfParse.default(buffer)
      rawText = data?.text || ''
    } else if (pdfParse?.PDFParse) {
      // API de clases pdf-parse v2+
      const parser = new pdfParse.PDFParse({ data: buffer })
      const result = await parser.getText()
      rawText = result?.text || ''
      if (typeof parser.destroy === 'function') {
        await parser.destroy()
      }
    } else {
      throw new Error('Instancia de parser PDF no compatible')
    }

    const textoLimpio = limpiarTextoCrudo(rawText)
    return formatearAMarkdown(textoLimpio)
  } catch (err) {
    logger.error('Error al parsear documento PDF con pdf-parse:', err)
    throw new Error(`No fue posible extraer el texto del archivo PDF: ${err.message}`)
  }
}

/**
 * Segmenta el Markdown del RICE en chunks semánticos basados en encabezados de Artículos o Capítulos.
 * 
 * @param {string} markdownContent Contenido en Markdown
 * @param {Object} opciones { maxChunkSize, overlapChars }
 * @returns {Array<Object>} Lista de chunks { numero_chunk, seccion, articulo, contenido }
 */
const segmentarMarkdownEnChunks = (markdownContent = '', opciones = {}) => {
  const { maxChunkSize = 1800, overlapChars = 200 } = opciones
  const lineas = markdownContent.split('\n')

  const chunks = []
  let seccionActual = 'Disposiciones Generales'
  let articuloActual = null
  let bufferParrafos = []
  let chunkIndex = 1

  const flushBuffer = () => {
    const textoAcumulado = bufferParrafos.join('\n').trim()
    if (textoAcumulado.length >= 25) {
      chunks.push({
        numero_chunk: chunkIndex++,
        seccion: seccionActual,
        articulo: articuloActual || 'General',
        contenido: textoAcumulado,
      })
    }
    bufferParrafos = []
  }

  for (const rawLinea of lineas) {
    const linea = rawLinea.trim()

    if (linea.startsWith('# ') || linea.startsWith('## ')) {
      // Cambio de Título o Capítulo mayor: cierra artículo anterior y actualiza sección
      flushBuffer()
      seccionActual = linea.replace(/^#+\s*/, '')
      articuloActual = null
    } else if (linea.startsWith('### ')) {
      // Cambio de Artículo específico: cierra artículo anterior y comienza nuevo
      flushBuffer()
      articuloActual = linea.replace(/^###\s*/, '')
      bufferParrafos.push(linea)
    } else {
      bufferParrafos.push(rawLinea)

      // Si el buffer supera el tamaño máximo, hacer split suave por párrafos
      const longitudActual = bufferParrafos.join('\n').length
      if (longitudActual >= maxChunkSize) {
        flushBuffer()
        // Mantener solapamiento de la última línea para contexto
        if (rawLinea) {
          bufferParrafos.push(`... ${rawLinea.slice(-overlapChars)}`)
        }
      }
    }
  }

  flushBuffer()
  return chunks
}

module.exports = {
  limpiarTextoCrudo,
  formatearAMarkdown,
  convertirBufferAMarkdown,
  segmentarMarkdownEnChunks,
}
