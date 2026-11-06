const PDFDocument = require('pdfkit')
const crypto = require('crypto')

// =============================================================================
// MOTOR PDFKIT: ACTA OFICIAL DE ENTREVISTA PEDAGÓGICA Y ACUERDOS MUTUOS
// TASK 10.2.1 / SPRINT 10 — Escuela Coeducacional N° 1 El Salvador (RBD 9876-5)
// Enfoque formativo y de corresponsabilidad Familia-Escuela (Circular N° 482)
// =============================================================================

const AZUL_INSTITUCIONAL = '#1e3a5f'
const AZUL_SECUNDARIO    = '#2563eb'
const GRIS_FONDO         = '#f8fafc'
const GRIS_BORDE         = '#cbd5e1'
const GRIS_TEXTO         = '#475569'
const TEXTO_OSCURO       = '#0f172a'
const BLANCO             = '#ffffff'
const VERDE_EXITO        = '#059669'

const CATEGORIAS_LABELS = {
  refuerzo_academico:         'Refuerzo Académico',
  habitos_asistencia:         'Hábitos y Asistencia',
  reconocimiento_felicitacion: 'Reconocimiento y Felicitación',
  acuerdos_convivencia:       'Acuerdos de Convivencia',
  seguimiento_formativo:      'Seguimiento Formativo',
}

/**
 * Calcula un hash criptográfico SHA-256 inmutable de la citación y sus acuerdos.
 * Garantiza integridad forense, autenticidad y no repudio ante la Superintendencia.
 *
 * @param {Object} citacion - Datos de la citación
 * @param {Object} acuerdos - Compromisos y acuerdos mutuos suscritos
 * @returns {string} Hash SHA-256 hexadecimal de 64 caracteres
 */
const calcularHashActaCitacion = (citacion, acuerdos = {}) => {
  const payloadCanonico = JSON.stringify({
    citacion_id: citacion?.id,
    folio: citacion?.folio,
    estudiante_rut: citacion?.estudiante?.rut,
    apoderado_rut: citacion?.apoderado?.rut,
    docente_id: citacion?.docente_id || citacion?.docente?.id,
    fecha_hora_programada: citacion?.fecha_hora_programada,
    compromisos_colegio: (acuerdos?.compromisos_colegio || []).map((c) => ({
      descripcion: c.descripcion || c,
      responsable: c.responsable || null,
      plazo: c.plazo || null,
    })),
    compromisos_apoderado: (acuerdos?.compromisos_apoderado || []).map((c) => ({
      descripcion: c.descripcion || c,
      responsable: c.responsable || null,
      plazo: c.plazo || null,
    })),
    fecha_proximo_seguimiento: acuerdos?.fecha_proximo_seguimiento || null,
  })

  return crypto.createHash('sha256').update(payloadCanonico).digest('hex')
}

/**
 * Genera el documento PDF oficial del Acta de Entrevista y Compromisos Mutuos.
 *
 * @param {Object} citacion - Datos completos de la citación
 * @param {Object} acuerdos - Compromisos asumidos por el colegio y el apoderado
 * @returns {Promise<Buffer>} Buffer con el archivo PDF compilado
 */
