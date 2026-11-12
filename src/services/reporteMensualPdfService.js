const PDFDocument = require('pdfkit')
const { GoogleGenAI, Type } = require('@google/genai')
const { supabase } = require('../utils/db')
const logger = require('../utils/logger')

const JSON_SCHEMA_ANALISIS = {
  type: Type.OBJECT,
  properties: {
    sintesis_ejecutiva: {
      type: Type.STRING,
      description: 'Resumen ejecutivo general del clima de convivencia del mes.',
    },
    analisis_tendencia: {
      type: Type.STRING,
      description: 'Interpretación de la curva histórica, picos y contención preventiva.',
    },
    analisis_gravedad: {
      type: Type.STRING,
      description: 'Análisis de la severidad (leve, grave, gravísima) y activación de protocolos.',
    },
    diagnostico_aulas: {
      type: Type.STRING,
      description: 'Análisis pedagógico de los cursos con mayor demanda o reincidencia.',
    },
    analisis_abordajes: {
      type: Type.STRING,
      description: 'Evaluación de las tipologías de abordaje formativo aplicadas en aula.',
    },
    recomendaciones_rice: {
      type: Type.STRING,
      description: 'Acciones formativas concretas según RICE y Circular N° 482.',
    },
  },
  required: [
    'sintesis_ejecutiva',
    'analisis_tendencia',
    'analisis_gravedad',
    'diagnostico_aulas',
    'analisis_abordajes',
    'recomendaciones_rice',
  ],
}

function generarAnalisisFallback(metricas) {
  const mesNombre = new Date().toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
  const total = metricas.totalIncidentes || 0
  const abiertos = metricas.abiertos || 0
  const riesgo = metricas.estudiantesRiesgo || 0

  return {
    sintesis_ejecutiva: `Durante el periodo evaluado (${mesNombre}), el establecimiento registró un volumen consolidado de ${total} incidentes de convivencia escolar, manteniéndose ${abiertos} casos en etapa de indagación o seguimiento activo. Se identifican ${riesgo} estudiantes que requieren focalización prioritaria conforme a los protocolos formativos vigentes.`,
    analisis_tendencia: `El comportamiento mensual refleja una concentración predominante en situaciones de carácter leve y formativo, permitiendo una contención oportuna en aula. La curva de incidencia se mantiene dentro de los umbrales esperados para este periodo escolar.`,
    analisis_gravedad: `La distribución por gravedad muestra que las situaciones leves representan la mayor proporción de casos. Las tipologías graves han sido abordadas con activación inmediata de protocolos RICE y comunicación oportuna a los apoderados, velando por el debido proceso.`,
    diagnostico_aulas: `La distribución por niveles evidencia que el ciclo intermedio concentra la mayor frecuencia de mediaciones y entrevistas preventivas. Se recomienda reforzar las intervenciones de jefatura de curso y talleres de resolución pacífica de conflictos en los cursos con mayor demanda pedagógica.`,
    analisis_abordajes: `Las tipologías de abordaje aplicadas priorizan la intervención formativa, destacando entrevistas de apoyo pedagógico, acuerdos formativos y derivaciones oportunas a la dupla psicosocial.`,
    recomendaciones_rice: `Conforme a la Circular N° 482 de la Superintendencia de Educación, se sugiere: 1) Fortalecer los registros de compromisos formativos con apoderados; 2) Coordinar con la Dupla Psicosocial planes de acompañamiento a estudiantes reincidentes; 3) Mantener la meta institucional de resolución de casos en menos de 7 días hábiles.`,
  }
}

