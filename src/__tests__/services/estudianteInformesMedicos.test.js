const reporteEspecialistaService = require('../../services/reporteEspecialistaService')
const {
  listarInformesMedicosEstudianteHandler,
  descargarFichaSaludPdfHandler,
} = require('../../controllers/reporteEspecialistaController')
const { supabase } = require('../../utils/db')
const requireRole = require('../../middlewares/requireRole')

jest.mock('../../utils/db', () => ({
  supabase: {
    from: jest.fn(),
  },
}))

describe('TASK 8.2.2.1 — Tabla estudiante_informes_medicos y Endpoints de Historial', () => {
  const mockTenantId = 'tenant-uuid-1111-2222-3333-444444444444'
  const mockEstudianteId = 'est-uuid-5555-6666-7777-888888888888'
  const mockUsuarioId = 'usr-uuid-9999-0000-1111-222222222222'

  const mockEstudiante = {
    id: mockEstudianteId,
    nombre: 'Martín',
    apellido: 'Gómez',
    rut: '21.456.789-0',
    curso_id: 'curso-1',
    tenant_id: mockTenantId,
  }

  const mockRegistroInsertado = {
    id: 'informe-uuid-1',
    tenant_id: mockTenantId,
    estudiante_id: mockEstudianteId,
    usuario_emisor_id: mockUsuarioId,
    especialista_destino: 'Dr. Alejandro Silva - Neurólogo Infantil',
    motivo: 'Evaluación TDAH y focalización en aula',
    notas: 'Se remite tras entrevista con apoderado',
    hash_sha256: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
    total_incidentes_incluidos: 2,
    total_mediaciones_incluidas: 1,
    fecha_emision: '2026-10-26T10:00:00.000Z',
    created_at: '2026-10-26T10:00:00.000Z',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Criterio 1: Persistencia de Informes Médicos (registrarEmisionInformeMedico)', () => {
    it('debe insertar correctamente el registro con hash SHA-256, especialista de destino y usuario emisor', async () => {
      const mockSingle = jest.fn().mockResolvedValueOnce({
        data: mockRegistroInsertado,
        error: null,
      })
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle })
      const mockInsert = jest.fn().mockReturnValue({ select: mockSelect })

      supabase.from.mockReturnValueOnce({ insert: mockInsert })

      const payload = {
        tenantId: mockTenantId,
        estudianteId: mockEstudianteId,
        usuarioEmisorId: mockUsuarioId,
        especialistaDestino: 'Dr. Alejandro Silva - Neurólogo Infantil',
        motivo: 'Evaluación TDAH y focalización en aula',
        notas: 'Se remite tras entrevista con apoderado',
        hashSha256: mockRegistroInsertado.hash_sha256,
        totalIncidentes: 2,
        totalMediaciones: 1,
      }

      const resultado = await reporteEspecialistaService.registrarEmisionInformeMedico(payload)

      expect(supabase.from).toHaveBeenCalledWith('estudiante_informes_medicos')
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: mockTenantId,
          estudiante_id: mockEstudianteId,
          usuario_emisor_id: mockUsuarioId,
          especialista_destino: 'Dr. Alejandro Silva - Neurólogo Infantil',
          hash_sha256: mockRegistroInsertado.hash_sha256,
          total_incidentes_incluidos: 2,
          total_mediaciones_incluidas: 1,
        })
      )
      expect(resultado).toEqual(mockRegistroInsertado)
    })

    it('debe arrojar error 400 si faltan parámetros obligatorios (tenantId, estudianteId, especialistaDestino, hashSha256)', async () => {
      await expect(
        reporteEspecialistaService.registrarEmisionInformeMedico({
          tenantId: mockTenantId,
          estudianteId: mockEstudianteId,
          // falta especialistaDestino y hashSha256
        })
      ).rejects.toMatchObject({
        status: 400,
        message: expect.stringContaining('Parámetros obligatorios faltantes'),
      })
    })
  })

  describe('Criterio 2: Consulta Paginada de Historial (listarInformesMedicosEstudiante)', () => {
    it('debe retornar lista paginada con total, totalPages, items y datos del estudiante', async () => {
      // 1. Mock de validación de estudiante
      const mockEstudianteSingle = jest.fn().mockResolvedValueOnce({
        data: mockEstudiante,
        error: null,
      })
      const mockEstSelect = {
        eq: jest.fn().mockReturnThis(),
        single: mockEstudianteSingle,
      }

      // 2. Mock de consulta paginada de informes
      const mockRange = jest.fn().mockResolvedValueOnce({
        data: [
          {
            ...mockRegistroInsertado,
            usuarios: {
              id: mockUsuarioId,
              nombre: 'Constanza Valenzuela',
              email: 'cvalenzuela@elsalvador.cl',
              rol: 'Equipo de Formación',
            },
          },
        ],
        count: 1,
        error: null,
      })
      const mockOrder = { range: mockRange }
      const mockInfEqTenant = { order: jest.fn().mockReturnValue(mockOrder) }
      const mockInfEqEst = { eq: jest.fn().mockReturnValue(mockInfEqTenant) }
      const mockInfSelect = { eq: jest.fn().mockReturnValue(mockInfEqEst) }

      supabase.from
        .mockReturnValueOnce({ select: jest.fn().mockReturnValue(mockEstSelect) })
        .mockReturnValueOnce({ select: jest.fn().mockReturnValue(mockInfSelect) })

      const resultado = await reporteEspecialistaService.listarInformesMedicosEstudiante({
        tenantId: mockTenantId,
        estudianteId: mockEstudianteId,
        page: 1,
        limit: 10,
      })

      expect(resultado.estudiante).toEqual({
        id: mockEstudianteId,
        nombre_completo: 'Martín Gómez',
        rut: '21.456.789-0',
      })
      expect(resultado.items).toHaveLength(1)
      expect(resultado.items[0].hash_sha256).toBe(mockRegistroInsertado.hash_sha256)
      expect(resultado.items[0].usuarios.nombre).toBe('Constanza Valenzuela')
      expect(resultado.pagination).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      })
    })

    it('debe calcular correctamente los rangos y páginas cuando se especifica page=2 y limit=5', async () => {
      const mockEstudianteSingle = jest.fn().mockResolvedValueOnce({
        data: mockEstudiante,
        error: null,
      })
      const mockEstSelect = {
        eq: jest.fn().mockReturnThis(),
        single: mockEstudianteSingle,
      }

      const mockRange = jest.fn().mockResolvedValueOnce({
        data: [],
        count: 12,
        error: null,
      })
      const mockOrder = { range: mockRange }
      const mockInfEqTenant = { order: jest.fn().mockReturnValue(mockOrder) }
      const mockInfEqEst = { eq: jest.fn().mockReturnValue(mockInfEqTenant) }
      const mockInfSelect = { eq: jest.fn().mockReturnValue(mockInfEqEst) }

      supabase.from
        .mockReturnValueOnce({ select: jest.fn().mockReturnValue(mockEstSelect) })
        .mockReturnValueOnce({ select: jest.fn().mockReturnValue(mockInfSelect) })

      const resultado = await reporteEspecialistaService.listarInformesMedicosEstudiante({
        tenantId: mockTenantId,
        estudianteId: mockEstudianteId,
        page: 2,
        limit: 5,
      })

      // page 2, limit 5 -> desde 5, hasta 9
      expect(mockRange).toHaveBeenCalledWith(5, 9)
      expect(resultado.pagination).toEqual({
        total: 12,
        page: 2,
        limit: 5,
        totalPages: 3,
        hasNextPage: true,
        hasPrevPage: true,
      })
    })

    it('debe arrojar 404 si el estudiante no existe en el tenant', async () => {
      const mockEstudianteSingle = jest.fn().mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      })
      const mockEstSelect = {
        eq: jest.fn().mockReturnThis(),
        single: mockEstudianteSingle,
      }

      supabase.from.mockReturnValueOnce({ select: jest.fn().mockReturnValue(mockEstSelect) })

      await expect(
        reporteEspecialistaService.listarInformesMedicosEstudiante({
          tenantId: mockTenantId,
          estudianteId: 'no-existe',
        })
      ).rejects.toMatchObject({
        status: 404,
        message: expect.stringContaining('Estudiante no encontrado'),
      })
    })

    it('debe arrojar 400 si falta estudianteId o tenantId', async () => {
      await expect(
        reporteEspecialistaService.listarInformesMedicosEstudiante({
          tenantId: null,
          estudianteId: mockEstudianteId,
        })
      ).rejects.toMatchObject({ status: 400 })

      await expect(
        reporteEspecialistaService.listarInformesMedicosEstudiante({
          tenantId: mockTenantId,
          estudianteId: null,
        })
      ).rejects.toMatchObject({ status: 400 })
    })
  })

  describe('Criterio 2 y 3: Controlador Express y Restricción de Autorización RBAC', () => {
    it('listarInformesMedicosEstudianteHandler debe responder HTTP 200 con el historial paginado', async () => {
      jest.spyOn(reporteEspecialistaService, 'listarInformesMedicosEstudiante').mockResolvedValueOnce({
        estudiante: { id: mockEstudianteId, nombre_completo: 'Martín Gómez' },
        items: [mockRegistroInsertado],
        pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
      })

      const req = {
        user: { tenant_id: mockTenantId, id: mockUsuarioId, rol: 'Equipo de Formación' },
        params: { id: mockEstudianteId },
        query: { page: '1', limit: '10' },
      }
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      }
      const next = jest.fn()

      await listarInformesMedicosEstudianteHandler(req, res, next)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          items: expect.arrayContaining([mockRegistroInsertado]),
        })
      )
      expect(next).not.toHaveBeenCalled()
    })

    it('listarInformesMedicosEstudianteHandler debe delegar excepciones a next(err)', async () => {
      const errorForzado = new Error('Database connection failed')
      jest.spyOn(reporteEspecialistaService, 'listarInformesMedicosEstudiante').mockRejectedValueOnce(errorForzado)

      const req = {
        user: { tenant_id: mockTenantId },
        params: { id: mockEstudianteId },
        query: {},
      }
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      }
      const next = jest.fn()

      await listarInformesMedicosEstudianteHandler(req, res, next)

      expect(next).toHaveBeenCalledWith(errorForzado)
    })

    describe('Restricción RBAC de Roles para Historial Médico', () => {
      const middleware = requireRole('Administrador', 'Directivo', 'Equipo de Formación')

      it('debe autorizar a Administrador, Directivo y Equipo de Formación', () => {
        const rolesValidos = ['Administrador', 'Directivo', 'Equipo de Formación']

        rolesValidos.forEach((rol) => {
          const req = { user: { id: 'u-1', rol } }
          const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }
          const next = jest.fn()

          middleware(req, res, next)
          expect(next).toHaveBeenCalled()
          expect(res.status).not.toHaveBeenCalled()
        })
      })

      it('debe rechazar con HTTP 403 Forbidden a roles sin autorización (Docente, Inspector, Apoderado)', () => {
        const rolesNoAutorizados = ['Docente', 'Inspector', 'Apoderado']

        rolesNoAutorizados.forEach((rol) => {
          const req = { user: { id: 'u-2', rol } }
          const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }
          const next = jest.fn()

          middleware(req, res, next)
          expect(res.status).toHaveBeenCalledWith(403)
          expect(next).not.toHaveBeenCalled()
        })
      })
    })
  })

  describe('Integración: Auto-registro al descargar PDF oficial', () => {
    it('descargarFichaSaludPdfHandler debe invocar registrarEmisionInformeMedico', async () => {
      const mockExpediente = {
        estudiante_evaluado: { id: mockEstudianteId, rut: '21.456.789-0', nombre_completo: 'Martín Gómez' },
        resumen_clinico_escolar: { destinatario_especialista: 'Neurólogo', motivo_informe: 'Diagnóstico' },
        incidentes: [{ id: 'inc-1' }],
        mediaciones: [],
      }

      jest.spyOn(reporteEspecialistaService, 'extraerExpedienteEspecialistaSalud').mockResolvedValueOnce(mockExpediente)
      const spyRegistrar = jest.spyOn(reporteEspecialistaService, 'registrarEmisionInformeMedico').mockResolvedValueOnce({})

      const req = {
        user: { tenant_id: mockTenantId, id: mockUsuarioId, rol: 'Equipo de Formación' },
        params: { id: mockEstudianteId },
        query: { especialista: 'Dr. Silva', motivo: 'Evaluación' },
      }
      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      }
      const next = jest.fn()

      await descargarFichaSaludPdfHandler(req, res, next)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(spyRegistrar).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: mockTenantId,
          estudianteId: mockEstudianteId,
          usuarioEmisorId: mockUsuarioId,
          especialistaDestino: 'Dr. Silva',
          hashSha256: expect.any(String),
        })
      )
    })
  })
})
