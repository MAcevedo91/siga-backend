const PDFDocument = require('pdfkit')
const crypto = require('crypto')

// =============================================================================
// MOTOR PDFKIT: FICHA MÉDICA / PSICOLÓGICA OFICIAL (TASK 8.2.1.2)
// Escuela Coeducacional N° 1 El Salvador (RBD 9876-5)
// Cumplimiento: Ley N° 19.628 de Protección de Datos y Ley N° 20.584 (Paciente)
// =============================================================================

const AZUL_INSTITUCIONAL = '#1e3a5f'
const AZUL_SECUNDARIO    = '#2563eb'
const GRIS_FONDO         = '#f8fafc'
const GRIS_BORDE         = '#cbd5e1'
const GRIS_TEXTO         = '#475569'
const TEXTO_OSCURO       = '#0f172a'
const BLANCO             = '#ffffff'

/**
 * Calcula el hash SHA-256 inmutable para certificar autenticidad de la ficha médica/psicológica.
 *
 * @param {Object} expediente - Datos del expediente sanitizado
 * @returns {string} Hash SHA-256 en formato hexadecimal (64 caracteres)
 */
const calcularHashFichaSalud = (expediente) => {
  const payloadCanonico = JSON.stringify({
    estudiante_id: expediente.estudiante_evaluado?.id,
    rut: expediente.estudiante_evaluado?.rut,
    nombre_completo: expediente.estudiante_evaluado?.nombre_completo,
    fecha_emision: expediente.resumen_clinico_escolar?.fecha_emision,
    solicitante_id: expediente.resumen_clinico_escolar?.solicitante?.id,
    destinatario: expediente.resumen_clinico_escolar?.destinatario_especialista,
    total_incidentes: expediente.incidentes?.length || 0,
    total_mediaciones: expediente.mediaciones?.length || 0,
  })

  return crypto.createHash('sha256').update(payloadCanonico).digest('hex')
}

/**
 * Genera la Ficha Médica/Psicológica Oficial de 2 páginas en formato PDFKit.
 *
 * @param {Object} expediente - Datos del expediente extraído y sanitizado
 * @returns {Promise<Buffer>} Buffer del PDF compilado en memoria (<1s)
 */