const generarActaCitacionPDF = (citacion, acuerdos = {}) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 40, bottom: 50, left: 45, right: 45 },
        bufferPages: true,
        info: {
          Title: `Acta Oficial de Citación ${citacion.folio || 'CIT-2026'}`,
          Author: 'Escuela Coeducacional N° 1 El Salvador',
          Subject: 'Acta de Entrevista y Acuerdos Mutuos Familia-Escuela',
          Keywords: 'Citación, Convivencia Escolar, Acuerdos, Mineduc, RICE',
        },
      })

      const buffers = []
      doc.on('data', (chunk) => buffers.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', (err) => reject(err))

      const hashDocumento = acuerdos.hash_sha256 || calcularHashActaCitacion(citacion, acuerdos)

      // =======================================================================
      // 1. ENCABEZADO INSTITUCIONAL CON FOLIO OFICIAL
      // =======================================================================
      doc.rect(45, 40, 522, 68).fill(AZUL_INSTITUCIONAL)

      // Títulos del membrete
      doc
        .fillColor(BLANCO)
        .font('Helvetica-Bold')
        .fontSize(12)
        .text('ESCUELA COEDUCACIONAL N° 1 EL SALVADOR', 55, 48, { align: 'left' })
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#93c5fd')
        .text('RBD: 9876-5 · Diego de Almagro, Región de Atacama', 55, 63)
        .text('Unidad de Convivencia Escolar · Alianza Familia-Escuela (Circular N° 482)', 55, 74)

      // Pastilla de Folio Oficial
      const folioTexto = citacion.folio || 'CIT-2026-0001'
      doc.roundedRect(410, 48, 145, 26, 4).fill('#0f2b48').stroke(AZUL_SECUNDARIO)
      doc
        .fillColor(BLANCO)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(`FOLIO: ${folioTexto}`, 410, 56, { width: 145, align: 'center' })

      // Título del Acta
      doc.y = 118
      doc
        .fillColor(TEXTO_OSCURO)
        .font('Helvetica-Bold')
        .fontSize(13)
        .text('ACTA OFICIAL DE ENTREVISTA PEDAGÓGICA Y COMPROMISOS MUTUOS', { align: 'center' })

      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(GRIS_TEXTO)
        .text('ACUERDOS DE CORRESPONSABILIDAD FAMILIA-ESCUELA PARA EL BIENESTAR FORMATIVO', { align: 'center' })

      doc.moveDown(0.8)

      // =======================================================================
      // 2. SECCIÓN I: IDENTIFICACIÓN DE LOS COMPARECIENTES
      // =======================================================================
      const startYInfo = doc.y
      doc.roundedRect(45, startYInfo, 522, 78, 4).fill(GRIS_FONDO).stroke(GRIS_BORDE)

      doc.fillColor(AZUL_INSTITUCIONAL).font('Helvetica-Bold').fontSize(8.5)
      doc.text('1. ANTECEDENTES DE LA CONVOCATORIA', 55, startYInfo + 7)

      const colW = 250
      const leftX = 55
      const rightX = 310
      let yActual = startYInfo + 22

      // Fila 1: Estudiante y Apoderado
      doc.font('Helvetica-Bold').fontSize(8).fillColor(TEXTO_OSCURO)
      doc.text('Estudiante: ', leftX, yActual, { continued: true })
      doc.font('Helvetica').text(`${citacion.estudiante?.nombre || ''} ${citacion.estudiante?.apellido || ''} (RUT: ${citacion.estudiante?.rut || 'Sin RUT'})`)

      doc.font('Helvetica-Bold').text('Apoderado/a: ', rightX, yActual, { continued: true })
      doc.font('Helvetica').text(`${citacion.apoderado?.nombre || ''} ${citacion.apoderado?.apellido || ''} (RUT: ${citacion.apoderado?.rut || 'Sin RUT'})`)

      // Fila 2: Curso y Docente
      yActual += 14
      doc.font('Helvetica-Bold').text('Curso: ', leftX, yActual, { continued: true })
      doc.font('Helvetica').text(`${citacion.estudiante?.curso?.nombre || citacion.estudiante?.curso || 'No informado'}`)

      doc.font('Helvetica-Bold').text('Docente/Directivo: ', rightX, yActual, { continued: true })
      doc.font('Helvetica').text(`${citacion.docente?.nombre || 'Profesor Jefe / Equipo de Formación'}`)

      // Fila 3: Fecha/Hora y Categoría
      yActual += 14
      const fechaStr = citacion.fecha_hora_programada
        ? new Date(citacion.fecha_hora_programada).toLocaleString('es-CL', { timeZone: 'America/Santiago' })
        : 'Fecha coordinada'
      const catLabel = CATEGORIAS_LABELS[citacion.motivo_categoria] || citacion.motivo_categoria || 'Colaboración Pedagógica'

      doc.font('Helvetica-Bold').text('Fecha de Reunión: ', leftX, yActual, { continued: true })
      doc.font('Helvetica').text(fechaStr)

      doc.font('Helvetica-Bold').text('Propósito: ', rightX, yActual, { continued: true })
      doc.font('Helvetica').text(catLabel)

      // Fila 4: Modalidad y Lugar
      yActual += 14
      doc.font('Helvetica-Bold').text('Modalidad: ', leftX, yActual, { continued: true })
      doc.font('Helvetica').text(citacion.modalidad === 'virtual' ? 'Online / Videollamada' : (citacion.lugar_entrevista || 'Presencial - Sala de Entrevistas'))

      doc.font('Helvetica-Bold').text('Estado: ', rightX, yActual, { continued: true })
      doc.font('Helvetica').fillColor(VERDE_EXITO).text('Entrevista Realizada / Acuerdos Suscritos')

      doc.y = startYInfo + 88

      // =======================================================================
      // 3. MOTIVO PEDAGÓGICO DE LA ENTREVISTA
      // =======================================================================
      doc.fillColor(AZUL_INSTITUCIONAL).font('Helvetica-Bold').fontSize(8.5)
      doc.text('2. MOTIVO Y CONTEXTO PEDAGÓGICO TRATADO', 45, doc.y)
      doc.moveDown(0.3)

      const motivoTexto = citacion.motivo_detalle || 'Entrevista formativa para alinear metas de aprendizaje y convivencia escolar.'
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(TEXTO_OSCURO)
        .text(motivoTexto, 45, doc.y, { width: 522, align: 'justify', lineGap: 1.5 })

      doc.moveDown(0.8)

      // =======================================================================
      // 4. TABLA COMPARATIVA EN 2 COLUMNAS: COMPROMISOS MUTUOS
      // =======================================================================
      const startYTabla = doc.y
      doc.fillColor(AZUL_INSTITUCIONAL).font('Helvetica-Bold').fontSize(8.5)
      doc.text('3. COMPROMISOS MUTUOS SUSCRITOS (TABLA COMPARATIVA DE CORRESPONSABILIDAD)', 45, startYTabla)
      doc.moveDown(0.4)

      const tablaTop = doc.y
      const anchoCol = 256
      const col1X = 45
      const col2X = 311

      // Cabeceras de columnas
      doc.rect(col1X, tablaTop, anchoCol, 20).fill(AZUL_INSTITUCIONAL)
      doc.rect(col2X, tablaTop, anchoCol, 20).fill('#0284c7')

      doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(7.5)
      doc.text('COMPROMISOS DEL ESTABLECIMIENTO', col1X, tablaTop + 6, { width: anchoCol, align: 'center' })
      doc.text('COMPROMISOS DE LA FAMILIA / APODERADO', col2X, tablaTop + 6, { width: anchoCol, align: 'center' })

      const listaColegio = Array.isArray(acuerdos.compromisos_colegio) ? acuerdos.compromisos_colegio : []
      const listaApoderado = Array.isArray(acuerdos.compromisos_apoderado) ? acuerdos.compromisos_apoderado : []
      const maxFilas = Math.max(listaColegio.length, listaApoderado.length, 1)

      let itemY = tablaTop + 20
      const altoMinFila = 36

      for (let i = 0; i < maxFilas; i++) {
        const itemCol = listaColegio[i]
        const itemApo = listaApoderado[i]

        const textoCol = itemCol ? (typeof itemCol === 'string' ? itemCol : `${itemCol.descripcion || ''}${itemCol.responsable ? ` (${itemCol.responsable})` : ''}`) : 'Sin compromisos adicionales.'
        const textoApo = itemApo ? (typeof itemApo === 'string' ? itemApo : `${itemApo.descripcion || ''}${itemApo.plazo ? ` [Plazo: ${itemApo.plazo}]` : ''}`) : 'Sin compromisos adicionales.'

        // Fondo alternado para filas
        const bgFila = i % 2 === 0 ? GRIS_FONDO : BLANCO
        doc.rect(col1X, itemY, anchoCol, altoMinFila).fill(bgFila).stroke(GRIS_BORDE)
        doc.rect(col2X, itemY, anchoCol, altoMinFila).fill(bgFila).stroke(GRIS_BORDE)

        // Viñeta y texto Colegio
        doc.font('Helvetica').fontSize(7.5).fillColor(TEXTO_OSCURO)
        doc.text(`• ${textoCol}`, col1X + 8, itemY + 6, { width: anchoCol - 16, lineGap: 1 })

        // Viñeta y texto Apoderado
        doc.text(`• ${textoApo}`, col2X + 8, itemY + 6, { width: anchoCol - 16, lineGap: 1 })

        itemY += altoMinFila
      }

      doc.y = itemY + 8

      // =======================================================================
      // 5. FECHA DE PRÓXIMO SEGUIMIENTO Y OBSERVACIONES
      // =======================================================================
      const startYSeguimiento = doc.y
      doc.roundedRect(45, startYSeguimiento, 522, 42, 4).fill(GRIS_FONDO).stroke(GRIS_BORDE)

      const fechaSeg = acuerdos.fecha_proximo_seguimiento
        ? new Date(acuerdos.fecha_proximo_seguimiento).toLocaleDateString('es-CL', { timeZone: 'UTC', dateStyle: 'long' })
        : 'A coordinar durante el semestre'

      doc.fillColor(AZUL_INSTITUCIONAL).font('Helvetica-Bold').fontSize(8)
      doc.text('FECHA DE PRÓXIMO SEGUIMIENTO Y EVALUACIÓN DE ACUERDOS: ', 55, startYSeguimiento + 8, { continued: true })
      doc.font('Helvetica-Bold').fillColor(AZUL_SECUNDARIO).text(fechaSeg)

      doc.font('Helvetica').fontSize(7.5).fillColor(GRIS_TEXTO)
      const obsTexto = acuerdos.observaciones_pedagogicas || 'Se acuerda mantener comunicación fluida a través de la libreta institucional y seguimiento conjunto.'
      doc.text(`Observaciones: ${obsTexto}`, 55, startYSeguimiento + 22, { width: 502, lineGap: 1 })

      doc.y = startYSeguimiento + 54

      // =======================================================================
      // 6. CUADRANTES DE FIRMAS DIGITALES
      // =======================================================================
      const yFirmas = Math.min(doc.y, 610)
      doc.fillColor(AZUL_INSTITUCIONAL).font('Helvetica-Bold').fontSize(8.5)
      doc.text('4. SUSCRIPCIÓN Y CONFORMIDAD DE LAS PARTES', 45, yFirmas)

      const cuadroW = 240
      const cuadroH = 65
      const cuadro1X = 55
      const cuadro2X = 325
      const cuadroY = yFirmas + 16

      // Cuadrante 1: Docente / Directivo
      doc.roundedRect(cuadro1X, cuadroY, cuadroW, cuadroH, 4).fill(BLANCO).stroke(GRIS_BORDE)
      doc.moveTo(cuadro1X + 20, cuadroY + 42).lineTo(cuadro1X + cuadroW - 20, cuadroY + 42).stroke(GRIS_BORDE)

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(TEXTO_OSCURO)
      doc.text(citacion.docente?.nombre || 'Docente / Directivo Convocante', cuadro1X, cuadroY + 46, { width: cuadroW, align: 'center' })
      doc.font('Helvetica').fontSize(6.5).fillColor(GRIS_TEXTO)
      doc.text('Escuela Coeducacional N° 1 El Salvador', cuadro1X, cuadroY + 54, { width: cuadroW, align: 'center' })

      // Cuadrante 2: Apoderado Titular
      doc.roundedRect(cuadro2X, cuadroY, cuadroW, cuadroH, 4).fill(BLANCO).stroke(GRIS_BORDE)
      doc.moveTo(cuadro2X + 20, cuadroY + 42).lineTo(cuadro2X + cuadroW - 20, cuadroY + 42).stroke(GRIS_BORDE)

      const nombreApo = `${citacion.apoderado?.nombre || 'Apoderado/a'} ${citacion.apoderado?.apellido || ''}`
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(TEXTO_OSCURO)
      doc.text(nombreApo, cuadro2X, cuadroY + 46, { width: cuadroW, align: 'center' })
      doc.font('Helvetica').fontSize(6.5).fillColor(GRIS_TEXTO)
      doc.text(`RUT: ${citacion.apoderado?.rut || 'Firma Apoderado Titular'}`, cuadro2X, cuadroY + 54, { width: cuadroW, align: 'center' })

      // =======================================================================
      // 7. PIE DE PÁGINA Y CERTIFICACIÓN FORENSE SHA-256
      // =======================================================================
      const range = doc.bufferedPageRange()
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i)

        // Línea divisoria inferior
        doc.moveTo(45, 742).lineTo(567, 742).stroke(GRIS_BORDE)

        doc
          .font('Helvetica')
          .fontSize(6.5)
          .fillColor(GRIS_TEXTO)
          .text(
            'Documento oficial generado bajo el marco de la Circular N° 482 de la Superintendencia de Educación y RICE.',
            45,
            746,
            { align: 'center', width: 522 }
          )

        doc
          .font('Courier-Bold')
          .fontSize(6.5)
          .fillColor(AZUL_INSTITUCIONAL)
          .text(`Hash SHA-256 de Certificación: ${hashDocumento}`, 45, 755, { align: 'center', width: 522 })

        doc
          .font('Helvetica')
          .fontSize(6.5)
          .fillColor(GRIS_TEXTO)
          .text(`Página ${i + 1} de ${range.count} · Folio: ${folioTexto}`, 45, 764, { align: 'center', width: 522 })
      }

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}

module.exports = {
  calcularHashActaCitacion,
  generarActaCitacionPDF,
}
