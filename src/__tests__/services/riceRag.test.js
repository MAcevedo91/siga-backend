const {
  limpiarTextoCrudo,
  formatearAMarkdown,
  segmentarMarkdownEnChunks,
  convertirBufferAMarkdown,
} = require('../../services/riceConverterService')

const {
  generarEmbeddingTexto,
  procesarYGuardarRice,
  obtenerRiceActivo,
} = require('../../services/riceIngestaService')

const {
  consultarRice,
  generarRespuestaFallback,
} = require('../../services/riceRagService')

const { supabase } = require('../../utils/db')

// Mock de Supabase
jest.mock('../../utils/db', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}))

// Mock de auditoriaService
jest.mock('../../services/auditoriaService', () => ({
  registrarAuditoria: jest.fn().mockResolvedValue({ success: true }),
}))

describe('Módulo RAG RICE - Tests Unitarios e Integración', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('1. riceConverterService', () => {
    test('limpiarTextoCrudo remueve números de página, pies de página y múltiples saltos', () => {
      const raw = 'Reglamento Escolar\n\nPágina 12 de 80\n\n\n\nArtículo 1.\t\tLos alumnos...'
      const limpio = limpiarTextoCrudo(raw)
      expect(limpio).not.toContain('Página 12 de 80')
      expect(limpio).toContain('Artículo 1. Los alumnos...')
    })

    test('formatearAMarkdown estructura encabezados jerárquicos de Título, Capítulo y Artículo', () => {
      const texto = 'TITULO I: Normas Generales\nCAPITULO 1: Deberes\nARTICULO 5: Asistencia obligatoria'
      const md = formatearAMarkdown(texto)
      expect(md).toContain('# TITULO I: Normas Generales')
      expect(md).toContain('## CAPITULO 1: Deberes')
      expect(md).toContain('### ARTICULO 5: Asistencia obligatoria')
    })

    test('segmentarMarkdownEnChunks divide el texto preservando sección y artículo', () => {
      const md = `# TÍTULO I: De la Convivencia Escolar
## CAPÍTULO II: Tipificación de Faltas
### Artículo 12: Faltas Leves
Constituyen faltas leves el retraso injustificado y el desorden en clases.
### Artículo 13: Faltas Graves
Constituyen faltas graves la reiteración de agresiones verbales o ciberacoso.`

      const chunks = segmentarMarkdownEnChunks(md)
      expect(chunks.length).toBeGreaterThanOrEqual(2)
      expect(chunks[0].articulo).toContain('Artículo 12')
      expect(chunks[0].contenido).toContain('retraso injustificado')
      expect(chunks[1].articulo).toContain('Artículo 13')
      expect(chunks[1].contenido).toContain('ciberacoso')
    })

    test('convertirBufferAMarkdown procesa buffers en formato Markdown directo', async () => {
      const buffer = Buffer.from('# TÍTULO I\n### Artículo 1\nNorma de prueba', 'utf-8')
      const md = await convertirBufferAMarkdown(buffer, 'md')
      expect(md).toContain('# TÍTULO I')
      expect(md).toContain('### Artículo 1')
    })

    test('convertirBufferAMarkdown procesa y extrae texto de un buffer PDF real', async () => {
      const fs = require('fs')
      const path = require('path')
      const pdfPath = path.resolve(__dirname, '../../../node_modules/pdf-parse/test/data/01-valid.pdf')
      if (fs.existsSync(pdfPath)) {
        const pdfBuffer = fs.readFileSync(pdfPath)
        const md = await convertirBufferAMarkdown(pdfBuffer, 'pdf')
        expect(typeof md).toBe('string')
        expect(md.length).toBeGreaterThan(100)
      }
    })
  })

  describe('2. riceIngestaService', () => {
    test('generarEmbeddingTexto produce vector de 768 dimensiones en test/simulación', async () => {
      const vector = await generarEmbeddingTexto('Falta grave por ciberacoso')
      expect(Array.isArray(vector)).toBe(true)
      expect(vector.length).toBe(768)
      expect(typeof vector[0]).toBe('number')
    })

    test('procesarYGuardarRice valida tenant_id y archivoBuffer', async () => {
      await expect(
        procesarYGuardarRice({ tenantId: null, archivoBuffer: Buffer.from('test') })
      ).rejects.toThrow('El tenant_id es requerido')

      await expect(
        procesarYGuardarRice({ tenantId: 'tenant-123', archivoBuffer: null })
      ).rejects.toThrow('El buffer del archivo es requerido')
    })

    test('procesarYGuardarRice persiste documento y chunks con aislamiento tenant', async () => {
      const mockDoc = { id: 'doc-uuid-1', tenant_id: 'tenant-123', estado: 'activo' }

      const mockFrom = jest.fn()
      supabase.from = mockFrom

      // Mock para rice_documentos insert
      const insertDocMock = {
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockDoc, error: null }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            neq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockDoc, error: null }),
            }),
          }),
        }),
      }

      // Mock para rice_chunks insert
      const insertChunksMock = {
        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      }

      mockFrom.mockImplementation((tabla) => {
        if (tabla === 'rice_documentos') return insertDocMock
        if (tabla === 'rice_chunks') return insertChunksMock
        return {}
      })

      const textoMd = '# TÍTULO I\n### Artículo 1\nRegla de convivencia básica institucional con suficiente texto para superar el límite.'
      const buffer = Buffer.from(textoMd, 'utf-8')

      const resultado = await procesarYGuardarRice({
        tenantId: 'tenant-123',
        usuarioId: 'user-admin',
        archivoBuffer: buffer,
        nombreArchivo: 'rice_2026.md',
        formato: 'md',
        anioVigencia: 2026,
      })

      expect(resultado).toBeDefined()
      expect(resultado.documento).toEqual(mockDoc)
      expect(insertDocMock.insert).toHaveBeenCalled()
      expect(insertChunksMock.insert).toHaveBeenCalled()
    })

    test('obtenerRiceActivo consulta documento con filtro activo y tenant_id', async () => {
      const mockDoc = { id: 'doc-uuid-1', nombre_archivo: 'rice_2026.pdf', anio_vigencia: 2026 }

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: mockDoc, error: null }),
              }),
            }),
          }),
        }),
      })

      const doc = await obtenerRiceActivo('tenant-123')
      expect(doc).toEqual(mockDoc)
    })
  })

  describe('3. riceRagService', () => {
    test('consultarRice aplica sanitización DLP eliminando RUTs y emails de la consulta', async () => {
      supabase.rpc.mockResolvedValue({
        data: [
          {
            id: 'chunk-1',
            seccion: 'CAPÍTULO II',
            articulo: 'Artículo 20',
            contenido: 'Las agresiones reiteradas conllevan medidas formativas inmediatas.',
            similitud: 0.88,
          },
        ],
        error: null,
      })

      const res = await consultarRice({
        tenantId: 'tenant-123',
        usuarioId: 'user-inspector',
        consulta: 'El estudiante Juan Pérez con RUT 18.234.567-8 y correo alumno@escuela.cl golpeó a un compañero',
      })

      expect(res).toBeDefined()
      expect(res.consulta).not.toContain('18.234.567-8')
      expect(res.consulta).not.toContain('alumno@escuela.cl')
      expect(res.fuentes.length).toBe(1)
      expect(res.fuentes[0].articulo).toBe('Artículo 20')
    })

    test('generarRespuestaFallback retorna mensaje pedagógico cuando no hay chunks', () => {
      const respuesta = generarRespuestaFallback('Pregunta sin coincidencias', [])
      expect(respuesta).toContain('No se encontraron artículos o procedimientos específicos')
    })

    test('generarRespuestaFallback sintetiza artículos recuperados', () => {
      const chunks = [
        { articulo: 'Artículo 15', seccion: 'Faltas Graves', contenido: 'Se citará al apoderado en 24 horas.' },
      ]
      const respuesta = generarRespuestaFallback('¿Cuál es el plazo?', chunks)
      expect(respuesta).toContain('Artículo 15')
      expect(respuesta).toContain('Se citará al apoderado')
    })
  })
})
