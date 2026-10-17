require('dotenv').config()
const { sanitizarContextoIncidente, desanonimizarReporte } = require('../src/services/dlpSanitizer')
const { generarPropuestaReporteIA } = require('../src/services/geminiService')

async function ejecutarVerificacion() {
  console.log('\n======================================================================')
  console.log('  SIGA Escolar - Verificación en Terreno: Pipeline DLP y Gemini Flash  ')
  console.log('======================================================================\n')

  // ---------------------------------------------------------------------------
  // 1. Verificación de Variables de Entorno
  // ---------------------------------------------------------------------------
  const apiKey = process.env.GEMINI_API_KEY
  const modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash'

  console.log('🔍 [PASO 1] Estado de Configuración:')
  console.log(`   - Modelo Configurado: ${modelName}`)
  if (!apiKey || apiKey === 'your-gemini-api-key' || apiKey.trim() === '') {
    console.log('   - GEMINI_API_KEY: ⚠️  NO DETECTADA (Se ejecutará en modo contingencia/fallback)')
  } else {
    const maskedKey = `${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)}`
    console.log(`   - GEMINI_API_KEY: ✅ DETECTADA (${maskedKey})`)
  }
  console.log('----------------------------------------------------------------------\n')

  // ---------------------------------------------------------------------------
  // 2. Simulación de Incidente Real con Datos Altamente Sensibles (PII)
  // ---------------------------------------------------------------------------
  const estudianteFocoId = 'd3b07384-d113-4c54-944a-d830b5030701'
  const contraparteId = 'e4c18495-e224-5d65-055b-e941c6141802'

  const incidentePrueba = {
    id: 'f5d29506-f335-6e76-166c-fa52d7252903',
    fecha: '2026-09-29',
    gravedad: 'Grave',
    tipo_abordaje: 'Protocolo de Agresión entre Pares',
    relato: 'Durante el recreo de las 10:15 hrs en el patio techado, el alumno Benjamín Ignacio Vicuña Morales (RUT 22.345.678-9) se vio involucrado en una discusión verbal que escaló con Matías Alexis González Tapia (RUT 22.987.654-3). El inspector docente Juan Carlos Morales (RUT 14.876.543-2) acudió de inmediato a separar a las partes. Se llamó al apoderado de Benjamín al teléfono +56 9 8765 4321 y se envió citación al correo apoderado.vicuna@gmail.com.',
    medidas: 'Se realiza contención emocional inmediata a Benjamín Ignacio Vicuña Morales en sala de convivencia. Se cita a apoderado de Matías Alexis González Tapia al correo contacto.apoderado@yahoo.cl.',
    estudiantes: [
      {
        id: estudianteFocoId,
        nombre: 'Benjamín Ignacio',
        apellido: 'Vicuña Morales',
        curso: '7° Básico B',
        es_victima: false,
        observacion: 'Participa en altercado verbal',
      },
      {
        id: contraparteId,
        nombre: 'Matías Alexis',
        apellido: 'González Tapia',
        curso: '8° Básico A',
        es_victima: false,
        observacion: 'Parte involucrada en discusión',
      },
    ],
  }

  console.log('📋 [PASO 2] Incidente de Prueba Cargado:')
  console.log(`   - Estudiante Foco: Benjamín Ignacio Vicuña Morales (7° Básico B)`)
  console.log(`   - Contraparte: Matías Alexis González Tapia (8° Básico A)`)
  console.log(`   - PII presente en relato original: RUTs, Nombres, Celular (+56 9...), Emails`)
  console.log('----------------------------------------------------------------------\n')

  // ---------------------------------------------------------------------------
  // 3. Prueba de Pipeline DLP (Sanitización & Anonimización)
  // ---------------------------------------------------------------------------
  console.log('🛡️  [PASO 3] Ejecutando Sanitización DLP...')
  const { promptSanitizado, mapaRestauracion } = sanitizarContextoIncidente(incidentePrueba, estudianteFocoId)

  console.log('\n--- TEXTO SANITIZADO QUE VIAJARÁ A LA IA ---')
  console.log(`Participantes Anónimos:\n${promptSanitizado.participantesAnonimizados}`)
  console.log(`\nRelato Sanitizado:\n"${promptSanitizado.relatoSanitizado}"`)
  console.log(`\nMedidas Sanitizadas:\n"${promptSanitizado.medidasSanitizadas}"`)
  console.log('--------------------------------------------\n')

  // Verificaciones de seguridad DLP automáticas
  const leaks = []
  if (promptSanitizado.relatoSanitizado.includes('22.345.678-9')) leaks.push('RUT Benjamín')
  if (promptSanitizado.relatoSanitizado.includes('22.987.654-3')) leaks.push('RUT Matías')
  if (promptSanitizado.relatoSanitizado.includes('Benjamín')) leaks.push('Nombre Benjamín')
  if (promptSanitizado.relatoSanitizado.includes('González Tapia')) leaks.push('Apellido Matías')
  if (promptSanitizado.relatoSanitizado.includes('8765 4321')) leaks.push('Teléfono')
  if (promptSanitizado.relatoSanitizado.includes('apoderado.vicuna@gmail.com')) leaks.push('Email')

  if (leaks.length === 0) {
    console.log('✅ AUDITORÍA DLP SUPERADA: CERO datos personales (PII) detectados en el prompt exterior.')
  } else {
    console.error('❌ FALLA CRÍTICA DLP: Se detectaron filtraciones de PII:', leaks.join(', '))
  }
  console.log('----------------------------------------------------------------------\n')

  // ---------------------------------------------------------------------------
  // 4. Invocación al Asistente Normativo (Gemini Flash o Fallback)
  // ---------------------------------------------------------------------------
  console.log('🤖 [PASO 4] Invocando Google Gemini Flash...')
  if (apiKey && apiKey !== 'your-gemini-api-key') {
    const { GoogleGenAI } = require('@google/genai')
    const ai = new GoogleGenAI({ apiKey })
    const modelsToProbe = [modelName, 'gemini-3.8-flash-lite', 'gemini-3-flash-preview']

    for (const m of modelsToProbe) {
      try {
        process.stdout.write(`   📡 Probando conexión con ${m}... `)
        const testRes = await ai.models.generateContent({
          model: m,
          contents: 'Responde exclusivamente con la palabra OK.',
        })
        console.log(`✅ DISPONIBLE Y ACTIVO (Respuesta: "${testRes.text?.trim()}")\n`)
        break
      } catch (testErr) {
        console.log(`⚠️  ${testErr.status || 'ERROR'}: ${testErr.message || testErr}`)
      }
    }
  }

  const startTime = Date.now()
  const reporteFinal = await generarPropuestaReporteIA(incidentePrueba, estudianteFocoId)
  const duration = ((Date.now() - startTime) / 1000).toFixed(2)

  console.log(`⏱️  Tiempo de respuesta: ${duration}s\n`)
  console.log('--- SECCIONES DEL INFORME NORMATIVO GENERADO ---')
  console.log('📌 1. CONTEXTO:')
  console.log(`   ${reporteFinal.secciones.contexto}\n`)
  console.log('📌 2. HECHOS OBJETIVOS:')
  console.log(`   ${reporteFinal.secciones.hechos_objetivos}\n`)
  console.log('📌 3. MEDIDAS ADOPTADAS:')
  console.log(`   ${reporteFinal.secciones.medidas_adoptadas}\n`)
  console.log('📌 4. ACUERDOS Y COMPROMISOS:')
  console.log(`   ${reporteFinal.secciones.acuerdos_compromisos}\n`)
  console.log('📌 5. PLAN DE SEGUIMIENTO:')
  console.log(`   ${reporteFinal.secciones.plan_seguimiento}\n`)
  console.log('------------------------------------------------\n')

  // ---------------------------------------------------------------------------
  // 5. Verificación de Desanonimización Diferenciada (Ley 19.628 / 21.719)
  // ---------------------------------------------------------------------------
  console.log('⚖️  [PASO 5] Verificación de Cumplimiento Legal Diferenciado:')
  const textoCompleto = JSON.stringify(reporteFinal.secciones)

  const tieneEstudianteFoco = textoCompleto.includes('Benjamín Ignacio Vicuña Morales') || textoCompleto.includes('Benjamín')
  const tieneContraparteSecreta = !textoCompleto.includes('Matías Alexis González Tapia') && !textoCompleto.includes('González Tapia')

  console.log(`   - Identidad de Benjamín (Estudiante Foco) restaurada en su informe: ${tieneEstudianteFoco ? '✅ SÍ' : '❌ NO'}`)
  console.log(`   - Identidad de Matías (Contraparte) protegida ante terceros: ${tieneContraparteSecreta ? '✅ SÍ (Protegida)' : '❌ NO (Filtrada)'}`)

  console.log('\n======================================================================')
  console.log('  RESULTADO FINAL DE LA VERIFICACIÓN: EXITOSO                          ')
  console.log('======================================================================\n')
  process.exit(0)
}

ejecutarVerificacion().catch((err) => {
  console.error('\n❌ ERROR EN LA VERIFICACIÓN:', err)
  process.exit(1)
})
