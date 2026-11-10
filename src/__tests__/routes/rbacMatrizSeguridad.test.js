const request = require('supertest')
const express = require('express')

// Mocks de dependencias para aislar la validación de RBAC
jest.mock('../../controllers/analyticsController', () => ({
  getResumen: jest.fn((req, res) => res.json({ success: true, data: {} })),
  getTendenciaMensual: jest.fn((req, res) => res.json({ success: true, data: [] })),
  getPorGravedad: jest.fn((req, res) => res.json({ success: true, data: [] })),
  getTopEstudiantes: jest.fn((req, res) => res.json({ success: true, data: [] })),
  getTiempoResolucion: jest.fn((req, res) => res.json({ success: true, data: {} })),
  getMapaCalorCursos: jest.fn((req, res) => res.json({ success: true, data: [] })),
  getDetalleCeldaMapaCalor: jest.fn((req, res) => res.json({ success: true, data: {} })),
  getUsuariosActividad: jest.fn((req, res) => res.json({ success: true, data: [] })),
  getPorAbordaje: jest.fn((req, res) => res.json({ success: true, data: [] })),
  descargarReporteMensualPdf: jest.fn((req, res) => res.status(200).send('PDF_BUFFER'))
}))

jest.mock('../../services/auditoriaService', () => ({
  getAuditoriaTimeline: jest.fn().mockResolvedValue([]),
  getAuditoriaLogs: jest.fn().mockResolvedValue([])
}))

jest.mock('../../services/riesgoService', () => ({
  calcularRiesgoEstudiante: jest.fn().mockResolvedValue({ score: 10 }),
  getEstudiantesConRiesgo: jest.fn().mockResolvedValue([])
}))

jest.mock('../../services/pdfService', () => ({
  generarPerfilEstudiante: jest.fn().mockResolvedValue(Buffer.from('PDF'))
}))

jest.mock('../../middlewares/cache', () => () => (req, res, next) => next())
jest.mock('../../middlewares/authenticateToken', () => (req, res, next) => next())
jest.mock('../../utils/db', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 1, rut: '12345678-9' }, error: null }),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null })
    }))
  }
}))

const analyticsRoutes = require('../../routes/analytics.routes')
const auditoriaRoutes = require('../../routes/auditoria.routes')
const riesgoRoutes = require('../../routes/riesgo')

