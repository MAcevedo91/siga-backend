const request = require('supertest')
const express = require('express')

jest.mock('../../services/notificacionesService', () => ({
  obtenerNotificaciones: jest.fn(),
  contarNoLeidas: jest.fn(),
  marcarComoLeida: jest.fn(),
  marcarTodasComoLeidas: jest.fn()
}))

const notificacionesService = require('../../services/notificacionesService')
const notificacionesRoutes = require('../../routes/notificaciones.routes')

describe('Rutas de Notificaciones (/api/v1/notificaciones)', () => {
  const mockTenantId = '1ea5232c-3631-4271-990c-8b4bf4d93db6'
  const mockUserId = '5d6b656a-e3a0-49fd-ad9e-c90f5df12bff'

  const buildApp = (user = null) => {
    const app = express()
    app.use(express.json())

    if (user) {
      app.use((req, res, next) => {
        req.user = user
        next()
      })
    }

    app.use('/api/v1/notificaciones', notificacionesRoutes)
    return app
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('GET / debe obtener las notificaciones del usuario autenticado vía user_id', async () => {
    const mockData = [
      { id: 'notif-1', titulo: 'Incidente Grave', leida: false, created_at: new Date().toISOString() }
    ]
    notificacionesService.obtenerNotificaciones.mockResolvedValue(mockData)

    const app = buildApp({ user_id: mockUserId, tenant_id: mockTenantId, rol: 'Equipo de Formación' })
    const res = await request(app).get('/api/v1/notificaciones')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toEqual(mockData)
    expect(notificacionesService.obtenerNotificaciones).toHaveBeenCalledWith(mockUserId, mockTenantId)
  })

  it('GET /contador debe retornar el conteo exacto de no leídas', async () => {
    notificacionesService.contarNoLeidas.mockResolvedValue(3)

    const app = buildApp({ user_id: mockUserId, tenant_id: mockTenantId, rol: 'Docente' })
    const res = await request(app).get('/api/v1/notificaciones/contador')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.count).toBe(3)
    expect(notificacionesService.contarNoLeidas).toHaveBeenCalledWith(mockUserId)
  })

  it('PUT /:id/leer debe marcar como leída soportando identificador UUID', async () => {
    notificacionesService.marcarComoLeida.mockResolvedValue()
    const targetUuid = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'

    const app = buildApp({ id: mockUserId, tenant_id: mockTenantId, rol: 'Inspector' })
    const res = await request(app).put(`/api/v1/notificaciones/${targetUuid}/leer`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.message).toMatch(/marcada como leída/i)
    expect(notificacionesService.marcarComoLeida).toHaveBeenCalledWith(targetUuid, mockUserId)
  })

  it('PUT /leer-todas debe marcar todas las notificaciones pendientes como leídas', async () => {
    notificacionesService.marcarTodasComoLeidas.mockResolvedValue()

    const app = buildApp({ user_id: mockUserId, tenant_id: mockTenantId, rol: 'Administrador' })
    const res = await request(app).put('/api/v1/notificaciones/leer-todas')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.message).toMatch(/Todas las notificaciones marcadas como leídas/i)
    expect(notificacionesService.marcarTodasComoLeidas).toHaveBeenCalledWith(mockUserId, mockTenantId)
  })
})
