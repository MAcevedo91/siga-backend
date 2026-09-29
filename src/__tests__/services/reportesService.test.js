const reportesService = require('../../services/reportesService')
const { supabase } = require('../../utils/db')
const { registrarAuditoria } = require('../../services/auditoriaService')

jest.mock('../../utils/db')
jest.mock('../../services/auditoriaService', () => ({
  registrarAuditoria: jest.fn().mockResolvedValue(true),
}))
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}))

describe('reportesService — Persistencia y Validación de Reportes (Tarea 6.1.1)', () => {
  const mockTenantId = '11111111-1111-4111-8111-111111111111'
  const mockIncidenteId = '22222222-2222-4222-8222-222222222222'
  const mockEstudianteId = '33333333-3333-4333-8333-333333333333'
  const mockUsuarioId = '44444444-4444-4444-8444-444444444444'
  const mockReporteId = '55555555-5555-4555-8555-555555555555'

  const mockSeccionesValidas = {
    contexto: 'Patio central de la escuela durante el segundo recreo de la jornada matutina.',
    hechos_objetivos: 'Se produce una discusión verbal entre estudiantes que deriva en empujones físicos reportados por el inspector de patio.',
    medidas_adoptadas: 'Se traslada a los estudiantes a inspectoría general para contención inicial y aplicación de protocolo formativo.',
    acuerdos_compromisos: 'Ambas partes se comprometen a respetar los espacios de convivencia y acudir a mediación formativa.',
    plan_seguimiento: 'Seguimiento pedagógico semanal por parte de la dupla psicosocial y profesor jefe durante 30 días.',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Validación de Esquema Zod (seccionesReporteSchema)', () => {
    it('debe validar exitosamente un objeto con las 5 secciones requeridas', () => {
      expect(() => {
        reportesService.seccionesReporteSchema.parse(mockSeccionesValidas)
      }).not.toThrow()
    })

    it('debe rechazar con error si falta alguna sección obligatoria', () => {
      const incompleto = { ...mockSeccionesValidas }
      delete incompleto.plan_seguimiento

      expect(() => {
        reportesService.seccionesReporteSchema.parse(incompleto)
      }).toThrow()
    })

    it('debe rechazar si hechos_objetivos tiene menos de 20 caracteres', () => {
      const corto = { ...mockSeccionesValidas, hechos_objetivos: 'Hecho corto' }
      expect(() => {
        reportesService.seccionesReporteSchema.parse(corto)
      }).toThrow(/al menos 20 caracteres/)
    })
  })

  describe('crearBorradorReporte', () => {
    it('debe rechazar con 400 si el estudiante no figura vinculado en incidente_estudiantes', async () => {
      // Mock pertenencia retorna null
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      })

      await expect(
        reportesService.crearBorradorReporte({
          tenantId: mockTenantId,
          incidenteId: mockIncidenteId,
          estudianteId: mockEstudianteId,
          contenidoBorrador: mockSeccionesValidas,
          creadoPor: mockUsuarioId,
        })
      ).rejects.toMatchObject({
        status: 400,
        message: expect.stringMatching(/no figura como involucrado/),
      })
    })

    it('debe crear un nuevo borrador de reporte con estado "Borrador" y version 1', async () => {
      // 1. Mock pertenencia OK
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'part-1' }, error: null }),
      })

      // 2. Mock insert reporte
      const mockInsertResult = {
        id: mockReporteId,
        tenant_id: mockTenantId,
        incidente_id: mockIncidenteId,
        estudiante_id: mockEstudianteId,
        version: 1,
        estado: 'Borrador',
        contenido_borrador: mockSeccionesValidas,
        creado_por: mockUsuarioId,
      }

      supabase.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockInsertResult, error: null }),
      })

      const resultado = await reportesService.crearBorradorReporte({
        tenantId: mockTenantId,
        incidenteId: mockIncidenteId,
        estudianteId: mockEstudianteId,
        contenidoBorrador: mockSeccionesValidas,
        creadoPor: mockUsuarioId,
      })

      expect(resultado).toBeDefined()
      expect(resultado.estado).toBe('Borrador')
      expect(resultado.version).toBe(1)
      expect(registrarAuditoria).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'CREAR_BORRADOR_REPORTE',
          tabla_afectada: 'reportes_incidentes',
        })
      )
    })

    it('debe retornar 409 si ya existe un borrador de esa versión para el estudiante (código 23505)', async () => {
      // 1. Mock pertenencia OK
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'part-1' }, error: null }),
      })

      // 2. Mock insert con error 23505
      supabase.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key' } }),
      })

      await expect(
        reportesService.crearBorradorReporte({
          tenantId: mockTenantId,
          incidenteId: mockIncidenteId,
          estudianteId: mockEstudianteId,
          contenidoBorrador: mockSeccionesValidas,
          creadoPor: mockUsuarioId,
        })
      ).rejects.toMatchObject({
        status: 409,
        message: expect.stringMatching(/Ya existe un borrador/),
      })
    })
  })

  describe('obtenerReportesPorIncidente y obtenerReportePorId', () => {
    it('debe retornar lista de reportes para un incidente', async () => {
      const mockList = [
        { id: 'rep-1', estado: 'Borrador', version: 1 },
        { id: 'rep-2', estado: 'Aprobado', version: 1 },
      ]

      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockList, error: null }),
      })

      const resultado = await reportesService.obtenerReportesPorIncidente(mockTenantId, mockIncidenteId)
      expect(resultado).toHaveLength(2)
      expect(resultado[0].id).toBe('rep-1')
    })

    it('debe rechazar con 404 si el reporte no existe', async () => {
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      })

      await expect(
        reportesService.obtenerReportePorId(mockTenantId, 'non-existent-id')
      ).rejects.toMatchObject({
        status: 404,
        message: 'Reporte no encontrado',
      })
    })
  })

  describe('guardarEdicionBorrador', () => {
    const mockSeccionesEditadas = {
      ...mockSeccionesValidas,
      hechos_objetivos: 'Versión editada con mayor precisión cronológica de los acontecimientos en patio.',
    }

    it('debe guardar las modificaciones en contenido_editado sin alterar el estado Borrador', async () => {
      // Mock obtenerReportePorId (reporte actual en Borrador)
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { id: mockReporteId, estado: 'Borrador', contenido_borrador: mockSeccionesValidas },
          error: null,
        }),
      })

      // Mock update
      supabase.from.mockReturnValueOnce({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: mockReporteId,
            estado: 'Borrador',
            contenido_borrador: mockSeccionesValidas,
            contenido_editado: mockSeccionesEditadas,
          },
          error: null,
        }),
      })

      const resultado = await reportesService.guardarEdicionBorrador({
        tenantId: mockTenantId,
        reporteId: mockReporteId,
        contenidoEditado: mockSeccionesEditadas,
        modificadoPor: mockUsuarioId,
      })

      expect(resultado.contenido_editado).toEqual(mockSeccionesEditadas)
      expect(resultado.estado).toBe('Borrador')
    })

    it('debe rechazar con 400 si se intenta editar un reporte que ya está Aprobado', async () => {
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { id: mockReporteId, estado: 'Aprobado' },
          error: null,
        }),
      })

      await expect(
        reportesService.guardarEdicionBorrador({
          tenantId: mockTenantId,
          reporteId: mockReporteId,
          contenidoEditado: mockSeccionesEditadas,
          modificadoPor: mockUsuarioId,
        })
      ).rejects.toMatchObject({
        status: 400,
        message: expect.stringMatching(/ya ha sido aprobado/),
      })
    })
  })

  describe('aprobarReporte', () => {
    it('debe aprobar el reporte, asignar aprobado_por, fecha_aprobacion y registrar auditoría', async () => {
      // Mock obtenerReportePorId (reporte actual en Borrador)
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            id: mockReporteId,
            incidente_id: mockIncidenteId,
            estudiante_id: mockEstudianteId,
            estado: 'Borrador',
            contenido_borrador: mockSeccionesValidas,
            contenido_editado: null,
          },
          error: null,
        }),
      })

      // Mock update a Aprobado
      const mockAprobadoResult = {
        id: mockReporteId,
        estado: 'Aprobado',
        contenido_aprobado: mockSeccionesValidas,
        aprobado_por: mockUsuarioId,
        fecha_aprobacion: '2026-09-29T10:00:00.000Z',
      }

      supabase.from.mockReturnValueOnce({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockAprobadoResult,
          error: null,
        }),
      })

      const resultado = await reportesService.aprobarReporte({
        tenantId: mockTenantId,
        reporteId: mockReporteId,
        aprobadoPor: mockUsuarioId,
      })

      expect(resultado.estado).toBe('Aprobado')
      expect(resultado.aprobado_por).toBe(mockUsuarioId)
      expect(registrarAuditoria).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'APROBAR_REPORTE_INCIDENTE',
          tabla_afectada: 'reportes_incidentes',
        })
      )
    })

    it('debe rechazar con 400 si el reporte ya se encontraba Aprobado', async () => {
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { id: mockReporteId, estado: 'Aprobado' },
          error: null,
        }),
      })

      await expect(
        reportesService.aprobarReporte({
          tenantId: mockTenantId,
          reporteId: mockReporteId,
          aprobadoPor: mockUsuarioId,
        })
      ).rejects.toMatchObject({
        status: 400,
        message: expect.stringMatching(/ya se encuentra aprobado/),
      })
    })
  })
})
