const PDFDocument = require('pdfkit')
const crypto = require('crypto')

// =============================================================================
// MOTOR PDFKIT: ACTA OFICIAL DE MEDIACIÓN ESCOLAR (TASK 7.2.3.1)
// Escuela Coeducacional N° 1 El Salvador (RBD 9876-5)
// Enfoque Restaurativo conforme a la Circular N° 482 y RICE
// =============================================================================

const AZUL_INSTITUCIONAL = '#1e3a5f'
const AZUL_SECUNDARIO    = '#2563eb'
const GRIS_FONDO         = '#f8fafc'
const GRIS_BORDE         = '#cbd5e1'
const GRIS_TEXTO         = '#475569'
const TEXTO_OSCURO       = '#0f172a'
const BLANCO             = '#ffffff'

const MAPA_TIPOS_COMPROMISO = {
  reparacion_relacional: 'Reparación Relacional',
  disculpa_comunitaria:  'Disculpa Comunitaria',
  cuidado_espacios:      'Cuidado de Espacios',
  actitud_aula:          'Actitud en Aula',
  apoyo_academico:       'Apoyo Académico',
  otro:                  'Otro Compromiso',
}

const MAPA_ROLES_PARTICIPANTE = {
  parte_1:      'Parte Convocada 1',
  parte_2:      'Parte Convocada 2',
  afectado:     'Estudiante Afectado/a',
  mediador_par: 'Mediador/a Par',
  observador:   'Observador/a',
}

/**
 * Calcula un hash criptográfico SHA-256 inmutable de la mediación.
 * Garantiza integridad forense y no repudio del acta oficial.
 *
 * @param {Object} mediacion - Datos canónicos de la mediación
 * @returns {string} Hash SHA-256 en formato hexadecimal (64 caracteres)
 */
const calcularHashMediacion = (mediacion) => {
  const payloadCanonico = JSON.stringify({
    id: mediacion.id,
    folio: mediacion.folio,
    fecha_programada: mediacion.fecha_programada,
    motivo: mediacion.motivo,
    mediador_id: mediacion.mediador_id,
    participantes: (mediacion.mediacion_participantes || []).map((p) => ({
      estudiante_id: p.estudiante_id,
      rol: p.rol_participante,
    })),
    compromisos: (mediacion.mediacion_compromisos || []).map((c) => ({
      tipo: c.tipo_compromiso,
      descripcion: c.descripcion,
      fecha_limite: c.fecha_limite,
    })),
  })

  return crypto.createHash('sha256').update(payloadCanonico).digest('hex')
}

/**
 * Genera el documento PDF del Acta Oficial de Mediación Escolar.
 *
 * @param {Object} mediacion - Expediente completo de mediación
 * @returns {Promise<Buffer>} Buffer con el archivo PDF compilado
 */
