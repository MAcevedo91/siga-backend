const {
  uploadRiceHandler,
  obtenerRiceActivoHandler,
  consultarRiceHandler,
} = require('../../controllers/riceController')

const riceIngestaService = require('../../services/riceIngestaService')
const riceRagService = require('../../services/riceRagService')

jest.mock('../../services/riceIngestaService')
jest.mock('../../services/riceRagService')

describe('riceController - Tests Unitarios', () => {
  let req, res, next

  beforeEach(() => {
    jest.clearAllMocks()
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }
    next = jest.fn()
  })

  describe('uploadRiceHandler', () => {
    test('procesa archivo subido y retorna 201 con resumen', async () => {
      req = {
        user: { tenant_id: 'tenant-123', id: 'user-admin' },
        file: {
          originalname: 'rice-oficial.pdf',
          buffer: Buffer.from('%PDF-1.4 test'),
        },
        body: { anio_vigencia: 2026 },
      }

      const mockResultado = {
        documento: { id: 'doc-1', estado: 'activo' },
        resumen: { totalChunks: 15 },
      }
      riceIngestaService.procesarYGuardarRice.mockResolvedValue(mockResultado)

      await uploadRiceHandler(req, res, next)

      expect(riceIngestaService.procesarYGuardarRice).toHaveBeenCalledWith({
        tenantId: 'tenant-123',
        usuarioId: 'user-admin',
        archivoBuffer: req.file.buffer,
        nombreArchivo: 'rice-oficial.pdf',
        formato: 'pdf',
        anioVigencia: 2026,
      })
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        message: 'Reglamento RICE cargado y vectorizado exitosamente',
        data: mockResultado,
      })
    })

    test('captura errores del servicio y los propaga a next()', async () => {
      req = {
        user: { tenant_id: 'tenant-123', id: 'user-admin' },
        file: { originalname: 'test.md', buffer: Buffer.from('test') },
        body: {},
      }
      const error = new Error('Error al parsear')
      riceIngestaService.procesarYGuardarRice.mockRejectedValue(error)

      await uploadRiceHandler(req, res, next)

      expect(next).toHaveBeenCalledWith(error)
    })
  })

  describe('obtenerRiceActivoHandler', () => {
    test('retorna metadatos del RICE activo con código 200', async () => {
      req = { user: { tenant_id: 'tenant-123' } }
      const mockDoc = { id: 'doc-1', anio_vigencia: 2026, total_chunks: 25 }
      riceIngestaService.obtenerRiceActivo.mockResolvedValue(mockDoc)

      await obtenerRiceActivoHandler(req, res, next)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: mockDoc,
        message: 'RICE activo recuperado correctamente',
      })
    })
  })

  describe('consultarRiceHandler', () => {
    test('retorna 400 si el campo consulta está vacío', async () => {
      req = {
        user: { tenant_id: 'tenant-123', id: 'user-docente' },
        body: { consulta: '   ' },
      }

      await consultarRiceHandler(req, res, next)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'error', statusCode: 400 })
      )
    })

    test('retorna 200 con respuesta y fuentes si la consulta es válida', async () => {
      req = {
        user: { tenant_id: 'tenant-123', id: 'user-docente' },
        body: { consulta: '¿Cuál es la sanción por ciberacoso?' },
      }

      const mockRespuesta = {
        respuesta: 'Según el Artículo 25...',
        fuentes: [{ articulo: 'Artículo 25', seccion: 'Faltas Graves' }],
      }
      riceRagService.consultarRice.mockResolvedValue(mockRespuesta)

      await consultarRiceHandler(req, res, next)

      expect(riceRagService.consultarRice).toHaveBeenCalledWith({
        tenantId: 'tenant-123',
        usuarioId: 'user-docente',
        consulta: '¿Cuál es la sanción por ciberacoso?',
        contextoIncidente: undefined,
      })
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: mockRespuesta,
      })
    })
  })
})