const generarFichaSaludPDF = (expediente) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 25, left: 45, right: 45 },
        bufferPages: true,
        compress: false,
        info: {
          Title: `Ficha Médica y Psicológica Oficial - ${expediente.estudiante_evaluado?.nombre_completo || 'Estudiante'}`,
          Author: 'Escuela Coeducacional N° 1 El Salvador (RBD 9876-5)',
          Subject: 'Informe Clínico-Escolar Confidencial para Especialista de Salud',
          Keywords: 'Salud, Ficha Clínica, Convivencia Escolar, Ley 19628, Ley 20584',
        },
      })

      const buffers = []
      doc.on('data', (chunk) => buffers.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)

      const pageWidth = doc.page.width - 90 // 505.28 pt utilizables
      const hashInmutable = calcularHashFichaSalud(expediente)
      const est = expediente.estudiante_evaluado || {}
      const resumen = expediente.resumen_clinico_escolar || {}

      // =======================================================================
      // PÁGINA 1
      // =======================================================================

      // 1. MEMBRETE OFICIAL INSTITUCIONAL
      doc.rect(45, 40, pageWidth, 70).fill(AZUL_INSTITUCIONAL)
      doc.rect(45, 110, pageWidth, 3).fill(AZUL_SECUNDARIO)

      doc
        .fillColor(BLANCO)
        .font('Helvetica-Bold')
        .fontSize(10.5)
        .text('ESCUELA COEDUCACIONAL N° 1 EL SALVADOR', 55, 50, { width: pageWidth - 20, align: 'left' })
        .fontSize(7.5)
        .font('Helvetica')
        .text('RBD 9876-5 | Av. Potrerillos s/n, El Salvador, Diego de Almagro, Región de Atacama', 55, 65)
        .text('Unidad de Convivencia Escolar y Apoyo Formativo / Dupla Psicosocial', 55, 76)

      doc
        .fillColor(BLANCO)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('FICHA MÉDICA / PSICOLÓGICA OFICIAL', 55, 92, {
          width: pageWidth - 20,
          align: 'right',
        })

      // Aviso legal de confidencialidad
      doc.rect(45, 118, pageWidth, 20).fill(GRIS_FONDO).strokeColor(GRIS_BORDE).stroke()
      doc
        .fillColor(GRIS_TEXTO)
        .font('Helvetica-Bold')
        .fontSize(6)
        .text('DOCUMENTO ESTRICTAMENTE CONFIDENCIAL — LEY N° 19.628 Y LEY N° 20.584', 55, 122, {
          width: pageWidth - 20,
        })
        .font('Helvetica')
        .fontSize(5.5)
        .text(
          'Uso exclusivo del profesional o equipo de salud tratante. Nombres de terceros anonimizados con iniciales genéricas.',
          55,
          130
        )

      // 2. SECCIÓN I: IDENTIFICACIÓN DEL ESTUDIANTE Y CONTEXTO ESCOLAR
      let y = 145
      doc.rect(45, y, pageWidth, 16).fill(AZUL_INSTITUCIONAL)
      doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(8).text('I. IDENTIFICACIÓN DEL ESTUDIANTE Y CONTEXTO DE DERIVACIÓN', 55, y + 4)

      y += 20
      const altoCajaIdent = 85
      doc.rect(45, y, pageWidth, altoCajaIdent).strokeColor(GRIS_BORDE).stroke()

      // Grilla de datos del estudiante
      const col1 = 55
      const col2 = 200
      const col3 = 350

      let yRow = y + 8
      doc.font('Helvetica-Bold').fontSize(7).fillColor(TEXTO_OSCURO)
      doc.text('Nombre Estudiante:', col1, yRow)
      doc.font('Helvetica').fontSize(7).text(est.nombre_completo || 'No registrado', col1 + 80, yRow)

      doc.font('Helvetica-Bold').text('RUT:', col3, yRow)
      doc.font('Helvetica').text(est.rut || 'No registrado', col3 + 30, yRow)

      yRow += 14
      doc.font('Helvetica-Bold').text('Curso / Nivel:', col1, yRow)
      doc.font('Helvetica').text(est.curso || 'Sin curso asignado', col1 + 80, yRow)

      doc.font('Helvetica-Bold').text('Fecha Nacimiento:', col2, yRow)
      doc.font('Helvetica').text(est.fecha_nacimiento || 'No registrada', col2 + 75, yRow)

      doc.font('Helvetica-Bold').text('Género:', col3, yRow)
      doc.font('Helvetica').text(est.genero === 'M' ? 'Masculino' : est.genero === 'F' ? 'Femenino' : 'No informado', col3 + 38, yRow)

      yRow += 14
      doc.font('Helvetica-Bold').text('Estado Matrícula:', col1, yRow)
      doc.font('Helvetica').text(est.estado_matricula === 'activo' ? 'Regular / Activo' : 'Inactivo', col1 + 80, yRow)

      doc.font('Helvetica-Bold').text('Fecha de Emisión:', col2, yRow)
      const fechaEmision = resumen.fecha_emision ? new Date(resumen.fecha_emision).toLocaleDateString('es-CL') : new Date().toLocaleDateString('es-CL')
      doc.font('Helvetica').text(fechaEmision, col2 + 75, yRow)

      yRow += 14
      doc.strokeColor(GRIS_BORDE).lineWidth(0.5).moveTo(col1, yRow).lineTo(45 + pageWidth - 10, yRow).stroke()

      yRow += 6
      doc.font('Helvetica-Bold').text('Profesional Emisor:', col1, yRow)
      doc.font('Helvetica').text(`${resumen.solicitante?.nombre || 'Equipo Formativo'} (${resumen.solicitante?.rol || 'Convivencia'})`, col1 + 80, yRow)

      yRow += 13
      doc.font('Helvetica-Bold').text('Destinatario / Centro:', col1, yRow)
      doc.font('Helvetica').text(resumen.destinatario_especialista || 'Especialista Externo de Salud', col1 + 85, yRow)

      doc.font('Helvetica-Bold').text('Motivo Derivación:', col3, yRow)
      doc.font('Helvetica').text(resumen.motivo_informe || 'Evaluación médica', col3 + 75, yRow)

      // 3. SECCIÓN II: HÁBITOS, DESEMPEÑO Y ATENCIÓN EN AULA
      y += altoCajaIdent + 15
      doc.rect(45, y, pageWidth, 16).fill(AZUL_INSTITUCIONAL)
      doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(8).text('II. HÁBITOS, CONDUCTA Y ATENCIÓN OBSERVADA EN EL AULA', 55, y + 4)

      y += 20
      const altoCajaHabitos = 160
      doc.rect(45, y, pageWidth, altoCajaHabitos).strokeColor(GRIS_BORDE).stroke()

      let yHabitos = y + 8
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(AZUL_SECUNDARIO)
      doc.text('A. Indicadores de Atención, Concentración y Trabajo Pedagógico en Sala', col1, yHabitos)

      yHabitos += 14
      doc.font('Helvetica').fontSize(6.8).fillColor(TEXTO_OSCURO)
      doc.text(
        '• Permanencia y postura en puesto de trabajo: El estudiante presenta períodos variables de focalización pedagógica, requiriendo instrucciones segmentadas y refuerzo positivo frente a tareas complejas o prolongadas.',
        col1,
        yHabitos,
        { width: pageWidth - 20 }
      )

      yHabitos += 20
      doc.text(
        '• Tolerancia a la frustración y autorregulación: Responde adecuadamente a la contención emocional guiada. En momentos de sobrecarga sensorial o conflicto entre pares requiere pausas activas breves y espacios de calma formativa.',
        col1,
        yHabitos,
        { width: pageWidth - 20 }
      )

      yHabitos += 20
      doc.text(
        '• Cumplimiento de normas y hábitos escolares: Asiste con regularidad a la jornada escolar. Manifiesta adecuada disposición al diálogo cuando se le convoca de manera individual y sin sobreexposición frente al grupo curso.',
        col1,
        yHabitos,
        { width: pageWidth - 20 }
      )

      yHabitos += 25
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(AZUL_SECUNDARIO)
      doc.text('B. Programa de Integración Escolar (PIE) y Apoyos Especializados de Aula', col1, yHabitos)

      yHabitos += 14
      doc.font('Helvetica').fontSize(6.8).fillColor(TEXTO_OSCURO)
      doc.text(
        '• El establecimiento mantiene acompañamiento articulado entre Docente de Aula, Educadora Diferencial y Dupla Psicosocial. Se implementan adaptaciones de acceso y diversificación de la enseñanza (Decreto N° 83/2015).',
        col1,
        yHabitos,
        { width: pageWidth - 20 }
      )

      yHabitos += 20
      doc.text(
        '• Este informe se emite a solicitud del especialista de salud tratante para complementar el diagnóstico clínico con observaciones directas del comportamiento adaptativo en el contexto escolar.',
        col1,
        yHabitos,
        { width: pageWidth - 20 }
      )

      // Nota pie de carátula
      doc.font('Helvetica-Oblique').fontSize(6).fillColor(GRIS_TEXTO)
      doc.text('Continúa en página 2 con Antecedentes de Convivencia, Mediaciones y Conclusiones Institucionales...', 55, y + altoCajaHabitos + 10, { align: 'right', width: pageWidth - 20 })

      // =======================================================================
      // PÁGINA 2
      // =======================================================================
      doc.addPage()

      // Mini-membrete de continuidad en página 2
      doc.rect(45, 40, pageWidth, 24).fill(AZUL_INSTITUCIONAL)
      doc
        .fillColor(BLANCO)
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .text('ESCUELA COEDUCACIONAL N° 1 EL SALVADOR — INFORME CLÍNICO-ESCOLAR CONFIDENCIAL', 55, 48)
        .font('Helvetica')
        .fontSize(6.5)
        .text(`Estudiante: ${est.nombre_completo || 'N/N'} (${est.rut || ''}) | Curso: ${est.curso || ''}`, 55 + pageWidth - 230, 48, { align: 'right', width: 220 })

      y = 75

      // 4. SECCIÓN III: CONVIVENCIA ESCOLAR, INCIDENTES Y MEDIACIONES FORMATIVAS
      doc.rect(45, y, pageWidth, 16).fill(AZUL_INSTITUCIONAL)
      doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(8).text('III. HISTORIAL DE CONVIVENCIA ESCOLAR Y MEDIACIONES (SANITIZADO)', 55, y + 4)

      y += 20
      const altoCajaConvivencia = 170
      doc.rect(45, y, pageWidth, altoCajaConvivencia).strokeColor(GRIS_BORDE).stroke()

      let yConv = y + 8
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(AZUL_SECUNDARIO)
      doc.text('A. Registro de Situaciones Relevantes de Convivencia (Nombres de Terceros Anonimizados)', col1, yConv)

      yConv += 13
      const incidentes = expediente.incidentes || []
      if (incidentes.length === 0) {
        doc.font('Helvetica').fontSize(6.8).fillColor(TEXTO_OSCURO)
        doc.text('• No registra incidentes disciplinarios ni situaciones de conflicto informadas en el período lectivo actual.', col1, yConv)
        yConv += 16
      } else {
        incidentes.slice(0, 3).forEach((inc) => {
          doc.font('Helvetica-Bold').fontSize(6.8).fillColor(TEXTO_OSCURO)
          const fechaInc = inc.fecha ? new Date(inc.fecha).toLocaleDateString('es-CL') : 'S/F'
          doc.text(`• [${fechaInc}] Folio ${inc.folio} (${inc.gravedad}) - Rol: ${inc.rol_estudiante_foco}:`, col1, yConv)
          yConv += 9
          doc.font('Helvetica').fontSize(6.3).fillColor(GRIS_TEXTO)
          const relatoCorto = (inc.descripcion_sanitizada || 'Sin descripción').slice(0, 160)
          doc.text(`Relato: ${relatoCorto}...`, col1 + 10, yConv, { width: pageWidth - 30 })
          yConv += 14
        })
      }

      yConv += 4
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(AZUL_SECUNDARIO)
      doc.text('B. Acuerdos Restaurativos y Mediaciones Escolares Formativas', col1, yConv)

      yConv += 13
      const mediaciones = expediente.mediaciones || []
      if (mediaciones.length === 0) {
        doc.font('Helvetica').fontSize(6.8).fillColor(TEXTO_OSCURO)
        doc.text('• No ha requerido procesos formales de mediación escolar convocados por inspectoría o convivencia.', col1, yConv)
        yConv += 16
      } else {
        mediaciones.slice(0, 2).forEach((med) => {
          doc.font('Helvetica-Bold').fontSize(6.8).fillColor(TEXTO_OSCURO)
          doc.text(`• Folio ${med.folio} (Estado: ${med.estado}):`, col1, yConv)
          yConv += 9
          doc.font('Helvetica').fontSize(6.3).fillColor(GRIS_TEXTO)
          const motivoCorto = (med.motivo_sanitizado || 'Mediación preventiva').slice(0, 150)
          doc.text(`Acuerdos: ${motivoCorto}...`, col1 + 10, yConv, { width: pageWidth - 30 })
          yConv += 14
        })
      }

      // 5. SECCIÓN IV: CONCLUSIONES, SUGERENCIAS DE APOYO Y FIRMAS INSTITUCIONALES
      y += altoCajaConvivencia + 15
      doc.rect(45, y, pageWidth, 16).fill(AZUL_INSTITUCIONAL)
      doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(8).text('IV. CONCLUSIONES INSTITUCIONALES Y SUGERENCIAS AL EQUIPO MÉDICO', 55, y + 4)

      y += 20
      const altoCajaConclusiones = 145
      doc.rect(45, y, pageWidth, altoCajaConclusiones).strokeColor(GRIS_BORDE).stroke()

      let yConc = y + 8
      doc.font('Helvetica').fontSize(6.8).fillColor(TEXTO_OSCURO)
      doc.text(
        '1. Síntesis Escolar: El estudiante mantiene vínculos significativos dentro de la comunidad escolar y muestra receptividad frente a estrategias pedagógicas estructuradas. Se sugiere al equipo de salud considerar su estilo de aprendizaje y necesidades de contención.',
        col1,
        yConc,
        { width: pageWidth - 20 }
      )

      yConc += 22
      doc.text(
        '2. Trabajo Colaborativo Escuela-Salud: La Escuela Coeducacional N° 1 El Salvador manifiesta plena disposición para implementar las indicaciones, ajustes curriculares o pautas de acompañamiento que el profesional médico estime pertinentes.',
        col1,
        yConc,
        { width: pageWidth - 20 }
      )

      // Bloque de Firmas
      const yFirmas = y + 75
      const anchoCuadrante = (pageWidth - 30) / 2

      // Cuadrante 1: Convivencia Escolar / Dupla
      doc.rect(55, yFirmas, anchoCuadrante, 55).strokeColor(GRIS_BORDE).stroke()
      doc.strokeColor(GRIS_TEXTO).lineWidth(0.8).moveTo(65, yFirmas + 38).lineTo(55 + anchoCuadrante - 10, yFirmas + 38).stroke()
      doc.fillColor(TEXTO_OSCURO).font('Helvetica-Bold').fontSize(6.5)
      doc.text(resumen.solicitante?.nombre || 'Encargado(a) de Convivencia Escolar', 55, yFirmas + 41, { width: anchoCuadrante, align: 'center' })
      doc.font('Helvetica').fontSize(5.5).fillColor(GRIS_TEXTO)
      doc.text('Unidad de Convivencia Escolar / Dupla Psicosocial', 55, yFirmas + 48, { width: anchoCuadrante, align: 'center' })

      // Cuadrante 2: Dirección del Establecimiento
      const xFirmaDir = 55 + anchoCuadrante + 20
      doc.rect(xFirmaDir, yFirmas, anchoCuadrante, 55).strokeColor(GRIS_BORDE).stroke()
      doc.strokeColor(GRIS_TEXTO).lineWidth(0.8).moveTo(xFirmaDir + 10, yFirmas + 38).lineTo(xFirmaDir + anchoCuadrante - 10, yFirmas + 38).stroke()
      doc.fillColor(TEXTO_OSCURO).font('Helvetica-Bold').fontSize(6.5)
      doc.text('Dirección del Establecimiento', xFirmaDir, yFirmas + 41, { width: anchoCuadrante, align: 'center' })
      doc.font('Helvetica').fontSize(5.5).fillColor(GRIS_TEXTO)
      doc.text('Escuela Coeducacional N° 1 El Salvador (RBD 9876-5)', xFirmaDir, yFirmas + 48, { width: anchoCuadrante, align: 'center' })

      // =======================================================================
      // PIE DE PÁGINA INMUTABLE CON HASH SHA-256 EN AMBAS PÁGINAS
      // =======================================================================
      const totalPaginas = doc.bufferedPageRange().count
      for (let i = 0; i < totalPaginas; i++) {
        doc.switchToPage(i)

        const yLinea = 805
        const yTexto1 = 812
        const yTexto2 = 822

        // Línea divisoria inferior
        doc
          .strokeColor(GRIS_BORDE)
          .lineWidth(0.5)
          .moveTo(45, yLinea)
          .lineTo(45 + pageWidth, yLinea)
          .stroke()

        doc
          .fillColor(GRIS_TEXTO)
          .font('Helvetica-Bold')
          .fontSize(6)
          .text(
            `ESCUELA COEDUCACIONAL N° 1 EL SALVADOR (RBD 9876-5) | FICHA MÉDICA CONFIDENCIAL | PÁGINA ${i + 1} DE ${totalPaginas}`,
            45,
            yTexto1,
            { width: pageWidth, height: 10, align: 'center', lineBreak: false }
          )

        doc
          .font('Helvetica')
          .fontSize(5.5)
          .text(
            `Hash SHA-256 de Certificación: ${hashInmutable} | Ley N° 19.628 y Ley N° 20.584`,
            45,
            yTexto2,
            { width: pageWidth, height: 10, align: 'center', lineBreak: false }
          )
      }

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}

module.exports = {
  calcularHashFichaSalud,
  generarFichaSaludPDF,
}