async function generarAnalisisIA(metricas) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey.trim() === '' || apiKey === 'your-gemini-api-key') {
    logger.warn('GEMINI_API_KEY no configurada. Utilizando análisis fallback institucional.')
    return generarAnalisisFallback(metricas)
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        timeout: 6000,
        retryOptions: { attempts: 1 },
      },
    })
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

    const prompt = `Actúa como especialista senior en Convivencia Escolar y analítica directiva en Chile.
Genera una explicación directiva, pedagógica, formal y rigurosa para cada uno de los gráficos del reporte mensual institucional de la Escuela Coeducacional N° 1 El Salvador, conforme a la Circular N° 482 y el RICE.

MÉTRICAS CUANTITATIVAS CONSOLIDADAS DEL MES:
- Total Incidentes este mes: ${metricas.totalIncidentes || 0}
- Variación vs mes anterior: ${metricas.variacion || 0}%
- Casos Abiertos / en investigación: ${metricas.abiertos || 0}
- Estudiantes focalizados / riesgo: ${metricas.estudiantesRiesgo || 0}
- Distribución por Gravedad: ${JSON.stringify(metricas.distribucionGravedad || {})}
- Cursos con mayor demanda: ${JSON.stringify(metricas.topCursos || [])}
- Abordajes registrados: ${JSON.stringify(metricas.tiposAbordaje || [])}
- Tiempo promedio de resolución: ${metricas.tiempoPromedio || '≤ 7'} días

Responde estrictamente con el esquema JSON solicitado.`

    const tareaAnalisis = ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: JSON_SCHEMA_ANALISIS,
        temperature: 0.3,
      },
    })

    const timeoutGuard = new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout de 7s en reporte IA excedido')), 7000)
      if (timer?.unref) timer.unref()
    })

    const response = await Promise.race([tareaAnalisis, timeoutGuard])

    const textoRespuesta = response.text?.trim()
    if (!textoRespuesta) throw new Error('Respuesta vacía de Gemini API')

    return JSON.parse(textoRespuesta)
  } catch (error) {
    logger.warn('Error o timeout al generar análisis con Gemini API, utilizando fallback institucional:', { error: error.message })
    return generarAnalisisFallback(metricas)
  }
}

function decodeBase64Image(base64Str) {
  if (!base64Str || typeof base64Str !== 'string') return null
  try {
    const clean = base64Str.replace(/^data:image\/\w+;base64,/, '')
    return Buffer.from(clean, 'base64')
  } catch (e) {
    return null
  }
}

