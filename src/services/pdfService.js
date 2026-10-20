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

/**
 * Generate Estudiante Profile PDF
 *
 * Includes: Personal info, incident history, risk score, protocols applied
 */
async function generarPerfilEstudiante(estudiante, incidentes, riesgo) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 })
      const chunks = []

      doc.on('data', chunk => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      // Header
      doc.fontSize(20).text('SIGA Escolar - Perfil de Estudiante', { align: 'center' })
      doc.moveDown()
      doc.fontSize(10).text(`Generado: ${new Date().toLocaleDateString('es-CL')}`, { align: 'right' })
      doc.moveDown(2)

      // Personal Info
      doc.fontSize(14).text('Información Personal', { underline: true })
      doc.moveDown(0.5)
      doc.fontSize(11)
        .text(`Nombre: ${estudiante.nombre} ${estudiante.apellido}`)
        .text(`RUT: ${estudiante.rut}`)
        .text(`Curso: ${estudiante.curso || 'N/A'}`)
        .text(`Fecha Nacimiento: ${estudiante.fecha_nacimiento ? new Date(estudiante.fecha_nacimiento).toLocaleDateString('es-CL') : 'N/A'}`)

      doc.moveDown(2)

      // Risk Score
      doc.fontSize(14).text('Nivel de Riesgo', { underline: true })
      doc.moveDown(0.5)
      doc.fontSize(11)
        .text(`Puntaje: ${riesgo.score}/100`)
        .text(`Nivel: ${riesgo.level}`)
        .text(`Total incidentes (30 días): ${riesgo.details.total}`)
        .text(`Incidentes recientes (7 días): ${riesgo.details.recent}`)

      doc.moveDown(2)

      // Incident History
      doc.fontSize(14).text('Historial de Incidentes', { underline: true })
      doc.moveDown(0.5)

      if (incidentes.length === 0) {
        doc.fontSize(11).text('Sin incidentes registrados.')
      } else {
        incidentes.slice(0, 10).forEach((inc, idx) => {
          doc.fontSize(10)
            .text(`${idx + 1}. ${new Date(inc.fecha).toLocaleDateString('es-CL')} - ${inc.gravedad}`)
            .fontSize(9)
            .text(`   ${inc.relato.substring(0, 100)}...`, { indent: 20 })
          doc.moveDown(0.5)
        })

        if (incidentes.length > 10) {
          doc.fontSize(9).text(`... y ${incidentes.length - 10} incidentes más`)
        }
      }

      // Footer
      doc.fontSize(8)
        .text('Este documento es confidencial y de uso exclusivo del personal autorizado.', 50, doc.page.height - 50, {
          align: 'center'
        })

      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}


/**
 * Genera el PDF oficial del informe normativo de incidente (Circular N° 482).
 * Formato A4 institucional de la Escuela Coeducacional N° 1 El Salvador con:
 * - Membrete oficial y folio correlativo.
 * - Ficha del estudiante foco y datos del incidente.
 * - Las 5 secciones normativas estructuradas.
 * - Glosa legal de confidencialidad y bloques para firma física.
 *
 * @param {Object} params
 * @param {Object} params.reporte - Registro de reportes_incidentes (debe estar Aprobado).
 * @param {Object} params.incidente - Datos del incidente y tipo de abordaje.
 * @param {Object} params.estudiante - Datos del estudiante foco.
 * @param {Object} [params.tenant] - Datos del colegio (nombre, rbd, direccion).
 * @param {Object} [params.apoderado] - Datos del apoderado titular.
 * @returns {Promise<Buffer>}
 */
