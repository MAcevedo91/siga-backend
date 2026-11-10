const {
  calcularVersionDocumental,
  listarDocumentosMediacionService,
  subirDocumentoMediacionService,
  descargarDocumentoMediacionService,
} = require('../../services/mediacionesDocumentosService')
const {
  listarDocumentosHandler,
  subirDocumentoHandler,
  descargarDocumentoHandler,
} = require('../../controllers/mediacionesController')

// Mocks
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}))

jest.mock('../../services/auditoriaService', () => ({
  registrarAuditoria: jest.fn().mockResolvedValue({}),
}))

jest.mock('../../utils/db', () => ({
  supabase: {
    from: jest.fn(),
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({ data: {}, error: null }),
        download: jest.fn().mockResolvedValue({
          data: { arrayBuffer: async () => Buffer.from('mock binary').buffer },
          error: null,
        }),
      }),
    },
  },
}))

const { supabase: mockSupabase } = require('../../utils/db')

const mockTenantId = '11111111-1111-4111-8111-111111111111'
const mockMediacionId = '22222222-2222-4222-8222-222222222222'
const mockUsuarioId = '33333333-3333-4333-8333-333333333333'
const mockDocId = '44444444-4444-4444-8444-444444444444'

describe('TASK 7.2.3.4 — Gestión Documental de Mediaciones (Firmas y Actas)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('calcularVersionDocumental', () => {
    it('debe generar una versión determinista de 16 caracteres hexadecimales', () => {
      const med = {
        id: mockMediacionId,
        updated_at: '2026-10-26T12:00:00Z',
      }
      const v1 = calcularVersionDocumental(med)
      const v2 = calcularVersionDocumental(med)

      expect(typeof v1).toBe('string')
      expect(v1).toHaveLength(16)
      expect(v1).toBe(v2)
    })

    it('debe cambiar de versión si se actualizan los compromisos o fecha de la mediación', () => {
      const medOriginal = { id: mockMediacionId, updated_at: '2026-10-26T12:00:00Z' }
      const medModificada = { id: mockMediacionId, updated_at: '2026-10-26T14:30:00Z' }

      const vOriginal = calcularVersionDocumental(medOriginal)
      const vModificada = calcularVersionDocumental(medModificada)

      expect(vOriginal).not.toBe(vModificada)
    })
  })

  describe('listarDocumentosMediacionService', () => {
    it('debe retornar la lista de documentos asociados a la mediación', async () => {
      // Mock validación de mediación
      mockSupabase.from.mockImplementation((tabla) => {
        if (tabla === 'mediaciones') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { id: mockMediacionId, tenant_id: mockTenantId },
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }
        if (tabla === 'mediacion_documentos') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: [
                      {
                        id: mockDocId,
                        tipo: 'firma',
                        mime_type: 'image/png',
                        firmante: 'mediador',
                        conformidad: true,
                        version_documental: 'abcd1234abcd1234',
                        nombre_archivo: 'firma.png',
                        tamano_bytes: 1024,
                        vigente: true,
                        created_at: '2026-10-26T12:00:00Z',
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }
      })

      const resultado = await listarDocumentosMediacionService(mockTenantId, mockMediacionId)
      expect(Array.isArray(resultado)).toBe(true)
      expect(resultado).toHaveLength(1)
      expect(resultado[0].tipo).toBe('firma')
      expect(resultado[0].vigente).toBe(true)
    })

    it('debe lanzar 404 si la mediación no existe en el tenant', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
            }),
          }),
        }),
      })

      await expect(
        listarDocumentosMediacionService(mockTenantId, mockMediacionId)
      ).rejects.toMatchObject({ statusCode: 404 })
    })
  })

  describe('subirDocumentoMediacionService', () => {
    it('debe rechazar si falta el archivo adjunto', async () => {
      await expect(
        subirDocumentoMediacionService(mockTenantId, mockMediacionId, mockUsuarioId, null, {
          tipo: 'firma',
        })
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('debe rechazar si el tipo no es firma ni acta_fisica', async () => {
      const mockFile = { buffer: Buffer.from('data'), mimetype: 'image/png' }
      await expect(
        subirDocumentoMediacionService(mockTenantId, mockMediacionId, mockUsuarioId, mockFile, {
          tipo: 'otro_tipo',
        })
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('debe rechazar si el expediente de mediación ya está cerrado', async () => {
      const mockFile = { buffer: Buffer.from('data'), mimetype: 'image/png' }
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: mockMediacionId, cerrada_at: '2026-10-26T10:00:00Z' },
                error: null,
              }),
            }),
          }),
        }),
      })

      await expect(
        subirDocumentoMediacionService(mockTenantId, mockMediacionId, mockUsuarioId, mockFile, {
          tipo: 'firma',
          conformidad: 'true',
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringMatching(/cerrado/i),
      })
    })

    it('debe rechazar una firma si el formato no es PNG o falta conformidad', async () => {
      const mockFilePdf = { buffer: Buffer.from('pdf data'), mimetype: 'application/pdf' }
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: mockMediacionId, cerrada_at: null },
                error: null,
              }),
            }),
          }),
        }),
      })

      await expect(
        subirDocumentoMediacionService(mockTenantId, mockMediacionId, mockUsuarioId, mockFilePdf, {
          tipo: 'firma',
          conformidad: 'true',
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringMatching(/PNG/i),
      })

      const mockFilePng = { buffer: Buffer.from('png data'), mimetype: 'image/png' }
      await expect(
        subirDocumentoMediacionService(mockTenantId, mockMediacionId, mockUsuarioId, mockFilePng, {
          tipo: 'firma',
          conformidad: 'false',
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringMatching(/conformidad/i),
      })
    })

    it('debe insertar exitosamente una firma válida y retornar metadata', async () => {
      const mockFile = {
        buffer: Buffer.from('png image bytes'),
        mimetype: 'image/png',
        originalname: 'firma-estudiante.png',
        size: 2048,
      }

      mockSupabase.from.mockImplementation((tabla) => {
        if (tabla === 'mediaciones') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { id: mockMediacionId, cerrada_at: null, updated_at: '2026-10-26T12:00:00Z' },
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }
        if (tabla === 'mediacion_documentos') {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({}),
                  }),
                }),
              }),
            }),
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: mockDocId,
                    tipo: 'firma',
                    mime_type: 'image/png',
                    firmante: 'mediador',
                    version_documental: 'version123',
                    vigente: true,
                    created_at: '2026-10-26T12:00:00Z',
                  },
                  error: null,
                }),
              }),
            }),
          }
        }
      })

      const resultado = await subirDocumentoMediacionService(
        mockTenantId,
        mockMediacionId,
        mockUsuarioId,
        mockFile,
        { tipo: 'firma', conformidad: 'true', firmante: 'mediador' }
      )

      expect(resultado).toBeDefined()
      expect(resultado.id).toBe(mockDocId)
      expect(resultado.tipo).toBe('firma')
      expect(resultado.vigente).toBe(true)
    })
  })

  describe('descargarDocumentoMediacionService', () => {
    it('debe entregar el binario y tipo MIME de un documento existente', async () => {
      const bufferEsperado = Buffer.from('contenido binario de prueba')
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: mockDocId,
                    nombre_archivo: 'acta_firmada.pdf',
                    mime_type: 'application/pdf',
                    contenido_binario: bufferEsperado,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      })

      const resultado = await descargarDocumentoMediacionService(
        mockTenantId,
        mockMediacionId,
        mockDocId
      )

      expect(resultado.mime_type).toBe('application/pdf')
      expect(resultado.nombre_archivo).toBe('acta_firmada.pdf')
      expect(Buffer.isBuffer(resultado.buffer)).toBe(true)
    })

    it('debe lanzar 404 si el documento no existe', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
              }),
            }),
          }),
        }),
      })

      await expect(
        descargarDocumentoMediacionService(mockTenantId, mockMediacionId, mockDocId)
      ).rejects.toMatchObject({ statusCode: 404 })
    })
  })

  describe('Controladores Express: Documentos de Mediación', () => {
    it('listarDocumentosHandler debe responder 200 con la lista', async () => {
      mockSupabase.from.mockImplementation((tabla) => {
        if (tabla === 'mediaciones') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { id: mockMediacionId, tenant_id: mockTenantId },
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }
        if (tabla === 'mediacion_documentos') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }
        }
      })

      const req = {
        user: { tenant_id: mockTenantId },
        params: { id: mockMediacionId },
      }
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      }
      const next = jest.fn()

      await listarDocumentosHandler(req, res, next)
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success', data: expect.any(Array) })
      )
    })

    it('subirDocumentoHandler debe responder 201 al subir archivo', async () => {
      mockSupabase.from.mockImplementation((tabla) => {
        if (tabla === 'mediaciones') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { id: mockMediacionId, cerrada_at: null },
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }
        if (tabla === 'mediacion_documentos') {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({}),
                  }),
                }),
              }),
            }),
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: mockDocId, tipo: 'acta_fisica', mime_type: 'application/pdf', vigente: true },
                  error: null,
                }),
              }),
            }),
          }
        }
      })

      const req = {
        user: { tenant_id: mockTenantId, id: mockUsuarioId },
        params: { id: mockMediacionId },
        file: { buffer: Buffer.from('%PDF'), mimetype: 'application/pdf', originalname: 'acta.pdf', size: 100 },
        body: { tipo: 'acta_fisica' },
      }
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      }
      const next = jest.fn()

      await subirDocumentoHandler(req, res, next)
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success', data: expect.objectContaining({ id: mockDocId }) })
      )
    })

    it('descargarDocumentoHandler debe responder con headers y binario', async () => {
      const buffer = Buffer.from('binario png')
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: mockDocId, nombre_archivo: 'firma.png', mime_type: 'image/png', contenido_binario: buffer },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      })

      const req = {
        user: { tenant_id: mockTenantId },
        params: { id: mockMediacionId, documentoId: mockDocId },
      }
      const res = {
        setHeader: jest.fn(),
        send: jest.fn(),
      }
      const next = jest.fn()

      await descargarDocumentoHandler(req, res, next)
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png')
      expect(res.send).toHaveBeenCalledWith(buffer)
    })
  })
})
