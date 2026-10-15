const request = require('supertest')
const express = require('express')
const mediacionesRoutes = require('../../routes/mediaciones.routes')
const mediacionesService = require('../../services/mediacionesService')

jest.mock('../../services/mediacionesService')
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}))

describe('mediacionesController & Rutas (Task 7.2.1.2)', () => {
  let app
  const mockTenantId = '11111111-1111-4111-8111-111111111111'
  const mockUserId = '22222222-2222-4222-8222-222222222222'
  const mockMediacionId = '55555555-5555-4555-8555-555555555555'

  const createAppWithUser = (userRole = 'Administrador') => {
    const testApp = express()
    testApp.use(express.json())
    testApp.use((req, res, next) => {
      req.user = {
        user_id: mockUserId,
        tenant_id: mockTenantId,
        rol: userRole,
      }
      next()
    })
    testApp.use('/api/v1/mediaciones', mediacionesRoutes)

    // Middleware de error para capturar excepciones
    testApp.use((err, req, res, next) => {
      const status = err.statusCode || err.status || 500
      res.status(status).json({
        status: 'error',
        message: err.message,
        statusCode: status,
      })
    })

    return testApp
  }

  beforeEach(() => {
    jest.clearAllMocks()
    app = createAppWithUser('Administrador')
  })

  describe('POST /api/v1/mediaciones', () => {
    const validBody = {
      tipo_origen: 'preventiva_convivencia',
      motivo: 'Resolución pacífica de desacuerdos escolares',
      fecha_programada: '2026-10-22T10:00:00.000Z',
      participantes: [
        { estudiante_id: '33333333-3333-4333-8333-333333333333', rol_participante: 'parte_1' },
        { estudiante_id: '44444444-4444-4444-8444-444444444444', rol_participante: 'parte_2' },
      ],
    }

    it('debe responder 201 y retornar la mediación creada para roles autorizados', async () => {
      const mockCreated = {
        id: mockMediacionId,
        folio: 'MED-2026-0001',
        ...validBody,
      }
      mediacionesService.crearMediacion.mockResolvedValue(mockCreated)

      const response = await request(app)
        .post('/api/v1/mediaciones')
        .send(validBody)

      expect(response.status).toBe(201)
      expect(response.body.status).toBe('success')
      expect(response.body.data.folio).toBe('MED-2026-0001')
      expect(mediacionesService.crearMediacion).toHaveBeenCalledWith(
        mockTenantId,
        mockUserId,
        validBody
      )
    })

    it('debe manejar errores del servicio y responder con el código de error correspondiente', async () => {
      const err = new Error('Error al insertar mediación')
      err.statusCode = 500
      mediacionesService.crearMediacion.mockRejectedValue(err)

      const response = await request(app)
        .post('/api/v1/mediaciones')
        .send(validBody)

      expect(response.status).toBe(500)
      expect(response.body.status).toBe('error')
    })

    it('debe rechazar con 403 si el rol no tiene permisos (ej. Estudiante)', async () => {
      const unauthApp = createAppWithUser('Estudiante')

      const response = await request(unauthApp)
        .post('/api/v1/mediaciones')
        .send(validBody)

      expect(response.status).toBe(403)
      expect(response.body.status).toBe('error')
    })
  })

  describe('GET /api/v1/mediaciones', () => {
    it('debe retornar 200 con listado paginado y filtros', async () => {
      const mockResult = {
        data: [{ id: mockMediacionId, folio: 'MED-2026-0001' }],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      }
      mediacionesService.listarMediaciones.mockResolvedValue(mockResult)

      const response = await request(app)
        .get('/api/v1/mediaciones?estado=programada&page=1&limit=10')

      expect(response.status).toBe(200)
      expect(response.body.status).toBe('success')
      expect(response.body.data).toHaveLength(1)
      expect(response.body.total).toBe(1)
      expect(mediacionesService.listarMediaciones).toHaveBeenCalledWith(
        mockTenantId,
        expect.objectContaining({ estado: 'programada' })
      )
    })

    it('debe manejar errores al listar y propagar el error al middleware', async () => {
      const err = new Error('Error de conexión con la base de datos')
      err.statusCode = 500
      mediacionesService.listarMediaciones.mockRejectedValue(err)

      const response = await request(app).get('/api/v1/mediaciones')

      expect(response.status).toBe(500)
      expect(response.body.status).toBe('error')
    })
  })

  describe('GET /api/v1/mediaciones/:id', () => {
    it('debe retornar 200 con los detalles de la mediación', async () => {
      const mockData = { id: mockMediacionId, folio: 'MED-2026-0001', motivo: 'Test' }
      mediacionesService.obtenerMediacionPorId.mockResolvedValue(mockData)

      const response = await request(app)
        .get(`/api/v1/mediaciones/${mockMediacionId}`)

      expect(response.status).toBe(200)
      expect(response.body.status).toBe('success')
      expect(response.body.data.id).toBe(mockMediacionId)
      expect(mediacionesService.obtenerMediacionPorId).toHaveBeenCalledWith(
        mockTenantId,
        mockMediacionId
      )
    })

    it('debe retornar 404 si la mediación no existe', async () => {
      const error404 = new Error('Mediación no encontrada')
      error404.statusCode = 404
      mediacionesService.obtenerMediacionPorId.mockRejectedValue(error404)

      const response = await request(app)
        .get(`/api/v1/mediaciones/${mockMediacionId}`)

      expect(response.status).toBe(404)
      expect(response.body.status).toBe('error')
      expect(response.body.message).toMatch(/Mediación no encontrada/i)
    })
  })

  describe('POST /api/v1/mediaciones/:id/notificar-apoderados', () => {
    it('debe retornar 200 tras notificar exitosamente a los apoderados', async () => {
      const mockRespuesta = {
        mediacion_id: mockMediacionId,
        folio: 'MED-2026-0001',
        total_notificados: 2,
      }
      mediacionesService.notificarApoderados.mockResolvedValue(mockRespuesta)

      const response = await request(app)
        .post(`/api/v1/mediaciones/${mockMediacionId}/notificar-apoderados`)
        .send({ medio_aviso: 'correo', mensaje_personalizado: 'Sesión presencial' })

      expect(response.status).toBe(200)
      expect(response.body.status).toBe('success')
      expect(response.body.data.total_notificados).toBe(2)
      expect(mediacionesService.notificarApoderados).toHaveBeenCalledWith(
        mockTenantId,
        mockMediacionId,
        mockUserId,
        expect.objectContaining({ medio_aviso: 'correo' })
      )
    })

    it('debe manejar errores del servicio al notificar apoderados', async () => {
      const err = new Error('Error al notificar apoderados')
      err.statusCode = 400
      mediacionesService.notificarApoderados.mockRejectedValue(err)

      const response = await request(app)
        .post(`/api/v1/mediaciones/${mockMediacionId}/notificar-apoderados`)
        .send({ medio_aviso: 'correo' })

      expect(response.status).toBe(400)
      expect(response.body.status).toBe('error')
    })

    it('debe denegar con 403 a roles sin atribución para notificar (ej. Docente)', async () => {
      const docenteApp = createAppWithUser('Docente')

      const response = await request(docenteApp)
        .post(`/api/v1/mediaciones/${mockMediacionId}/notificar-apoderados`)
        .send({ medio_aviso: 'correo' })

      expect(response.status).toBe(403)
      expect(response.body.status).toBe('error')
    })
  })
})