const generarActaMediacionPDF = (mediacion) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 50,
        size: 'A4',
        bufferPages: true,
        info: {
          Title: `Acta Oficial de Mediación Escolar - Folio ${mediacion.folio || 'S-F'}`,
          Author: 'Escuela Coeducacional N° 1 El Salvador (RBD 9876-5)',
          Subject: 'Acta de Acuerdos Formativos y Mediación de Convivencia Escolar',
          Keywords: 'Convivencia Escolar, Mediación, RICE, Superintendencia de Educación, Acuerdos',
        },
      })

      const buffers = []
      doc.on('data', (chunk) => buffers.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)

      const pageWidth = doc.page.width - 100 // 495.28 pt utilizables
      const hashInmutable = calcularHashMediacion(mediacion)

      // =======================================================================
      // 1. ENCABEZADO Y MEMBRETE OFICIAL (CRITERIO 1)
      // =======================================================================
      doc.rect(50, 45, pageWidth, 75).fill(AZUL_INSTITUCIONAL)

      // Barra dorada/secundaria decorativa
      doc.rect(50, 120, pageWidth, 4).fill(AZUL_SECUNDARIO)

      doc
        .fillColor(BLANCO)
        .font('Helvetica-Bold')
        .fontSize(14)
        .text('ESCUELA COEDUCACIONAL N° 1 EL SALVADOR', 65, 55, { width: pageWidth - 30 })

      doc
        .font('Helvetica')
        .fontSize(8.5)
        .text('RBD: 9876-5  |  Dependencia: Municipal  |  Comuna: El Salvador, Región de Atacama', 65, 73)
        .text('Unidad de Convivencia Escolar y Mediación Formativa — SIGA Escolar', 65, 87)

      const fechaEmision = new Date().toLocaleDateString('es-CL', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })

      doc
        .fontSize(8)
        .text(`Fecha de emisión: ${fechaEmision}`, 65, 102)

      // Folio en el extremo derecho del membrete
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .text(`FOLIO: ${mediacion.folio || 'EN TRÁMITE'}`, 330, 100, {
          width: pageWidth - 340 + 50,
          align: 'right',
        })

      doc.y = 138

      // =======================================================================
      // 2. TÍTULO DEL DOCUMENTO
      // =======================================================================
      doc
        .fillColor(AZUL_INSTITUCIONAL)
        .font('Helvetica-Bold')
        .fontSize(13)
        .text('ACTA OFICIAL DE ACUERDOS Y MEDIACIÓN ESCOLAR', { align: 'center' })

      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor(GRIS_TEXTO)
        .text('Procedimiento de Diálogo Restaurativo y Resolución Pacífica de Conflictos', {
          align: 'center',
        })

      doc.moveDown(0.8)

      // =======================================================================
      // 3. FICHA TÉCNICA DE LA SESIÓN DE MEDIACIÓN (CRITERIO 2)
      // =======================================================================
      const mediadorNombre = mediacion.usuarios
        ? `${mediacion.usuarios.nombre || ''} ${mediacion.usuarios.apellido || ''}`.trim()
        : 'Encargado/a de Convivencia Escolar'

      const fechaSesion = mediacion.fecha_programada
        ? new Date(mediacion.fecha_programada).toLocaleDateString('es-CL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'No especificada'

      const fechaSeguimiento = mediacion.fecha_seguimiento
        ? new Date(mediacion.fecha_seguimiento).toLocaleDateString('es-CL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })
        : 'Por coordinar'

      const yFicha = doc.y
      doc.rect(50, yFicha, pageWidth, 50).fillAndStroke(GRIS_FONDO, GRIS_BORDE)

      doc.fillColor(TEXTO_OSCURO).fontSize(8)
      doc.font('Helvetica-Bold').text('Mediador/a a Cargo:', 60, yFicha + 8)
      doc.font('Helvetica').text(mediadorNombre, 160, yFicha + 8)

      doc.font('Helvetica-Bold').text('Fecha / Hora Sesión:', 310, yFicha + 8)
      doc.font('Helvetica').text(fechaSesion, 410, yFicha + 8)

      doc.font('Helvetica-Bold').text('Lugar de la Sesión:', 60, yFicha + 22)
      doc.font('Helvetica').text(mediacion.lugar_sesion || 'Oficina de Convivencia Escolar', 160, yFicha + 22)

      doc.font('Helvetica-Bold').text('Estado del Proceso:', 310, yFicha + 22)
      doc.font('Helvetica-Bold').fillColor(AZUL_SECUNDARIO).text((mediacion.estado || 'programada').toUpperCase(), 410, yFicha + 22)

      doc.fillColor(TEXTO_OSCURO)
      doc.font('Helvetica-Bold').text('Fecha de Seguimiento:', 60, yFicha + 36)
      doc.font('Helvetica').text(fechaSeguimiento, 160, yFicha + 36)

      doc.font('Helvetica-Bold').text('Tipo de Origen:', 310, yFicha + 36)
      doc.font('Helvetica').text((mediacion.tipo_origen || 'preventiva_convivencia').replace(/_/g, ' '), 410, yFicha + 36)

      doc.y = yFicha + 58

      // =======================================================================
      // 4. PARTICIPANTES INVOLUCRADOS (TABLA)
      // =======================================================================
      doc
        .fillColor(AZUL_INSTITUCIONAL)
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .text('1. PARTICIPANTES DE LA MEDIACIÓN')

      doc.moveDown(0.3)

      const participantes = mediacion.mediacion_participantes || []
      const yPartHead = doc.y

      doc.rect(50, yPartHead, pageWidth, 16).fill(AZUL_INSTITUCIONAL)
      doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(7.5)
      doc.text('Estudiante Participante', 55, yPartHead + 4, { width: 155 })
      doc.text('RUT', 215, yPartHead + 4, { width: 65 })
      doc.text('Curso', 285, yPartHead + 4, { width: 65 })
      doc.text('Rol en Mediación', 355, yPartHead + 4, { width: 85 })
      doc.text('Aviso Apoderado', 445, yPartHead + 4, { width: 95 })

      let yRowPart = yPartHead + 16

      if (participantes.length === 0) {
        doc.rect(50, yRowPart, pageWidth, 16).fillAndStroke(BLANCO, GRIS_BORDE)
        doc.fillColor(GRIS_TEXTO).font('Helvetica-Oblique').fontSize(7.5)
        doc.text('Sin registro de estudiantes participantes.', 60, yRowPart + 4)
        yRowPart += 16
      } else {
        participantes.forEach((p, index) => {
          const bg = index % 2 === 0 ? BLANCO : GRIS_FONDO
          doc.rect(50, yRowPart, pageWidth, 18).fillAndStroke(bg, GRIS_BORDE)

          const est = p.estudiantes || {}
          const nombreCompleto = `${est.nombre || ''} ${est.apellido || ''}`.trim() || 'Estudiante'
          const rut = est.rut || 'No informado'
          const curso = est.cursos?.nombre || 'Sin curso'
          const rol = MAPA_ROLES_PARTICIPANTE[p.rol_participante] || p.rol_participante || 'Parte'
          const aviso = p.aviso_apoderado_enviado ? 'Notificado' : 'Pendiente'

          doc.fillColor(TEXTO_OSCURO).font('Helvetica').fontSize(7.5)
          doc.text(nombreCompleto, 55, yRowPart + 5, { width: 155, ellipsis: true })
          doc.text(rut, 215, yRowPart + 5, { width: 65 })
          doc.text(curso, 285, yRowPart + 5, { width: 65 })
          doc.text(rol, 355, yRowPart + 5, { width: 85 })
          doc.font('Helvetica-Bold').fillColor(p.aviso_apoderado_enviado ? '#16a34a' : '#d97706')
          doc.text(aviso, 445, yRowPart + 5, { width: 95 })

          yRowPart += 18
        })
      }

      doc.y = yRowPart + 10

      // =======================================================================
      // 5. MOTIVO Y ANTECEDENTES
      // =======================================================================
      doc
        .fillColor(AZUL_INSTITUCIONAL)
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .text('2. MOTIVO Y ANTECEDENTES DEL CONFLICTO')

      doc.moveDown(0.2)
      doc
        .fillColor(TEXTO_OSCURO)
        .font('Helvetica')
        .fontSize(8)
        .text(mediacion.motivo || 'Sin observaciones previas registradas.', {
          width: pageWidth,
          align: 'justify',
          lineGap: 2,
        })

      doc.moveDown(0.8)

      // =======================================================================
      // 6. TABLA OFICIAL DE ACUERDOS Y COMPROMISOS FORMATIVOS (CRITERIO 2)
      // =======================================================================
      // Verificar espacio en página
      if (doc.y > doc.page.height - 200) {
        doc.addPage()
      }

      doc
        .fillColor(AZUL_INSTITUCIONAL)
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .text('3. ACUERDOS Y COMPROMISOS FORMATIVOS PACTADOS')

      doc.moveDown(0.3)

      const compromisos = mediacion.mediacion_compromisos || []
      const yCompHead = doc.y

      doc.rect(50, yCompHead, pageWidth, 16).fill(AZUL_INSTITUCIONAL)
      doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(7.5)
      doc.text('#', 55, yCompHead + 4, { width: 15 })
      doc.text('Estudiante / Parte', 75, yCompHead + 4, { width: 105 })
      doc.text('Tipo de Compromiso', 185, yCompHead + 4, { width: 95 })
      doc.text('Detalle del Acuerdo Formativo', 285, yCompHead + 4, { width: 145 })
      doc.text('Fecha Límite', 435, yCompHead + 4, { width: 60 })

      let yRowComp = yCompHead + 16

      if (compromisos.length === 0) {
        doc.rect(50, yRowComp, pageWidth, 20).fillAndStroke(BLANCO, GRIS_BORDE)
        doc.fillColor(GRIS_TEXTO).font('Helvetica-Oblique').fontSize(7.5)
        doc.text('A la fecha de emisión de esta acta, no se han registrado compromisos firmes en el expediente.', 60, yRowComp + 6)
        yRowComp += 20
      } else {
        compromisos.forEach((c, index) => {
          // Altura estimada según la extensión de la descripción
          const desc = c.descripcion || ''
          const lineas = Math.ceil(desc.length / 38)
          const rowHeight = Math.max(22, 12 + lineas * 9)

          if (yRowComp + rowHeight > doc.page.height - 150) {
            doc.addPage()
            yRowComp = 50
          }

          const bg = index % 2 === 0 ? BLANCO : GRIS_FONDO
          doc.rect(50, yRowComp, pageWidth, rowHeight).fillAndStroke(bg, GRIS_BORDE)

          // Buscar nombre del estudiante vinculado al compromiso si existe
          let nombreEstudianteComp = 'Ambas partes / Mutuo'
          if (c.estudiante_id) {
            const encontrado = participantes.find((p) => p.estudiante_id === c.estudiante_id)
            if (encontrado && encontrado.estudiantes) {
              nombreEstudianteComp = `${encontrado.estudiantes.nombre || ''} ${encontrado.estudiantes.apellido || ''}`.trim()
            }
          }

          const tipoCompLabel = MAPA_TIPOS_COMPROMISO[c.tipo_compromiso] || c.tipo_compromiso || 'Compromiso'
          const fechaLim = c.fecha_limite || 'Por definir'

          doc.fillColor(TEXTO_OSCURO).font('Helvetica-Bold').fontSize(7.5)
          doc.text(`${index + 1}`, 55, yRowComp + 5, { width: 15 })

          doc.font('Helvetica').fontSize(7)
          doc.text(nombreEstudianteComp, 75, yRowComp + 5, { width: 105, ellipsis: true })
          doc.font('Helvetica-Bold').text(tipoCompLabel, 185, yRowComp + 5, { width: 95 })
          doc.font('Helvetica').text(desc, 285, yRowComp + 5, { width: 145, align: 'left', lineGap: 1.5 })
          doc.font('Helvetica-Bold').fillColor(AZUL_SECUNDARIO).text(fechaLim, 435, yRowComp + 5, { width: 60 })

          yRowComp += rowHeight
        })
      }

      doc.y = yRowComp + 12

      // =======================================================================
      // 7. CLÁUSULA LEGAL NORMATIVA (CRITERIO 3: SUPERINTENDENCIA Y RICE)
      // =======================================================================
      if (doc.y > doc.page.height - 180) {
        doc.addPage()
      }

      const yClausula = doc.y
      const altoClausula = 50
      doc.rect(50, yClausula, pageWidth, altoClausula).fillAndStroke('#eff6ff', '#bfdbfe')

      doc.fillColor(AZUL_INSTITUCIONAL).font('Helvetica-Bold').fontSize(7.5)
      doc.text('DECLARACIÓN DE VALIDEZ Y CLÁUSULA LEGAL FORMATIVA (CIRCULAR N° 482 / LEY N° 20.370)', 60, yClausula + 6)

      doc.fillColor(TEXTO_OSCURO).font('Helvetica').fontSize(6.8)
      doc.text(
        'La presente Acta de Mediación se suscribe conforme a la Circular N° 482 de la Superintendencia de Educación, la Ley N° 20.370 General de Educación y el Reglamento Interno y de Convivencia Escolar (RICE) de la Escuela Coeducacional N° 1 El Salvador. Las partes intervinientes declaran haber participado en forma voluntaria, informada y bajo estricto principio de confidencialidad y enfoque restaurativo. Los compromisos asumidos tienen carácter vinculante y formativo con el propósito de restituir la sana convivencia y el respeto mutuo, resguardando la dignidad y el interés superior de los estudiantes, sin constituir sanción disciplinaria punitiva.',
        60,
        yClausula + 17,
        { width: pageWidth - 20, align: 'justify', lineGap: 1.5 }
      )

      doc.y = yClausula + altoClausula + 15

      // =======================================================================
      // 8. CUADRANTES PARA FIRMAS DIGITALES Y MANUSCRITAS (CRITERIO 4)
      // =======================================================================
      if (doc.y > doc.page.height - 150) {
        doc.addPage()
      }

      doc
        .fillColor(AZUL_INSTITUCIONAL)
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .text('4. FIRMAS DE RATIFICACIÓN Y CONFORMIDAD')

      doc.moveDown(0.5)

      const yFirmas = doc.y + 10
      const anchoCuadrante = 145
      const altoCuadrante = 65

      // 1. Firma Mediador/a
      doc.rect(50, yFirmas, anchoCuadrante, altoCuadrante).strokeColor(GRIS_BORDE).stroke()
      doc.strokeColor(GRIS_TEXTO).lineWidth(0.8).moveTo(60, yFirmas + 42).lineTo(50 + anchoCuadrante - 10, yFirmas + 42).stroke()
      doc.fillColor(TEXTO_OSCURO).font('Helvetica-Bold').fontSize(6.5)
      doc.text(mediadorNombre, 55, yFirmas + 45, { width: anchoCuadrante - 10, align: 'center' })
      doc.font('Helvetica').fontSize(5.5).fillColor(GRIS_TEXTO)
      doc.text('Encargado(a) de Mediación / Convivencia', 55, yFirmas + 54, { width: anchoCuadrante - 10, align: 'center' })

      // 2. Firma Estudiante Parte 1
      const part1 = participantes[0] || {}
      const nombreP1 = part1.estudiantes ? `${part1.estudiantes.nombre || ''} ${part1.estudiantes.apellido || ''}`.trim() : 'Estudiante Parte 1'
      const rutP1 = part1.estudiantes?.rut || ''

      doc.rect(225, yFirmas, anchoCuadrante, altoCuadrante).strokeColor(GRIS_BORDE).stroke()
      doc.strokeColor(GRIS_TEXTO).lineWidth(0.8).moveTo(235, yFirmas + 42).lineTo(225 + anchoCuadrante - 10, yFirmas + 42).stroke()
      doc.fillColor(TEXTO_OSCURO).font('Helvetica-Bold').fontSize(6.5)
      doc.text(nombreP1, 230, yFirmas + 45, { width: anchoCuadrante - 10, align: 'center' })
      doc.font('Helvetica').fontSize(5.5).fillColor(GRIS_TEXTO)
      doc.text(`RUT: ${rutP1} | Estudiante Convocado/a`, 230, yFirmas + 54, { width: anchoCuadrante - 10, align: 'center' })

      // 3. Firma Estudiante Parte 2
      const part2 = participantes[1] || {}
      const nombreP2 = part2.estudiantes ? `${part2.estudiantes.nombre || ''} ${part2.estudiantes.apellido || ''}`.trim() : 'Estudiante Parte 2'
      const rutP2 = part2.estudiantes?.rut || ''

      doc.rect(400, yFirmas, anchoCuadrante, altoCuadrante).strokeColor(GRIS_BORDE).stroke()
      doc.strokeColor(GRIS_TEXTO).lineWidth(0.8).moveTo(410, yFirmas + 42).lineTo(400 + anchoCuadrante - 10, yFirmas + 42).stroke()
      doc.fillColor(TEXTO_OSCURO).font('Helvetica-Bold').fontSize(6.5)
      doc.text(nombreP2, 405, yFirmas + 45, { width: anchoCuadrante - 10, align: 'center' })
      doc.font('Helvetica').fontSize(5.5).fillColor(GRIS_TEXTO)
      doc.text(`RUT: ${rutP2} | Estudiante Convocado/a`, 405, yFirmas + 54, { width: anchoCuadrante - 10, align: 'center' })

      // =======================================================================
      // 9. PIE DE PÁGINA INMUTABLE CON HASH SHA-256 (CRITERIO 4)
      // =======================================================================
      const range = doc.bufferedPageRange()
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i)

        // Línea divisoria inferior
        doc
          .strokeColor(GRIS_BORDE)
          .lineWidth(0.5)
          .moveTo(50, doc.page.height - 40)
          .lineTo(50 + pageWidth, doc.page.height - 40)
          .stroke()

        doc
          .fillColor(GRIS_TEXTO)
          .font('Helvetica-Bold')
          .fontSize(6)
          .text(
            `ESCUELA COEDUCACIONAL N° 1 EL SALVADOR (RBD 9876-5) | FOLIO OFICIAL: ${mediacion.folio || 'S-F'} | PÁGINA ${i + 1} DE ${range.count}`,
            50,
            doc.page.height - 35,
            { width: pageWidth, align: 'center' }
          )

        doc
          .font('Helvetica')
          .fontSize(5.5)
          .text(
            `Hash SHA-256 de Autenticidad Inmutable: ${hashInmutable} | Conforme a Ley N° 19.628 de Protección de Datos Personales`,
            50,
            doc.page.height - 25,
            { width: pageWidth, align: 'center' }
          )
      }

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}

module.exports = {
  generarActaMediacionPDF,
  calcularHashMediacion,
  MAPA_TIPOS_COMPROMISO,
  MAPA_ROLES_PARTICIPANTE,
}
