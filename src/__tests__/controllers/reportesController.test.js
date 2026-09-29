const request = require('supertest')
const express = require('express')
const reportesController = require('../../controllers/reportesController')
const reportesService = require('../../services/reportesService')
const incidentesRoutes = require('../../routes/incidentes.routes')

jest.mock('../../services/reportesService')
jest.mock('../../services/incidentesService')
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}))

describe('reportesController & Rutas Incidentes (Tarea 6.1.3)', () => {
  let app
  const mockTenantId = '11111111-1111-4111-8111-111111111111'
  const mockUserId = '22222222-2222-4222-8222-222222222222'
  const mockIncidenteId = '33333333-3333-4333-8333-333333333333'
  const mockReporteId = '44444444-4444-4444-8444-444444444444'

  // Helper para armar app de Express simulando middleware de autenticación
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
    testApp.use('/api/v1/incidentes', incidentesRoutes)

    // Manejador genérico de errores
    testApp.use((err, req, res, next) => {
      const status = err.status || err.statusCode || 500
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

  describe('POST /api/v1/incidentes/:id/borrador-reporte', () => {
    it('debe generar exitosamente borradores diferenciados para roles autorizados (Administrador)', async () => {
      const mockReportesCreados = [
        {
          id: 'rep-1',
          incidente_id: mockIncidenteId,
          estudiante_id: 'est-1',
          estado: 'Borrador',
          version: 1,
        },
        {
          id: 'rep-2',
          incidente_id: mockIncidenteId,
          estudiante_id: 'est-2',
          estado: 'Borrador',
          version: 1,
        },
      ]

      reportesService.generarBorradoresParaIncidente.mockResolvedValue(mockReportesCreados)

      const res = await request(app)
        .post(`/api/v1/incidentes/${mockIncidenteId}/borrador-reporte`)
        .send({})

      expect(res.status).toBe(201)
      expect(res.body.status).toBe('success')
      expect(res.body.data).toHaveLength(2)
      expect(reportesService.generarBorradoresParaIncidente).toHaveBeenCalledWith({
        tenantId: mockTenantId,
        incidenteId: mockIncidenteId,
        usuarioId: mockUserId,
      })
    })

    it('debe permitir la generación a un usuario con rol Inspector', async () => {
      const appInspector = createAppWithUser('Inspector')
      reportesService.generarBorradoresParaIncidente.mockResolvedValue([{ id: 'rep-1' }])

      const res = await request(appInspector)
        .post(`/api/v1/incidentes/${mockIncidenteId}/borrador-reporte`)
        .send({})

      expect(res.status).toBe(201)
    })

    it('debe rechazar con 403 Forbidden si el rol es Docente', async () => {
      const appDocente = createAppWithUser('Docente')

      const res = await request(appDocente)
        .post(`/api/v1/incidentes/${mockIncidenteId}/borrador-reporte`)
        .send({})

      expect(res.status).toBe(403)
      expect(res.body.message).toMatch(/No tienes permisos/)
      expect(reportesService.generarBorradoresParaIncidente).not.toHaveBeenCalled()
    })

    it('debe propagar error 404 si el incidente no existe', async () => {
      const err = new Error('Incidente no encontrado')
      err.status = 404
      reportesService.generarBorradoresParaIncidente.mockRejectedValue(err)

      const res = await request(app)
        .post(`/api/v1/incidentes/${mockIncidenteId}/borrador-reporte`)
        .send({})

      expect(res.status).toBe(404)
      expect(res.body.message).toBe('Incidente no encontrado')
    })
  })

  describe('GET /api/v1/incidentes/:id/reportes', () => {
    it('debe listar los reportes del incidente para cualquier usuario autenticado', async () => {
      const mockLista = [
        { id: 'rep-1', estado: 'Borrador' },
        { id: 'rep-2', estado: 'Aprobado' },
      ]
      reportesService.obtenerReportesPorIncidente.mockResolvedValue(mockLista)

      const res = await request(app)
        .get(`/api/v1/incidentes/${mockIncidenteId}/reportes`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(2)
      expect(reportesService.obtenerReportesPorIncidente).toHaveBeenCalledWith(
        mockTenantId,
        mockIncidenteId
      )
    })
  })

  describe('GET /api/v1/incidentes/:id/reportes/:reporteId', () => {
    it('debe retornar el detalle del reporte solicitado', async () => {
      const mockDetalle = {
        id: mockReporteId,
        estado: 'Borrador',
        contenido_borrador: { contexto: 'Patio escolar' },
      }
      reportesService.obtenerReportePorId.mockResolvedValue(mockDetalle)

      const res = await request(app)
        .get(`/api/v1/incidentes/${mockIncidenteId}/reportes/${mockReporteId}`)

      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(mockReporteId)
      expect(reportesService.obtenerReportePorId).toHaveBeenCalledWith(
        mockTenantId,
        mockReporteId
      )
    })
  })

  describe('PATCH /api/v1/incidentes/:id/reportes/:reporteId', () => {
    const payloadEdicion = {
      contenido_editado: {
        contexto: 'Contexto actualizado durante la mediación escolar.',
        hechos_objetivos: 'Relato detallado y ajustado por el profesional con más de 20 caracteres.',
        medidas_adoptadas: 'Medidas actualizadas según protocolo RICE.',
        acuerdos_compromisos: 'Compromisos asumidos por el apoderado y el alumno.',
        plan_seguimiento: 'Seguimiento por 15 días hábiles.',
      },
    }

    it('debe actualizar el borrador exitosamente para roles autorizados', async () => {
      reportesService.guardarEdicionBorrador.mockResolvedValue({
        id: mockReporteId,
        contenido_editado: payloadEdicion.contenido_editado,
      })

      const res = await request(app)
        .patch(`/api/v1/incidentes/${mockIncidenteId}/reportes/${mockReporteId}`)
        .send(payloadEdicion)

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('success')
      expect(reportesService.guardarEdicionBorrador).toHaveBeenCalledWith({
        tenantId: mockTenantId,
        reporteId: mockReporteId,
        contenidoEditado: payloadEdicion.contenido_editado,
        modificadoPor: mockUserId,
      })
    })

    it('debe rechazar con 400 si falta el campo contenido_editado', async () => {
      const res = await request(app)
        .patch(`/api/v1/incidentes/${mockIncidenteId}/reportes/${mockReporteId}`)
        .send({})

      expect(res.status).toBe(400)
      expect(res.body.message).toMatch(/contenido_editado.*obligatorio/)
    })

    it('debe rechazar con 400 si el reporte ya fue aprobado', async () => {
      const err = new Error('No se puede editar un reporte que ya ha sido aprobado')
      err.status = 400
      reportesService.guardarEdicionBorrador.mockRejectedValue(err)

      const res = await request(app)
        .patch(`/api/v1/incidentes/${mockIncidenteId}/reportes/${mockReporteId}`)
        .send(payloadEdicion)

      expect(res.status).toBe(400)
      expect(res.body.message).toMatch(/No se puede editar/)
    })

    it('debe rechazar con 403 Forbidden para rol Docente', async () => {
      const appDocente = createAppWithUser('Docente')

      const res = await request(appDocente)
        .patch(`/api/v1/incidentes/${mockIncidenteId}/reportes/${mockReporteId}`)
        .send(payloadEdicion)

      expect(res.status).toBe(403)
      expect(reportesService.guardarEdicionBorrador).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/v1/incidentes/:id/reportes/:reporteId/aprobar', () => {
    it('debe permitir aprobar el reporte a Administrador, Directivo y Equipo de Formación', async () => {
      const mockAprobado = {
        id: mockReporteId,
        estado: 'Aprobado',
        aprobado_por: mockUserId,
      }
      reportesService.aprobarReporte.mockResolvedValue(mockAprobado)

      const res = await request(app)
        .post(`/api/v1/incidentes/${mockIncidenteId}/reportes/${mockReporteId}/aprobar`)
        .send({})

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('success')
      expect(reportesService.aprobarReporte).toHaveBeenCalledWith({
        tenantId: mockTenantId,
        reporteId: mockReporteId,
        aprobadoPor: mockUserId,
        contenidoFinal: undefined,
      })
    })

    it('debe rechazar con 403 Forbidden si un Inspector intenta aprobar el reporte', async () => {
      const appInspector = createAppWithUser('Inspector')

      const res = await request(appInspector)
        .post(`/api/v1/incidentes/${mockIncidenteId}/reportes/${mockReporteId}/aprobar`)
        .send({})

      expect(res.status).toBe(403)
      expect(res.body.message).toMatch(/No tienes permisos/)
      expect(reportesService.aprobarReporte).not.toHaveBeenCalled()
    })

    it('debe rechazar con 403 Forbidden si un Docente intenta aprobar el reporte', async () => {
      const appDocente = createAppWithUser('Docente')

      const res = await request(appDocente)
        .post(`/api/v1/incidentes/${mockIncidenteId}/reportes/${mockReporteId}/aprobar`)
        .send({})

      expect(res.status).toBe(403)
      expect(reportesService.aprobarReporte).not.toHaveBeenCalled()
    })
  })
})