const generarInformeOficialIncidentePDF = ({
  reporte,
  incidente,
  estudiante,
  tenant = {},
  apoderado = null,
}) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 50,
        size: 'A4',
        bufferPages: true,
      })

      const buffers = []
      doc.on('data', chunk => buffers.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)

      // Colores corporativos institucionales
      const AZUL_OSCURO = '#1e3a5f'
      const AZUL_ACENTO = '#2563eb'
      const GRIS_TEXTO  = '#374151'
      const GRIS_SUAVE  = '#6b7280'
      const GRIS_FONDO  = '#f3f4f6'
      const BORDE_LINEA = '#e5e7eb'

      const pageWidth = doc.page.width - 100 // Margen 50 a cada lado

      // Contenido oficial aprobado
      const contenido = reporte.contenido_aprobado || reporte.contenido_editado || reporte.contenido_borrador || {}

      // Formateo de fechas
      const anio = new Date(reporte.fecha_aprobacion || reporte.created_at).getFullYear()
      const correlativo = String(reporte.id || '').replace(/-/g, '').slice(0, 6).toUpperCase()
      const folio = `INF-${anio}-${correlativo}`

      const fechaAprobacion = reporte.fecha_aprobacion
        ? new Date(reporte.fecha_aprobacion).toLocaleDateString('es-CL', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'Pendiente de aprobación'

      const fechaIncidente = incidente.fecha
        ? new Date(incidente.fecha).toLocaleDateString('es-CL', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })
        : 'Fecha no registrada'

      // =======================================================================
      // 1. ENCABEZADO INSTITUCIONAL
      // =======================================================================
      doc
        .rect(50, 45, pageWidth, 65)
        .fill(AZUL_OSCURO)

      doc
        .fillColor('#ffffff')
        .fontSize(14)
        .font('Helvetica-Bold')
        .text((tenant.nombre || 'ESCUELA COEDUCACIONAL N° 1 EL SALVADOR').toUpperCase(), 65, 55, {
          width: pageWidth - 30,
        })

      doc
        .fontSize(8.5)
        .font('Helvetica')
        .text('Sistema de Gestión y Acompañamiento Escolar — SIGA Escolar', 65, 74)
        .text(`RBD: ${tenant.rbd || '00234-1'} | Dirección: ${tenant.direccion || 'Av. Potrerillos S/N, El Salvador'}`, 65, 87)

      doc.y = 125

      // =======================================================================
      // 2. TÍTULO Y FOLIO DEL DOCUMENTO
      // =======================================================================
      doc
        .fillColor(AZUL_OSCURO)
        .fontSize(13)
        .font('Helvetica-Bold')
        .text('INFORME OFICIAL DE CONVIVENCIA ESCOLAR', { align: 'center' })

      doc
        .fillColor(GRIS_SUAVE)
        .fontSize(8.5)
        .font('Helvetica')
        .text('ESTRUCTURADO CONFORME A LA CIRCULAR N° 482 — SUPERINTENDENCIA DE EDUCACIÓN', { align: 'center' })

      doc.moveDown(0.4)

      // Barra de folio y fecha
      const yFolio = doc.y
      doc
        .rect(50, yFolio, pageWidth, 22)
        .fill(GRIS_FONDO)

      doc
        .fillColor(AZUL_OSCURO)
        .fontSize(8.5)
        .font('Helvetica-Bold')
        .text(`FOLIO: ${folio}`, 60, yFolio + 6)
        .text(`VERSIÓN: ${reporte.version || 1}.0`, 220, yFolio + 6)
        .text(`FECHA EMISIÓN: ${new Date().toLocaleDateString('es-CL')}`, 350, yFolio + 6, { align: 'right', width: pageWidth - 310 })

      doc.y = yFolio + 32

      // =======================================================================
      // 3. FICHA DEL ESTUDIANTE Y DEL CASO
      // =======================================================================
      doc
        .fillColor(AZUL_OSCURO)
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('1. ANTECEDENTES GENERALES Y FILIACIÓN')

      doc
        .moveDown(0.2)
        .strokeColor(AZUL_ACENTO)
        .lineWidth(1.5)
        .moveTo(50, doc.y)
        .lineTo(50 + pageWidth, doc.y)
        .stroke()

      doc.moveDown(0.5)

      const nombreEstudiante = `${estudiante.nombre || ''} ${estudiante.apellido || ''}`.trim() || 'Estudiante'
      const cursoEstudiante  = estudiante.cursos?.nombre || estudiante.curso || 'No asignado'
      const rutEstudiante    = estudiante.rut || 'No registrado'
      const esPie            = estudiante.es_pie ? 'Sí (Programa Integración Escolar)' : 'No'
      const nombreApoderado  = apoderado ? `${apoderado.nombre} ${apoderado.apellido}` : 'No registrado'

      const yFicha = doc.y
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor(GRIS_TEXTO)
      doc.text('Estudiante Foco:', 55, yFicha)
      doc.font('Helvetica').text(nombreEstudiante, 145, yFicha)

      doc.font('Helvetica-Bold').text('RUT:', 330, yFicha)
      doc.font('Helvetica').text(rutEstudiante, 360, yFicha)

      doc.font('Helvetica-Bold').text('Curso:', 55, yFicha + 15)
      doc.font('Helvetica').text(cursoEstudiante, 145, yFicha + 15)

      doc.font('Helvetica-Bold').text('Condición PIE:', 330, yFicha + 15)
      doc.font('Helvetica').text(esPie, 410, yFicha + 15)

      doc.font('Helvetica-Bold').text('Apoderado Titular:', 55, yFicha + 30)
      doc.font('Helvetica').text(nombreApoderado, 145, yFicha + 30)

      doc.font('Helvetica-Bold').text('Fecha Suceso:', 330, yFicha + 30)
      doc.font('Helvetica').text(fechaIncidente, 410, yFicha + 30)

      doc.font('Helvetica-Bold').text('Tipo Abordaje:', 55, yFicha + 45)
      doc.font('Helvetica').text(incidente.tipo_abordaje || 'Convivencia Escolar', 145, yFicha + 45)

      doc.font('Helvetica-Bold').text('Gravedad:', 330, yFicha + 45)
      doc.font('Helvetica').text(incidente.gravedad || 'Leve', 410, yFicha + 45)

      doc.y = yFicha + 65

      // =======================================================================
      // 4. LAS 5 SECCIONES NORMATIVAS (CIRCULAR N° 482)
      // =======================================================================
      const renderSeccion = (numRomano, titulo, texto) => {
        // Verificar si queda poco espacio vertical para saltar de página ordenadamente
        if (doc.y > 660) {
          doc.addPage()
        }

        doc
          .fillColor(AZUL_OSCURO)
          .fontSize(9.5)
          .font('Helvetica-Bold')
          .text(`${numRomano}. ${titulo}`)

        doc
          .moveDown(0.2)
          .strokeColor(BORDE_LINEA)
          .lineWidth(0.8)
          .moveTo(50, doc.y)
          .lineTo(50 + pageWidth, doc.y)
          .stroke()

        doc.moveDown(0.4)

        doc
          .fillColor(GRIS_TEXTO)
          .fontSize(8.5)
          .font('Helvetica')
          .text(texto || 'Sin registro detallado en esta sección.', 55, doc.y, {
            width: pageWidth - 10,
            align: 'justify',
            lineGap: 2.5,
          })

        doc.moveDown(0.9)
      }

      renderSeccion('I', 'CONTEXTO Y CIRCUNSTANCIAS DEL SUCESO', contenido.contexto)
      renderSeccion('II', 'RELATO DE HECHOS OBJETIVOS', contenido.hechos_objetivos)
      renderSeccion('III', 'MEDIDAS FORMATIVAS Y PROTOCOLARES ADOPTADAS', contenido.medidas_adoptadas)
      renderSeccion('IV', 'ACUERDOS Y COMPROMISOS ASUMIDOS', contenido.acuerdos_compromisos)
      renderSeccion('V', 'PLAN DE SEGUIMIENTO PEDAGÓGICO Y PSICOSOCIAL', contenido.plan_seguimiento)

      // =======================================================================
      // 5. BLOQUE DE FIRMAS Y VALIDEZ LEGAL
      // =======================================================================
      if (doc.y > 640) {
        doc.addPage()
      }

      doc.moveDown(1.5)

      const yFirmas = doc.y + 20
      const anchoFirma = 190

      // Línea Firma 1 (Convivencia)
      doc
        .strokeColor(GRIS_SUAVE)
        .lineWidth(0.8)
        .moveTo(70, yFirmas)
        .lineTo(70 + anchoFirma, yFirmas)
        .stroke()

      doc
        .fillColor(GRIS_TEXTO)
        .fontSize(8.5)
        .font('Helvetica-Bold')
        .text('COORDINACIÓN DE CONVIVENCIA ESCOLAR', 70, yFirmas + 5, {
          width: anchoFirma,
          align: 'center',
        })
      doc
        .fontSize(7.5)
        .font('Helvetica')
        .text('Escuela Coeducacional N° 1 El Salvador', 70, yFirmas + 17, {
          width: anchoFirma,
          align: 'center',
        })

      // Línea Firma 2 (Dirección / Inspectoría)
      doc
        .strokeColor(GRIS_SUAVE)
        .lineWidth(0.8)
        .moveTo(300, yFirmas)
        .lineTo(300 + anchoFirma, yFirmas)
        .stroke()

      const aprobadorNombre = reporte.aprobador
        ? `${reporte.aprobador.nombre} ${reporte.aprobador.apellido}`
        : 'DIRECCIÓN / INSPECTORÍA GENERAL'

      doc
        .fillColor(GRIS_TEXTO)
        .fontSize(8.5)
        .font('Helvetica-Bold')
        .text(aprobadorNombre.toUpperCase(), 300, yFirmas + 5, {
          width: anchoFirma,
          align: 'center',
        })
      doc
        .fontSize(7.5)
        .font('Helvetica')
        .text(reporte.aprobador?.rol || 'Dirección del Establecimiento', 300, yFirmas + 17, {
          width: anchoFirma,
          align: 'center',
        })

      // Glosa de pie de página institucional en todas las páginas
      const range = doc.bufferedPageRange()
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i)
        doc
          .fillColor(GRIS_SUAVE)
          .fontSize(7)
          .font('Helvetica')
          .text(
            `Documento oficial e intransferible. Protegido por la Ley N° 19.628 de Protección de Datos Personales. Aprobado formalmente el ${fechaAprobacion}. Página ${i + 1} de ${range.count}`,
            50,
            doc.page.height - 35,
            { align: 'center', width: pageWidth }
          )
      }

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}