describe('Matriz de Seguridad RBAC — Verificación de Rutas y Roles', () => {
  const mockTenantId = '1ea5232c-3631-4271-990c-8b4bf4d93db6'
  const mockUserId = '5d6b656a-e3a0-49fd-ad9e-c90f5df12bff'

  const buildApp = (userRole = null) => {
    const app = express()
    app.use(express.json())

    if (userRole !== null) {
      app.use((req, res, next) => {
        req.user = {
          user_id: mockUserId,
          tenant_id: mockTenantId,
          rol: userRole
        }
        next()
      })
    }

    app.use('/api/v1/analytics', analyticsRoutes)
    app.use('/api/v1/auditoria', auditoriaRoutes)
    app.use('/api/v1/riesgo', riesgoRoutes)

    return app
  }

  describe('Módulo Analytics (/api/v1/analytics)', () => {
    it('debe rechazar con 401 si no hay usuario autenticado', async () => {
      const app = buildApp(null)
      const res = await request(app).get('/api/v1/analytics/resumen')
      expect(res.status).toBe(401)
      expect(res.body.message).toMatch(/Token ausente/)
    })

    it('debe denegar con 403 el acceso a Docentes en métricas de analítica', async () => {
      const app = buildApp('Docente')
      const res = await request(app).get('/api/v1/analytics/resumen')
      expect(res.status).toBe(403)
      expect(res.body.message).toMatch(/No tienes permisos/)
    })

    it('debe permitir acceso a métricas a Administrador, Directivo, Equipo de Formación e Inspector', async () => {
      const rolesPermitidos = ['Administrador', 'Directivo', 'Equipo de Formación', 'Inspector']

      for (const rol of rolesPermitidos) {
        const app = buildApp(rol)
        const res = await request(app).get('/api/v1/analytics/resumen')
        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
      }
    })

    it('debe restringir la descarga de reporte mensual ejecutivo PDF a Directivos, Administrador y Equipo de Formación (denegar Inspector y Docente)', async () => {
      // Inspector no debe tener acceso a descarga de reporte ejecutivo PDF
      const appInspector = buildApp('Inspector')
      const resInspector = await request(appInspector).get('/api/v1/analytics/reporte-mensual-pdf')
      expect(resInspector.status).toBe(403)

      // Docente no debe tener acceso
      const appDocente = buildApp('Docente')
      const resDocente = await request(appDocente).get('/api/v1/analytics/reporte-mensual-pdf')
      expect(resDocente.status).toBe(403)

      // Directivo sí tiene acceso
      const appDirectivo = buildApp('Directivo')
      const resDirectivo = await request(appDirectivo).get('/api/v1/analytics/reporte-mensual-pdf')
      expect(resDirectivo.status).toBe(200)

      // Administrador sí tiene acceso
      const appAdmin = buildApp('Administrador')
      const resAdmin = await request(appAdmin).get('/api/v1/analytics/reporte-mensual-pdf')
      expect(resAdmin.status).toBe(200)

      // Equipo de Formación sí tiene acceso
      const appConvivencia = buildApp('Equipo de Formación')
      const resConvivencia = await request(appConvivencia).get('/api/v1/analytics/reporte-mensual-pdf')
      expect(resConvivencia.status).toBe(200)
    })
  })

  describe('Módulo Auditoría (/api/v1/auditoria)', () => {
    it('debe denegar /logs a Inspectores, Docentes y Equipo de Formación', async () => {
      for (const rol of ['Inspector', 'Docente', 'Equipo de Formación', 'Directivo']) {
        const app = buildApp(rol)
        const res = await request(app).get('/api/v1/auditoria/logs')
        expect(res.status).toBe(403)
      }
    })

    it('debe permitir /logs exclusivamente a Administrador', async () => {
      const app = buildApp('Administrador')
      const res = await request(app).get('/api/v1/auditoria/logs')
      expect(res.status).toBe(200)
    })

    it('debe permitir /timeline a Administrador, Directivo y Equipo de Formación', async () => {
      for (const rol of ['Administrador', 'Directivo', 'Equipo de Formación']) {
        const app = buildApp(rol)
        const res = await request(app)
          .get('/api/v1/auditoria/timeline')
          .query({ tabla: 'incidentes', registroId: 'uuid-1' })
        expect(res.status).toBe(200)
      }
    })

    it('debe denegar /timeline a Docente e Inspector', async () => {
      for (const rol of ['Docente', 'Inspector']) {
        const app = buildApp(rol)
        const res = await request(app)
          .get('/api/v1/auditoria/timeline')
          .query({ tabla: 'incidentes', registroId: 'uuid-1' })
        expect(res.status).toBe(403)
      }
    })
  })

  describe('Módulo Riesgo Escolar (/api/v1/riesgo)', () => {
    it('debe permitir /riesgo/estudiante/:id a todos los roles operativos incluyendo Docente', async () => {
      for (const rol of ['Administrador', 'Directivo', 'Equipo de Formación', 'Inspector', 'Docente']) {
        const app = buildApp(rol)
        const res = await request(app).get('/api/v1/riesgo/estudiante/1')
        expect(res.status).toBe(200)
      }
    })

    it('debe denegar /riesgo/estudiantes (ranking global institucional) al rol Docente', async () => {
      const app = buildApp('Docente')
      const res = await request(app).get('/api/v1/riesgo/estudiantes')
      expect(res.status).toBe(403)
    })

    it('debe permitir /riesgo/estudiantes a Administrador, Directivo, Equipo de Formación e Inspector', async () => {
      for (const rol of ['Administrador', 'Directivo', 'Equipo de Formación', 'Inspector']) {
        const app = buildApp(rol)
        const res = await request(app).get('/api/v1/riesgo/estudiantes')
        expect(res.status).toBe(200)
      }
    })
  })
})