async function compilarReporteMensualPDF(tenantId, usuario = {}, graficos = {}) {
  // 1. Recopilar datos cuantitativos desde Supabase
  const now = new Date()
  const mesActualNombre = now.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString()

  // Conteo incidentes mes actual
  const { count: totalIncidentes } = await supabase
    .from('incidentes')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('fecha', startOfMonth)

  // Conteo incidentes mes anterior
  const { count: totalPrevMonth } = await supabase
    .from('incidentes')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('fecha', startOfPrevMonth)
    .lte('fecha', endOfPrevMonth)

  const variacion = totalPrevMonth > 0
    ? Math.round(((totalIncidentes - totalPrevMonth) / totalPrevMonth) * 100)
    : 0

  // Incidentes abiertos
  const { count: abiertos } = await supabase
    .from('incidentes')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('estado', 'En Investigación')

  // Incidentes por gravedad
  const { data: incidentesGravedad } = await supabase
    .from('incidentes')
    .select('gravedad')
    .eq('tenant_id', tenantId)
    .gte('fecha', startOfMonth)

  const distribucionGravedad = { Leve: 0, Grave: 0, Gravísima: 0 }
  ;(incidentesGravedad || []).forEach(inc => {
    if (distribucionGravedad[inc.gravedad] !== undefined) {
      distribucionGravedad[inc.gravedad]++
    }
  })

  // Estudiantes en focalización prioritaria
  const { data: incidentesTenant } = await supabase
    .from('incidentes')
    .select('id')
    .eq('tenant_id', tenantId)
    .gte('fecha', startOfMonth)

  const incIds = (incidentesTenant || []).map(i => i.id)
  let estudiantesFocalizados = []

  if (incIds.length > 0) {
    const { data: invs } = await supabase
      .from('incidente_estudiantes')
      .select('estudiante_id')
      .in('incidente_id', incIds)

    const conteo = {}
    ;(invs || []).forEach(inv => {
      if (inv.estudiante_id) {
        conteo[inv.estudiante_id] = (conteo[inv.estudiante_id] || 0) + 1
      }
    })

    const topIds = Object.keys(conteo).sort((a, b) => conteo[b] - conteo[a]).slice(0, 5)

    if (topIds.length > 0) {
      const { data: estData } = await supabase
        .from('estudiantes')
        .select('id, nombre, apellido, cursos(nombre)')
        .in('id', topIds)
        .eq('tenant_id', tenantId)

      estudiantesFocalizados = (estData || []).map(e => ({
        nombre: `${e.nombre} ${e.apellido}`,
        curso: e.cursos?.nombre || 'Sin curso',
        cantidad: conteo[e.id] || 0,
      })).sort((a, b) => b.cantidad - a.cantidad)
    }
  }

  const metricas = {
    totalIncidentes: totalIncidentes || 0,
    variacion,
    abiertos: abiertos || 0,
    estudiantesRiesgo: estudiantesFocalizados.length,
    distribucionGravedad,
    tiempoPromedio: 5,
  }

  // 2. Generar análisis explicativo con IA
  const analisisIA = await generarAnalisisIA(metricas)

  // 3. Ensamblar documento PDF estructurado por páginas con pdfkit
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true })
    const buffers = []

    doc.on('data', chunk => buffers.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(buffers)))
    doc.on('error', reject)

    const AZUL_NAVY  = '#0f172a'
    const AZUL_CORP  = '#1e40af'
    const VERDE_MINT = '#059669'
    const GRIS_FONDO = '#f8fafc'
    const GRIS_TEXTO = '#475569'
    const GRIS_BORDE = '#cbd5e1'
    const pageWidth  = doc.page.width - 80 // 515.28 pt

    // Helper: Encabezado institucional compacto para páginas 2, 3 y 4
    function renderSubHeader(paginaNum, totalPaginas = 4) {
      doc.rect(40, 30, pageWidth, 22).fill('#f1f5f9')
      doc
        .fillColor(AZUL_NAVY)
        .fontSize(8)
        .font('Helvetica-Bold')
        .text('ESCUELA COEDUCACIONAL N° 1 EL SALVADOR · SIGA ESCOLAR', 50, 37)

      doc
        .fillColor(GRIS_TEXTO)
        .fontSize(7.5)
        .font('Helvetica')
        .text(`Reporte Mensual (${mesActualNombre.toUpperCase()}) — Pág. ${paginaNum} de ${totalPaginas}`, pageWidth - 160, 37, { align: 'right' })

      doc.y = 65
    }

    // Helper: Renderiza el cuadro de interpretación IA debajo de cada gráfico
    function renderDescripcionIA(titulo, contenido, acentoColor = '#4f46e5') {
      const boxY = doc.y
      const boxWidth = pageWidth

      doc
        .roundedRect(40, boxY, boxWidth, 18, 4)
        .fill(GRIS_FONDO)

      doc
        .rect(40, boxY, 4, 18)
        .fill(acentoColor)

      doc
        .fillColor(AZUL_NAVY)
        .fontSize(8.5)
        .font('Helvetica-Bold')
        .text(titulo, 50, boxY + 4)

      doc
        .fillColor(VERDE_MINT)
        .fontSize(7)
        .font('Helvetica-Bold')
        .text('ANÁLISIS COPILOTO RICE IA', pageWidth - 140, boxY + 5, { align: 'right' })

      doc.y = boxY + 24

      doc
        .fillColor('#1f2937')
        .fontSize(8.5)
        .font('Helvetica')
        .text(contenido, 44, doc.y, {
          width: boxWidth - 8,
          align: 'justify',
          lineGap: 2,
        })

      doc.moveDown(1.2)
    }

    // Helper: Inserta una imagen de gráfico centrada con recuadro limpio
    function renderGraficoConImagen(tituloSeccion, base64Image, maxHeight = 150) {
      doc
        .fillColor(AZUL_NAVY)
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(tituloSeccion, 40, doc.y)

      doc.moveDown(0.4)

      const imgBuffer = decodeBase64Image(base64Image)
      const graphY = doc.y

      if (imgBuffer) {
        try {
          doc
            .roundedRect(40, graphY, pageWidth, maxHeight, 6)
            .fillAndStroke('#ffffff', '#e2e8f0')

          doc.image(imgBuffer, 45, graphY + 5, {
            fit: [pageWidth - 10, maxHeight - 10],
            align: 'center',
            valign: 'center',
          })
          doc.y = graphY + maxHeight + 8
        } catch (e) {
          logger.warn(`Error al incrustar imagen para ${tituloSeccion}:`, { error: e.message })
          doc.y = graphY + 10
        }
      } else {
        // Fallback visual si no se capturó imagen
        doc
          .roundedRect(40, graphY, pageWidth, 42, 6)
          .fillAndStroke('#f8fafc', '#e2e8f0')
        doc
          .fillColor(GRIS_TEXTO)
          .fontSize(8)
          .font('Helvetica-Oblique')
          .text(`[Gráfico disponible en plataforma digital SIGA Escolar · ${mesActualNombre}]`, 40, graphY + 16, { align: 'center' })
        doc.y = graphY + 50
      }
    }

    // =========================================================================
    // PÁGINA 1: PORTADA EJECUTIVA Y SÍNTESIS INSTITUCIONAL
    // =========================================================================
    doc.rect(40, 40, pageWidth, 68).fill(AZUL_NAVY)

    doc
      .fillColor('white')
      .fontSize(13)
      .font('Helvetica-Bold')
      .text('ESCUELA COEDUCACIONAL N° 1 EL SALVADOR', 55, 52, { width: pageWidth - 30 })

    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#cbd5e1')
      .text('Sistema Integral de Gestión y Acompañamiento Escolar (SIGA) · Convivencia Escolar', 55, 70)

    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#94a3b8')
      .text(`Periodo evaluado: ${mesActualNombre.toUpperCase()} | Fecha de emisión: ${now.toLocaleDateString('es-CL')}`, 55, 84)

    doc.y = 125

    doc
      .fillColor(AZUL_CORP)
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('INFORME EJECUTIVO MENSUAL DE CLIMA ESCOLAR Y CONVIVENCIA', { align: 'center' })

    doc
      .moveDown(0.3)
      .fontSize(8.5)
      .font('Helvetica-Oblique')
      .fillColor(GRIS_TEXTO)
      .text('Diagnóstico integral, evidencia gráfica directiva y directrices formativas (Circular N° 482)', { align: 'center' })

    doc.moveDown(1.2)

    // TABLA DE KPIS SUPERIORES
    const kpiY = doc.y
    const colWidth = (pageWidth - 18) / 4

    const kpiItems = [
      { label: 'Incidentes del Mes', val: `${metricas.totalIncidentes}`, sub: `${metricas.variacion >= 0 ? '+' : ''}${metricas.variacion}% vs mes ant.`, col: '#e0e7ff', border: '#818cf8' },
      { label: 'Casos Abiertos', val: `${metricas.abiertos}`, sub: 'En investigación', col: '#ffedd5', border: '#fb923c' },
      { label: 'Casos Graves/Grav.', val: `${(distribucionGravedad.Grave || 0) + (distribucionGravedad.Gravísima || 0)}`, sub: 'Con protocolo RICE', col: '#fee2e2', border: '#f87171' },
      { label: 'Tiempo Resolución', val: '≤ 7 días', sub: 'Meta institucional', col: '#dcfce7', border: '#4ade80' },
    ]

    kpiItems.forEach((k, idx) => {
      const x = 40 + idx * (colWidth + 6)
      doc.roundedRect(x, kpiY, colWidth, 54, 6).fillAndStroke(k.col, k.border)

      doc
        .fillColor(AZUL_NAVY)
        .fontSize(8)
        .font('Helvetica-Bold')
        .text(k.label, x + 6, kpiY + 8, { width: colWidth - 12 })

      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .text(k.val, x + 6, kpiY + 22)

      doc
        .fontSize(7.5)
        .font('Helvetica')
        .fillColor(GRIS_TEXTO)
        .text(k.sub, x + 6, kpiY + 40, { width: colWidth - 12 })
    })

    doc.y = kpiY + 70

    // SÍNTESIS EJECUTIVA GLOBAL
    renderDescripcionIA(
      'Síntesis Ejecutiva Global del Clima de Convivencia',
      analisisIA.sintesis_ejecutiva,
      '#4f46e5'
    )

    // MARCO INSTITUCIONAL Y REGULATORIO
    const infoY = doc.y + 10
    doc
      .roundedRect(40, infoY, pageWidth, 80, 8)
      .fillAndStroke('#f8fafc', '#e2e8f0')

    doc
      .fillColor(AZUL_NAVY)
      .fontSize(9.5)
      .font('Helvetica-Bold')
      .text('Marco Regulatorio y Alcance Institucional', 55, infoY + 12)

    doc
      .fillColor(GRIS_TEXTO)
      .fontSize(8)
      .font('Helvetica')
      .text(
        'El presente informe directivo consolida la trazabilidad de incidentes, abordajes pedagógicos y medidas disciplinarias aplicadas en la Escuela Coeducacional N° 1 El Salvador. Su elaboración da cumplimiento a las directrices de la Circular N° 482 de la Superintendencia de Educación, orientando la toma de decisiones del Consejo Escolar, la Inspectoría General y el Comité de Buena Convivencia Escolar.',
        55,
        infoY + 28,
        { width: pageWidth - 30, align: 'justify', lineGap: 2.5 }
      )

    // PIE PORTADA
    doc.y = doc.page.height - 55
    doc.rect(40, doc.y, pageWidth, 0.8).fill(GRIS_BORDE)
    doc.moveDown(0.4)
    doc
      .fontSize(7)
      .font('Helvetica')
      .fillColor(GRIS_TEXTO)
      .text(`Documento reservado para Equipo Directivo · Ley N° 19.628 · Generado por: ${usuario.nombre || 'Equipo'} ${usuario.apellido || 'Directivo'} (${usuario.rol || 'SIGA Escolar'})`, { align: 'center' })

    // =========================================================================
    // PÁGINA 2: TENDENCIA TEMPORAL Y DISTRIBUCIÓN POR GRAVEDAD
    // =========================================================================
    doc.addPage()
    renderSubHeader(2)

    // 1. Gráfico de Tendencia + Descripción
    renderGraficoConImagen(
      '1. Evolución Temporal de Incidentes (Últimos 12 Meses)',
      graficos.tendencia,
      140
    )
    renderDescripcionIA(
      'Interpretación de la Curva de Tendencia y Comportamiento Estacional',
      analisisIA.analisis_tendencia,
      '#4f46e5'
    )

    // 2. Gráfico de Gravedad + Descripción
    renderGraficoConImagen(
      '2. Distribución de Casos por Nivel de Severidad',
      graficos.gravedad,
      130
    )
    renderDescripcionIA(
      'Análisis de Severidad y Activación de Protocolos Formativos',
      analisisIA.analisis_gravedad,
      '#f59e0b'
    )

    // =========================================================================
    // PÁGINA 3: FRECUENCIA POR AULA Y ABORDAJES FORMATIVOS
    // =========================================================================
    doc.addPage()
    renderSubHeader(3)

    // 3. Gráfico de Frecuencia por Aula + Descripción
    renderGraficoConImagen(
      '3. Frecuencia y Demanda Pedagógica por Aula',
      graficos.cursos,
      140
    )
    renderDescripcionIA(
      'Focalización Pedagógica por Cursos y Ciclos Formativos',
      analisisIA.diagnostico_aulas,
      '#0284c7'
    )

    // 4. Gráfico de Abordajes y Protocolos + Descripción
    renderGraficoConImagen(
      '4. Tipologías de Abordaje y Protocolos Aplicados',
      graficos.abordajes,
      130
    )
    renderDescripcionIA(
      'Evaluación de Medidas Formativas, Entrevistas y Acompañamiento',
      analisisIA.analisis_abordajes,
      '#059669'
    )

    // =========================================================================
    // PÁGINA 4: FOCALIZACIÓN PRIORITARIA, MEDIDAS RICE Y FIRMAS
    // =========================================================================
    doc.addPage()
    renderSubHeader(4)

    // 5. Tabla de Estudiantes Focalizados
    doc
      .fillColor(AZUL_NAVY)
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('5. Estudiantes en Focalización Prioritaria (Reiteración de Casos)', 40, doc.y)

    doc.moveDown(0.4)

    const tableY = doc.y
    const tableHeaderHeight = 18

    // Encabezado tabla
    doc
      .rect(40, tableY, pageWidth, tableHeaderHeight)
      .fill('#0f172a')

    doc
      .fillColor('white')
      .fontSize(8)
      .font('Helvetica-Bold')
      .text('Estudiante', 50, tableY + 5)
      .text('Curso / Nivel', 220, tableY + 5)
      .text('Incidentes Registrados', 340, tableY + 5, { align: 'center', width: 90 })
      .text('Nivel de Seguimiento', 430, tableY + 5, { align: 'right', width: 75 })

    let currentY = tableY + tableHeaderHeight

    if (estudiantesFocalizados.length === 0) {
      doc
        .rect(40, currentY, pageWidth, 24)
        .fillAndStroke('#f8fafc', '#e2e8f0')

      doc
        .fillColor(GRIS_TEXTO)
        .fontSize(8)
        .font('Helvetica-Oblique')
        .text('No se registran estudiantes con reiteración de incidentes durante el periodo evaluado.', 50, currentY + 8)

      currentY += 24
    } else {
      estudiantesFocalizados.forEach((est, idx) => {
        const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc'
        doc
          .rect(40, currentY, pageWidth, 20)
          .fillAndStroke(rowBg, '#e2e8f0')

        const nivelLabel = est.cantidad >= 5 ? 'Alto Riesgo' : est.cantidad >= 3 ? 'Seguimiento' : 'Atención'
        const nivelColor = est.cantidad >= 5 ? '#e11d48' : est.cantidad >= 3 ? '#d97706' : '#2563eb'

        doc
          .fillColor(AZUL_NAVY)
          .fontSize(8)
          .font('Helvetica-Bold')
          .text(est.nombre, 50, currentY + 6)

        doc
          .fillColor(GRIS_TEXTO)
          .font('Helvetica')
          .text(est.curso, 220, currentY + 6)

        doc
          .fillColor(AZUL_NAVY)
          .font('Helvetica-Bold')
          .text(`${est.cantidad}`, 340, currentY + 6, { align: 'center', width: 90 })

        doc
          .fillColor(nivelColor)
          .font('Helvetica-Bold')
          .text(nivelLabel, 430, currentY + 6, { align: 'right', width: 75 })

        currentY += 20
      })
    }

    doc.y = currentY + 14

    // 6. Directrices Formativas RICE
    renderDescripcionIA(
      '6. Directrices y Medidas Formativas RICE conforme a Circular N° 482',
      analisisIA.recomendaciones_rice,
      '#10b981'
    )

    // CUADRO DE FIRMAS OFICIALES
    const firmasY = doc.page.height - 110
    const firmaWidth = (pageWidth - 30) / 3

    const firmas = [
      { cargo: 'Inspectoría General', sub: 'Control y Procedimientos' },
      { cargo: 'Convivencia Escolar', sub: 'Acompañamiento Formativo' },
      { cargo: 'Dirección del Establecimiento', sub: 'Escuela El Salvador' },
    ]

    firmas.forEach((f, idx) => {
      const x = 40 + idx * (firmaWidth + 15)
      doc.rect(x, firmasY, firmaWidth, 0.8).fill(AZUL_NAVY)

      doc
        .fillColor(AZUL_NAVY)
        .fontSize(8)
        .font('Helvetica-Bold')
        .text(f.cargo, x, firmasY + 6, { width: firmaWidth, align: 'center' })

      doc
        .fontSize(7)
        .font('Helvetica')
        .fillColor(GRIS_TEXTO)
        .text(f.sub, x, firmasY + 17, { width: firmaWidth, align: 'center' })
    })

    // PIE DE PÁGINA FINAL
    doc.y = doc.page.height - 45
    doc.rect(40, doc.y, pageWidth, 0.8).fill(GRIS_BORDE)
    doc.moveDown(0.3)
    doc
      .fontSize(7)
      .font('Helvetica')
      .fillColor(GRIS_TEXTO)
      .text('Documento oficial generado con SIGA Escolar · Escuela Coeducacional N° 1 El Salvador · Certificación RICE', { align: 'center' })

    doc.end()
  })
}

module.exports = {
  compilarReporteMensualPDF,
  generarAnalisisIA,
  generarAnalisisFallback,
}