/**
 * Genera el Expediente Oficial del Protocolo RICE en PDF con detalle de pasos
 * y el Anexo de Evidencias Probatorias para auditorías de la Superintendencia de Educación.
 *
 * @param {Object} protocolo - Datos del protocolo con estudiante, apoderados, tipo
 * @param {Array} pasos - Lista de pasos normativos con evidencias adjuntas
 * @returns {Promise<Buffer>}
 */
const generarExpedienteProtocoloPDF = (protocolo, pasos = []) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' })
      const buffers = []

      doc.on('data', (chunk) => buffers.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)

      const AZUL = '#1e3a5f'
      const AZUL_CLARO = '#2563eb'
      const GRIS_FONDO = '#f8fafc'
      const GRIS_BORDE = '#e2e8f0'
      const GRIS_TEXTO = '#334155'
      const GRIS_SUAVE = '#64748b'
      const VERDE = '#15803d'
      const AMBAR = '#b45309'
      const pageWidth = doc.page.width - 100

      // ==========================================================
      // ENCABEZADO — Membrete Institucional
      // ==========================================================
      doc.rect(50, 45, pageWidth, 68).fill(AZUL)

      doc
        .fillColor('white')
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('ESCUELA COEDUCACIONAL N°1 EL SALVADOR', 60, 58, { width: pageWidth - 20 })

      doc
        .fontSize(8.5)
        .font('Helvetica')
        .text('Sistema de Gestión y Acompañamiento Escolar — SIGA Escolar', 60, 77)

      const fechaEmision = new Date().toLocaleDateString('es-CL', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })

      doc
        .fontSize(7.5)
        .text(`Fecha y hora de emisión: ${fechaEmision} | Folio: ${protocolo.id ? String(protocolo.id).substring(0, 8).toUpperCase() : 'N/A'}`, 60, 91)

      doc.y = 125

      // ==========================================================
      // TÍTULO DEL EXPEDIENTE
      // ==========================================================
      doc
        .fillColor(AZUL)
        .fontSize(13)
        .font('Helvetica-Bold')
        .text('EXPEDIENTE OFICIAL DE PROTOCOLO RICE', { align: 'center' })

      doc
        .fontSize(8.5)
        .font('Helvetica')
        .fillColor(GRIS_SUAVE)
        .text('Superintendencia de Educación — Circular N° 482 / Debido Proceso y Medidas de Protección', { align: 'center' })

      doc.moveDown(0.4)
      doc.fillColor(AZUL_CLARO).rect(50, doc.y, pageWidth, 2).fill()
      doc.moveDown(0.8)

      // ==========================================================
      // CARÁTULA Y ANTECEDENTES GENERALES DEL CASO
      // ==========================================================
      const estudiante = protocolo.estudiante || {}
      const apoderado = estudiante.apoderados || {}
      const curso = estudiante.cursos?.nombre || 'Sin curso'
      const tipoNombre = protocolo.tipo_protocolo || protocolo.tipos_protocolo?.nombre || 'Protocolo Normativo'

      const yInicioCaratula = doc.y
      doc.rect(50, yInicioCaratula, pageWidth, 85).fill(GRIS_FONDO).strokeColor(GRIS_BORDE).lineWidth(0.8).stroke()

      doc.fillColor(AZUL).fontSize(9.5).font('Helvetica-Bold').text('1. ANTECEDENTES GENERALES DEL PROTOCOLO', 60, yInicioCaratula + 8)

      doc.fontSize(8).font('Helvetica').fillColor(GRIS_TEXTO)

      // Columna 1
      doc.font('Helvetica-Bold').text('Tipología RICE:', 60, yInicioCaratula + 25)
      doc.font('Helvetica').text(tipoNombre, 135, yInicioCaratula + 25)

      doc.font('Helvetica-Bold').text('Estado del Caso:', 60, yInicioCaratula + 38)
      doc.font('Helvetica-Bold').fillColor(protocolo.estado === 'Cerrado' ? VERDE : AMBAR).text(protocolo.estado || 'En Investigación', 135, yInicioCaratula + 38)

      doc.fillColor(GRIS_TEXTO)
      doc.font('Helvetica-Bold').text('Fecha Apertura:', 60, yInicioCaratula + 51)
      doc.font('Helvetica').text(protocolo.fecha_apertura ? new Date(protocolo.fecha_apertura).toLocaleDateString('es-CL') : 'No registrada', 135, yInicioCaratula + 51)

      doc.font('Helvetica-Bold').text('Fecha de Cierre:', 60, yInicioCaratula + 64)
      doc.font('Helvetica').text(protocolo.fecha_cierre ? new Date(protocolo.fecha_cierre).toLocaleDateString('es-CL') : 'En tramitación activa', 135, yInicioCaratula + 64)

      // Columna 2: Datos Alumno
      const col2X = 300
      doc.font('Helvetica-Bold').text('Estudiante Titular:', col2X, yInicioCaratula + 25)
      doc.font('Helvetica').text(`${estudiante.nombre || ''} ${estudiante.apellido || ''}`, col2X + 80, yInicioCaratula + 25)

      doc.font('Helvetica-Bold').text('RUT:', col2X, yInicioCaratula + 38)
      doc.font('Helvetica').text(estudiante.rut || 'No informado', col2X + 80, yInicioCaratula + 38)

      doc.font('Helvetica-Bold').text('Curso:', col2X, yInicioCaratula + 51)
      doc.font('Helvetica').text(curso, col2X + 80, yInicioCaratula + 51)

      doc.font('Helvetica-Bold').text('Apoderado Titular:', col2X, yInicioCaratula + 64)
      const apoderadoTxt = apoderado.nombre ? `${apoderado.nombre} (${apoderado.telefono || 'Sin fono'})` : 'No registrado'
      doc.font('Helvetica').text(apoderadoTxt, col2X + 80, yInicioCaratula + 64, { width: 150 })

      doc.y = yInicioCaratula + 95

      // Observaciones iniciales
      if (protocolo.observaciones) {
        doc.fillColor(AZUL).fontSize(9.5).font('Helvetica-Bold').text('2. GLOSA / OBSERVACIONES INICIALES AL APERTURAR')
        doc.moveDown(0.3)
        doc
          .fillColor(GRIS_TEXTO)
          .fontSize(8)
          .font('Helvetica')
          .text(protocolo.observaciones, { align: 'justify', lineGap: 2 })
        doc.moveDown(0.8)
      }

      // ==========================================================
      // SECCIÓN 2: TRAZABILIDAD DE PASOS NORMATIVOS (CHECKLIST RICE)
      // ==========================================================
      if (doc.y > doc.page.height - 180) doc.addPage()

      doc.fillColor(AZUL).fontSize(9.5).font('Helvetica-Bold').text('3. TRAZABILIDAD Y CERTIFICACIÓN DE PASOS NORMATIVOS')
      doc.moveDown(0.4)

      if (!pasos || pasos.length === 0) {
        doc.fontSize(8).font('Helvetica-Oblique').fillColor(GRIS_SUAVE).text('No hay pasos normativos registrados para este protocolo.')
        doc.moveDown(0.8)
      } else {
        pasos.forEach((paso) => {
          if (doc.y > doc.page.height - 100) doc.addPage()

          const yPaso = doc.y
          const isDone = Boolean(paso.completado)

          doc.rect(50, yPaso, pageWidth, 42).fill(isDone ? '#f0fdf4' : '#fffbeb').strokeColor(isDone ? '#bbf7d0' : '#fef3c7').lineWidth(0.6).stroke()

          doc.fillColor(isDone ? VERDE : AMBAR).fontSize(8).font('Helvetica-Bold').text(`Paso #${paso.orden} [${isDone ? 'COMPLETADO' : 'PENDIENTE'}] — Plazo: ${paso.plazo_dias} días`, 58, yPaso + 6)

          doc.fillColor(GRIS_TEXTO).fontSize(7.5).font('Helvetica-Bold').text(paso.accion, 58, yPaso + 17, { width: pageWidth - 16 })

          const fechaPaso = paso.fecha_completado
            ? new Date(paso.fecha_completado).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : 'Pendiente'
          const respPaso = paso.responsable ? `${paso.responsable.nombre} ${paso.responsable.apellido}` : 'Sin certificar'
          const obsPaso = paso.observacion ? `Glosa: "${paso.observacion}"` : 'Sin observación registrada'

          doc.fillColor(GRIS_SUAVE).fontSize(7).font('Helvetica').text(`Certificado el: ${fechaPaso} | Por: ${respPaso} | ${obsPaso}`, 58, yPaso + 28, { width: pageWidth - 16, lineBreak: false })

          doc.y = yPaso + 46
        })
        doc.moveDown(0.6)
      }

      // ==========================================================
      // SECCIÓN 3: ANEXO DE EVIDENCIAS Y DOCUMENTOS PROBATORIOS
      // ==========================================================
      if (doc.y > doc.page.height - 200) doc.addPage()

      doc.fillColor(AZUL).fontSize(9.5).font('Helvetica-Bold').text('4. ANEXO: REGISTRO DE EVIDENCIAS Y DOCUMENTOS PROBATORIOS (RESPALDO DE AUDITORÍA)')
      doc.moveDown(0.2)
      doc.fontSize(7.5).font('Helvetica-Oblique').fillColor(GRIS_SUAVE).text('Listado oficial de medios de prueba físicos y digitales incorporados al expediente en cumplimiento del debido proceso.')
      doc.moveDown(0.5)

      // Recopilar todas las evidencias de todos los pasos
      const todasEvidencias = []
      pasos.forEach((p) => {
        if (Array.isArray(p.evidencias)) {
          p.evidencias.forEach((ev) => {
            todasEvidencias.push({
              ...ev,
              pasoOrden: p.orden,
              pasoAccion: p.accion,
            })
          })
        }
      })

      if (todasEvidencias.length === 0) {
        doc.rect(50, doc.y, pageWidth, 28).fill(GRIS_FONDO).strokeColor(GRIS_BORDE).lineWidth(0.5).stroke()
        doc.fillColor(GRIS_SUAVE).fontSize(8).font('Helvetica').text('No se adjuntaron documentos probatorios externos durante la tramitación de este protocolo.', 60, doc.y + 9)
        doc.y += 35
      } else {
        // Cabecera de la tabla de evidencias
        const yHead = doc.y
        doc.rect(50, yHead, pageWidth, 18).fill(AZUL)
        doc.fillColor('white').fontSize(7.5).font('Helvetica-Bold')
        doc.text('Hito / Paso', 55, yHead + 5, { width: 65 })
        doc.text('Documento Probatorio', 125, yHead + 5, { width: 170 })
        doc.text('Fecha / Hora Registro', 300, yHead + 5, { width: 95 })
        doc.text('Funcionario', 400, yHead + 5, { width: 75 })
        doc.text('Tamaño', 480, yHead + 5, { width: 60 })
        doc.y = yHead + 18

        todasEvidencias.forEach((ev, idx) => {
          if (doc.y > doc.page.height - 60) doc.addPage()

          const yRow = doc.y
          const rowHeight = 20
          doc.rect(50, yRow, pageWidth, rowHeight).fill(idx % 2 === 0 ? 'white' : GRIS_FONDO).strokeColor(GRIS_BORDE).lineWidth(0.4).stroke()

          doc.fillColor(GRIS_TEXTO).fontSize(7).font('Helvetica')
          doc.text(`Paso #${ev.pasoOrden}`, 55, yRow + 5, { width: 65 })
          doc.font('Helvetica-Bold').text(ev.nombre_archivo || 'Archivo de evidencia', 125, yRow + 5, { width: 170, lineBreak: false })

          const fechaEv = ev.created_at
            ? new Date(ev.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : 'No registrada'
          doc.font('Helvetica').text(fechaEv, 300, yRow + 5, { width: 95 })

          const subidor = ev.subido_por ? `${ev.subido_por.nombre} ${ev.subido_por.apellido}` : 'Equipo Convivencia'
          doc.text(subidor, 400, yRow + 5, { width: 75, lineBreak: false })

          const tamano = ev.tamano_bytes ? `${(ev.tamano_bytes / 1024).toFixed(1)} KB` : 'N/A'
          doc.text(tamano, 480, yRow + 5, { width: 60 })

          doc.y = yRow + rowHeight
        })
        doc.moveDown(0.8)
      }

      // ==========================================================
      // BLOQUE DE FIRMA ÚNICA INSTITUCIONAL (Hallazgo 1)
      // ==========================================================
      if (doc.y > doc.page.height - 120) doc.addPage()

      const yFirmas = doc.y + 40
      const anchoFirma = 220
      const xFirma = (doc.page.width - anchoFirma) / 2 // Centrada exclusivamente

      doc.strokeColor(GRIS_SUAVE).lineWidth(0.8).moveTo(xFirma, yFirmas).lineTo(xFirma + anchoFirma, yFirmas).stroke()

      doc
        .fillColor(GRIS_TEXTO)
        .fontSize(8.5)
        .font('Helvetica-Bold')
        .text('ENCARGADO(A) DE CONVIVENCIA ESCOLAR', xFirma, yFirmas + 5, {
          width: anchoFirma,
          align: 'center',
        })

      doc
        .fontSize(7.5)
        .font('Helvetica')
        .text('Escuela Coeducacional N° 1 El Salvador', xFirma, yFirmas + 17, {
          width: anchoFirma,
          align: 'center',
        })

      doc
        .fontSize(6.5)
        .fillColor(GRIS_SUAVE)
        .text('Certificación de Trazabilidad y Debido Proceso RICE', xFirma, yFirmas + 27, {
          width: anchoFirma,
          align: 'center',
        })

      // ==========================================================
      // GLOSA DE PIE DE PÁGINA EN TODAS LAS PÁGINAS
      // ==========================================================
      const range = doc.bufferedPageRange()
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i)
        doc
          .fillColor(GRIS_SUAVE)
          .fontSize(6.5)
          .font('Helvetica')
          .text(
            `Expediente Oficial de Convivencia Escolar — Escuela Coeducacional N°1 El Salvador | Protegido por Ley N° 19.628 de Protección de Datos Personales | Página ${i + 1} de ${range.count}`,
            50,
            doc.page.height - 25,
            { align: 'center', width: pageWidth }
          )
      }

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}

module.exports = {
  generarHistorialPDF,
  generarPerfilEstudiante,
  generarInformeOficialIncidentePDF,
  generarExpedienteProtocoloPDF,
}
