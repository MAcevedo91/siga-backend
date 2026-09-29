const dlpSanitizer = require('../../services/dlpSanitizer')
const geminiService = require('../../services/geminiService')
const { GoogleGenAI } = require('@google/genai')

jest.mock('@google/genai')
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}))

describe('dlpSanitizer & geminiService — DLP y Asistente IA (Tarea 6.1.2)', () => {
  const mockEstudianteFocoId = 'aaaaaaaa-1111-4111-8111-111111111111'
  const mockEstudiante2Id = 'bbbbbbbb-2222-4222-8222-222222222222'

  const mockIncidente = {
    id: 'inc-100',
    fecha: '2026-09-29',
    gravedad: 'Grave',
    tipo_abordaje: 'Conflicto entre pares',
    relato:
      'En el patio central, el alumno Carlos Muñoz (RUT 18.234.567-8, fono +56987654321) tuvo una discusión con Diego González. Carlos Muñoz empujó a Diego González y se procedió a intervenir.',
    medidas:
      'Se traslada a Carlos Muñoz y a Diego González a inspectoría. Se contacta a apoderado al correo apoderado@gmail.com.',
    estudiantes: [
      {
        id: mockEstudianteFocoId,
        nombre: 'Carlos',
        apellido: 'Muñoz',
        curso: '8° Básico A',
        es_victima: false,
      },
      {
        id: mockEstudiante2Id,
        nombre: 'Diego',
        apellido: 'González',
        curso: '8° Básico A',
        es_victima: true,
      },
    ],
  }

  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.GEMINI_API_KEY
  })

  describe('1. Filtro DLP: censurarPatronesPII', () => {
    it('debe censurar RUTs chilenos en distintos formatos', () => {
      const texto = 'RUT con puntos 12.345.678-9, sin puntos 9876543-k y con K mayúscula 11.222.333-K.'
      const censurado = dlpSanitizer.censurarPatronesPII(texto)

      expect(censurado).not.toContain('12.345.678-9')
      expect(censurado).not.toContain('9876543-k')
      expect(censurado).not.toContain('11.222.333-K')
      expect(censurado).toMatch(/\[RUT_RESERVADO\]/)
    })

    it('debe censurar teléfonos chilenos y correos electrónicos', () => {
      const texto = 'Llamar al +56 9 1234 5678 o escribir a profesor@colegio.cl para coordinar.'
      const censurado = dlpSanitizer.censurarPatronesPII(texto)

      expect(censurado).not.toContain('+56 9 1234 5678')
      expect(censurado).not.toContain('profesor@colegio.cl')
      expect(censurado).toContain('[TEL_RESERVADO]')
      expect(censurado).toContain('[EMAIL_RESERVADO]')
    })
  })

  describe('2. Sanitización Contextual: sanitizarContextoIncidente', () => {
    it('debe reemplazar nombres de involucrados por tokens y remover PII en el relato', () => {
      const { promptSanitizado, mapaRestauracion, estudianteFoco } =
        dlpSanitizer.sanitizarContextoIncidente(mockIncidente, mockEstudianteFocoId)

      expect(estudianteFoco.nombreCompleto).toBe('Carlos Muñoz')
      expect(mapaRestauracion.nombreFoco).toBe('Carlos Muñoz')

      // Verificar que el relato enviado al prompt NO contenga los nombres reales
      expect(promptSanitizado.relatoSanitizado).not.toContain('Carlos Muñoz')
      expect(promptSanitizado.relatoSanitizado).not.toContain('Diego González')
      expect(promptSanitizado.relatoSanitizado).toContain('[ESTUDIANTE_FOCO]')
      expect(promptSanitizado.relatoSanitizado).toContain('[INVOLUCRADO_2]')

      // Verificar que los datos de contacto estén censurados
      expect(promptSanitizado.relatoSanitizado).not.toContain('18.234.567-8')
      expect(promptSanitizado.relatoSanitizado).not.toContain('+56987654321')
    })

    it('debe rechazar con 400 si el estudiante solicitado no pertenece al incidente', () => {
      expect(() => {
        dlpSanitizer.sanitizarContextoIncidente(mockIncidente, 'uuid-ajeno-no-involucrado')
      }).toThrow(/no figura como involucrado/)
    })
  })

  describe('3. Desanonimización y Reconstitución: desanonimizarReporte', () => {
    it('debe reinyectar el nombre real del estudiante foco y mantener confidencialidad de la contraparte', () => {
      const { mapaRestauracion } = dlpSanitizer.sanitizarContextoIncidente(
        mockIncidente,
        mockEstudianteFocoId
      )

      const jsonConTokens = {
        contexto: 'Suceso ocurrido en patio con la presencia de [ESTUDIANTE_FOCO].',
        hechos_objetivos:
          'Se produce un altercado físico donde [ESTUDIANTE_FOCO] interactúa con [INVOLUCRADO_2].',
        medidas_adoptadas: 'Se aplica mediación formativa para [ESTUDIANTE_FOCO].',
        acuerdos_compromisos: '[ESTUDIANTE_FOCO] asume compromisos de buen trato.',
        plan_seguimiento: 'Seguimiento por 30 días para [ESTUDIANTE_FOCO].',
      }

      const desanonimizado = dlpSanitizer.desanonimizarReporte(jsonConTokens, mapaRestauracion)

      // El estudiante foco debe tener su nombre real restituido
      expect(desanonimizado.hechos_objetivos).toContain('Carlos Muñoz')
      expect(desanonimizado.hechos_objetivos).not.toContain('[ESTUDIANTE_FOCO]')

      // La contraparte debe resguardarse sin exponer el nombre "Diego González"
      expect(desanonimizado.hechos_objetivos).not.toContain('Diego González')
      expect(desanonimizado.hechos_objetivos).toContain('otro estudiante involucrado')
    })
  })

  describe('4. Servicio Gemini Flash: geminiService', () => {
    it('debe generar una propuesta válida mediante fallback si no hay API Key configurada', async () => {
      const resultado = await geminiService.generarPropuestaReporteIA(
        mockIncidente,
        mockEstudianteFocoId
      )

      expect(resultado).toBeDefined()
      expect(resultado.estudiante_id).toBe(mockEstudianteFocoId)
      expect(resultado.estudiante_nombre).toBe('Carlos Muñoz')
      expect(resultado.generado_con_ia).toBe(true)

      // Validar que las 5 secciones cumplan con longitud y estructura
      const { secciones } = resultado
      expect(secciones.contexto.length).toBeGreaterThanOrEqual(10)
      expect(secciones.hechos_objetivos.length).toBeGreaterThanOrEqual(20)
      expect(secciones.medidas_adoptadas.length).toBeGreaterThanOrEqual(10)
      expect(secciones.acuerdos_compromisos.length).toBeGreaterThanOrEqual(10)
      expect(secciones.plan_seguimiento.length).toBeGreaterThanOrEqual(10)
      expect(secciones.acuerdos_compromisos).toContain('Carlos Muñoz')
    })

    it('debe invocar GoogleGenAI cuando existe GEMINI_API_KEY y procesar la respuesta JSON', async () => {
      process.env.GEMINI_API_KEY = 'test-api-key-gemini'

      const mockAiResponseJson = {
        contexto: 'Patio escolar durante el horario de recreo, jornada matutina.',
        hechos_objetivos:
          'Se registra un altercado entre [ESTUDIANTE_FOCO] y [INVOLUCRADO_2], requiriendo intervención del inspector de patio.',
        medidas_adoptadas:
          'Contención inmediata y traslado a inspectoría para calmar la situación.',
        acuerdos_compromisos:
          '[ESTUDIANTE_FOCO] se compromete a respetar las normas de sana convivencia escolar.',
        plan_seguimiento:
          'Observación conductual en recreos y entrevista pedagógica con apoderado.',
      }

      const mockGenerateContent = jest.fn().mockResolvedValue({
        text: JSON.stringify(mockAiResponseJson),
      })

      GoogleGenAI.mockImplementation(() => ({
        models: {
          generateContent: mockGenerateContent,
        },
      }))

      const resultado = await geminiService.generarPropuestaReporteIA(
        mockIncidente,
        mockEstudianteFocoId
      )

      expect(mockGenerateContent).toHaveBeenCalledTimes(1)
      expect(resultado.secciones.hechos_objetivos).toContain('Carlos Muñoz')
      expect(resultado.secciones.hechos_objetivos).toContain('otro estudiante involucrado')
      expect(resultado.secciones.hechos_objetivos).not.toContain('Diego González')
    })

    it('debe degradar a fallback grácilmente si la API de Gemini lanza un error', async () => {
      process.env.GEMINI_API_KEY = 'test-api-key-gemini'

      GoogleGenAI.mockImplementation(() => ({
        models: {
          generateContent: jest.fn().mockRejectedValue(new Error('Quota exceeded / Rate limit')),
        },
      }))

      const resultado = await geminiService.generarPropuestaReporteIA(
        mockIncidente,
        mockEstudianteFocoId
      )

      // No debe lanzar excepción, sino entregar la plantilla de contingencia
      expect(resultado).toBeDefined()
      expect(resultado.secciones.hechos_objetivos).toContain('Carlos Muñoz')
      expect(resultado.secciones.plan_seguimiento).toBeDefined()
    })
  })
})
