const PDFDocument = require('pdfkit')

/**
 * Genera el PDF del historial conductual de un estudiante.
 * Retorna un Buffer con el PDF generado.
 */
const generarHistorialPDF = (estudiante, incidentes) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const buffers = []

    doc.on('data', chunk => buffers.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(buffers)))
    doc.on('error', reject)

    const AZUL       = '#1e3a5f'
    const AZUL_CLARO = '#2563eb'
    const GRIS       = '#6b7280'
    const NEGRO      = '#111827'
    const pageWidth  = doc.page.width - 100 // margen 50 c/lado

    // ==========================================================
    // ENCABEZADO — Membrete institucional
    // ==========================================================
    doc
      .rect(50, 50, pageWidth, 70)
      .fill(AZUL)

    doc
      .fillColor('white')
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('ESCUELA COEDUCACIONAL N°1 EL SALVADOR', 60, 65, { width: pageWidth - 20 })

    doc
      .fontSize(9)
      .font('Helvetica')
      .text('Sistema de Gestión y Acompañamiento Escolar — SIGA Escolar', 60, 87)

    doc
      .fontSize(8)
      .text(`Fecha de emisión: ${new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}`, 60, 100)

    doc.moveDown(3)

    // ==========================================================
    // TÍTULO DEL DOCUMENTO
    // ==========================================================
    doc
      .fillColor(AZUL)
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('HISTORIAL CONDUCTUAL DEL ESTUDIANTE', { align: 'center' })

    doc
      .moveDown(0.3)
      .fillColor(AZUL_CLARO)
      .rect(50, doc.y, pageWidth, 2)
      .fill()

    doc.moveDown(1)

    // ==========================================================
    // DATOS DEL ESTUDIANTE
    // ==========================================================
    doc
      .fillColor(AZUL)
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('DATOS DEL ESTUDIANTE')

    doc.moveDown(0.4)

    const curso = estudiante.cursos?.nombre || 'Sin curso'
    const fechaNac = estudiante.fecha_nacimiento
      ? new Date(estudiante.fecha_nacimiento).toLocaleDateString('es-CL')
      : 'No registrada'

    const camposEstudiante = [
      ['Nombre completo', `${estudiante.nombre} ${estudiante.apellido}`],
      ['RUT',             estudiante.rut],
      ['Curso',           curso],
      ['Fecha de nacimiento', fechaNac],
    ]

    camposEstudiante.forEach(([label, value]) => {
      doc
        .fillColor(GRIS)
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(`${label}:`, 50, doc.y, { continued: true, width: 150 })
        .fillColor(NEGRO)
        .font('Helvetica')
        .text(` ${value}`)
    })

    doc.moveDown(0.5)
    doc
      .fillColor(GRIS)
      .rect(50, doc.y, pageWidth, 1)
      .fill()
    doc.moveDown(0.8)

    // ==========================================================
    // RESUMEN
    // ==========================================================
    const totalIncidentes = incidentes.length
    const graves = incidentes.filter(i => i.gravedad === 'Grave' || i.gravedad === 'Gravísima').length

    doc
      .fillColor(AZUL)
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('RESUMEN')

    doc.moveDown(0.4)
    doc
      .fillColor(NEGRO)
      .fontSize(9)
      .font('Helvetica')
      .text(`Total de incidentes registrados: ${totalIncidentes}   |   Incidentes graves/gravísimos: ${graves}`)

    doc.moveDown(0.8)

    // ==========================================================
    // HISTORIAL DE INCIDENTES
    // ==========================================================
    doc
      .fillColor(AZUL)
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('HISTORIAL DE INCIDENTES')

    doc.moveDown(0.8)

    if (incidentes.length === 0) {
      doc
        .fillColor(GRIS)
        .fontSize(9)
        .font('Helvetica')
        .text('No se registran incidentes para este estudiante.', { align: 'center' })
    } else {
      // Ordenar por fecha descendente
      const ordenados = [...incidentes].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))

      ordenados.forEach((incidente, idx) => {
        // Verificar si hay espacio suficiente — si no, nueva página
        if (doc.y > doc.page.height - 200) {
          doc.addPage()
        }

        const gravedadColor = {
          Leve:      '#16a34a',
          Grave:     '#d97706',
          Gravísima: '#dc2626',
        }[incidente.gravedad] || NEGRO

        // Cabecera del incidente
        const cabeceraY = doc.y
        doc
          .rect(50, cabeceraY, pageWidth, 18)
          .fill('#f1f5f9')

        doc
          .fillColor(AZUL)
          .fontSize(9)
          .font('Helvetica-Bold')
          .text(
            `#${idx + 1}  |  ${new Date(incidente.fecha).toLocaleDateString('es-CL')}  |  ${incidente.tipos_abordaje?.nombre || 'Sin tipo'}`,
            55, cabeceraY + 4,
            { continued: true }
          )
          .fillColor(gravedadColor)
          .text(`  [${incidente.gravedad}]`)

        doc.moveDown(0.8)

        // Relato
        doc
          .fillColor(GRIS)
          .fontSize(8)
          .font('Helvetica-Bold')
          .text('Relato:', 55, doc.y)

        doc
          .fillColor(NEGRO)
          .font('Helvetica')
          .text(incidente.relato || '—', 55, doc.y, { width: pageWidth - 10 })

        // Medidas
        if (incidente.medidas) {
          doc.moveDown(0.3)
          doc
            .fillColor(GRIS)
            .font('Helvetica-Bold')
            .text('Medidas adoptadas:', 55, doc.y)

          doc
            .fillColor(NEGRO)
            .font('Helvetica')
            .text(incidente.medidas, 55, doc.y, { width: pageWidth - 10 })
        }

        doc.moveDown(0.3)
        doc
          .fillColor('#e2e8f0')
          .rect(50, doc.y, pageWidth, 1)
          .fill()
        doc.moveDown(0.6)
      })
    }

    // ==========================================================
    // SECCIÓN DE FIRMAS
    // ==========================================================
    // Asegurar que las firmas estén en la última página con espacio
    if (doc.y > doc.page.height - 160) {
      doc.addPage()
    }

    doc.moveDown(2)

    doc
      .fillColor(GRIS)
      .rect(50, doc.y, pageWidth, 1)
      .fill()

    doc.moveDown(1.5)

    doc
      .fillColor(AZUL)
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('FIRMAS DE CONFORMIDAD', { align: 'center' })

    doc.moveDown(2)

    const firmaY = doc.y
    const col1   = 80
    const col2   = 350

    // Líneas de firma
    doc.rect(col1, firmaY, 150, 1).fill(NEGRO)
    doc.rect(col2, firmaY, 150, 1).fill(NEGRO)

    doc.moveDown(0.4)
    doc
      .fillColor(NEGRO)
      .fontSize(8)
      .font('Helvetica-Bold')
      .text('Coordinador/a de Convivencia Escolar', col1, doc.y, { width: 150, align: 'center' })

    doc
      .text('Director/a del Establecimiento', col2, doc.y - doc.currentLineHeight(), { width: 150, align: 'center' })

    doc.moveDown(0.3)
    doc
      .fillColor(GRIS)
      .font('Helvetica')
      .fontSize(7)
      .text('Nombre y firma', col1, doc.y, { width: 150, align: 'center' })
      .text('Nombre y firma', col2, doc.y - doc.currentLineHeight(), { width: 150, align: 'center' })

    // ==========================================================
    // PIE DE PÁGINA
    // ==========================================================
    doc.moveDown(2)
    doc
      .fillColor(GRIS)
      .fontSize(7)
      .font('Helvetica')
      .text(
        `Documento generado por SIGA Escolar • ${new Date().toLocaleString('es-CL')} • Uso exclusivo interno`,
        { align: 'center' }
      )

    doc.end()
  })
}

module.exports = { generarHistorialPDF }
