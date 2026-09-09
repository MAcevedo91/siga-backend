const configuracionService = require('../../services/configuracionService')
const dashboardService = require('../../services/dashboardService')
const { supabase } = require('../../utils/db')
const { registrarAuditoria } = require('../../services/auditoriaService')

jest.mock('../../utils/db')
jest.mock('../../services/auditoriaService', () => ({
  registrarAuditoria: jest.fn().mockResolvedValue({ id: 'audit-config-1' }),
}))
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}))

describe('configuracionService — Parámetros Dinámicos y Editor de Plazos RICE (HU 5.3)', () => {
  const mockTenantId = '11111111-1111-4111-8111-111111111111'
  const mockUserId = '22222222-2222-4222-8222-222222222222'
  const mockReglaId = '33333333-3333-4333-8333-333333333333'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('obtenerConfiguracion()', () => {
    it('debe retornar fallback con DEFAULT_CONFIG si el tenant no tiene registro en configuracion_tenant', async () => {
      supabase.from.mockImplementation((table) => {
        if (table === 'configuracion_tenant') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          }
        }
        if (table === 'reglas_protocolo') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }
        }
      })

      const config = await configuracionService.obtenerConfiguracion(mockTenantId)

      expect(config.parametros.umbral_riesgo).toBe(6)
      expect(config.parametros.ventana_dias_riesgo).toBe(30)
      expect(config.parametros.ventana_dias_reincidencia).toBe(45)
      expect(config.parametros.ventana_dias_escalada).toBe(15)
      expect(config.reglas).toEqual([])
    })

    it('debe retornar los parámetros personalizados y las reglas de protocolo existentes', async () => {
      const mockConfigDB = {
        id: 'conf-1',
        tenant_id: mockTenantId,
        umbral_riesgo: 8,
        ventana_dias_riesgo: 40,
        ventana_dias_reincidencia: 60,
        ventana_dias_escalada: 20,
        updated_at: '2026-09-08T14:00:00Z',
      }
      const mockReglasDB = [
        {
          id: mockReglaId,
          orden: 1,
          accion: 'Entrevista inicial',
          plazo_dias: 3,
          prorrogable: false,
          activo: true,
          tipo_protocolo_id: 1,
          tipo_protocolo: { id: 1, nombre: 'Maltrato entre estudiantes' },
        },
      ]

      supabase.from.mockImplementation((table) => {
        if (table === 'configuracion_tenant') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: mockConfigDB, error: null }),
          }
        }
        if (table === 'reglas_protocolo') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: mockReglasDB, error: null }),
            }),
          }
        }
      })

      const config = await configuracionService.obtenerConfiguracion(mockTenantId)

      expect(config.parametros.umbral_riesgo).toBe(8)
      expect(config.parametros.ventana_dias_riesgo).toBe(40)
      expect(config.parametros.ventana_dias_reincidencia).toBe(60)
      expect(config.parametros.ventana_dias_escalada).toBe(20)
      expect(config.reglas).toHaveLength(1)
      expect(config.reglas[0].accion).toBe('Entrevista inicial')
    })
  })

  describe('actualizarConfiguracion()', () => {
    it('debe rechazar con 400 si algún parámetro numérico es <= 0 o no es entero', async () => {
      await expect(
        configuracionService.actualizarConfiguracion(mockTenantId, mockUserId, { umbral_riesgo: 0 }, '127.0.0.1')
      ).rejects.toThrow('El campo "umbral_riesgo" debe ser un número entero mayor a 0')

      await expect(
        configuracionService.actualizarConfiguracion(mockTenantId, mockUserId, { ventana_dias_riesgo: -5 }, '127.0.0.1')
      ).rejects.toThrow('El campo "ventana_dias_riesgo" debe ser un número entero mayor a 0')

      await expect(
        configuracionService.actualizarConfiguracion(mockTenantId, mockUserId, { ventana_dias_escalada: 3.5 }, '127.0.0.1')
      ).rejects.toThrow('El campo "ventana_dias_escalada" debe ser un número entero mayor a 0')
    })

    it('debe actualizar configuracion_tenant, invocar auditoría y retornar datos actualizados', async () => {
      const mockActualizado = {
        id: 'conf-1',
        tenant_id: mockTenantId,
        umbral_riesgo: 8,
        ventana_dias_riesgo: 35,
        ventana_dias_reincidencia: 50,
        ventana_dias_escalada: 12,
        updated_at: '2026-09-08T15:00:00Z',
      }

      supabase.from.mockImplementation((table) => {
        if (table === 'configuracion_tenant') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: {
                id: 'conf-1',
                tenant_id: mockTenantId,
                umbral_riesgo: 6,
                ventana_dias_riesgo: 30,
              },
              error: null,
            }),
            upsert: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockActualizado, error: null }),
          }
        }
      })

      const resultado = await configuracionService.actualizarConfiguracion(
        mockTenantId,
        mockUserId,
        { umbral_riesgo: 8, ventana_dias_riesgo: 35 },
        '192.168.1.50'
      )

      expect(resultado.umbral_riesgo).toBe(8)
      expect(resultado.ventana_dias_riesgo).toBe(35)
      expect(registrarAuditoria).toHaveBeenCalledWith(
        expect.objectContaining({
          tabla: 'configuracion_tenant',
          accion: 'UPDATE',
          registroId: 'conf-1',
        })
      )
    })
  })

  describe('actualizarPlazoRegla()', () => {
    it('debe rechazar con 400 si plazo_dias <= 0 o no es entero', async () => {
      await expect(
        configuracionService.actualizarPlazoRegla(mockTenantId, mockReglaId, mockUserId, { plazo_dias: 0 }, '127.0.0.1')
      ).rejects.toThrow('El plazo en días debe ser un número entero mayor a 0')

      await expect(
        configuracionService.actualizarPlazoRegla(mockTenantId, mockReglaId, mockUserId, { plazo_dias: -3 }, '127.0.0.1')
      ).rejects.toThrow('El plazo en días debe ser un número entero mayor a 0')
    })

    it('debe rechazar con 404 si la regla no existe o no pertenece al tenant', async () => {
      supabase.from.mockImplementation((table) => {
        if (table === 'reglas_protocolo') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          }
        }
      })

      await expect(
        configuracionService.actualizarPlazoRegla(mockTenantId, mockReglaId, mockUserId, { plazo_dias: 5 }, '127.0.0.1')
      ).rejects.toThrow('Regla de protocolo no encontrada o no pertenece a este establecimiento')
    })

    it('debe actualizar el plazo en días de la regla y registrar auditoría', async () => {
      const mockReglaPrevia = {
        id: mockReglaId,
        tenant_id: mockTenantId,
        plazo_dias: 2,
        accion: 'Entrevista inicial',
      }
      const mockReglaActualizada = {
        id: mockReglaId,
        plazo_dias: 4,
        accion: 'Entrevista inicial extendida',
      }

      supabase.from.mockImplementation((table) => {
        if (table === 'reglas_protocolo') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockReglaPrevia, error: null }),
            update: jest.fn().mockReturnThis(),
          }
        }
      })

      // Setup chaining for update().eq().eq().select().single()
      const updateMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockReglaActualizada, error: null }),
            }),
          }),
        }),
      })

      supabase.from.mockImplementation((table) => {
        if (table === 'reglas_protocolo') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: mockReglaPrevia, error: null }),
                }),
              }),
            }),
            update: updateMock,
          }
        }
      })

      const res = await configuracionService.actualizarPlazoRegla(
        mockTenantId,
        mockReglaId,
        mockUserId,
        { plazo_dias: 4, accion: 'Entrevista inicial extendida' },
        '127.0.0.1'
      )

      expect(res.plazo_dias).toBe(4)
      expect(registrarAuditoria).toHaveBeenCalledWith(
        expect.objectContaining({
          tabla: 'reglas_protocolo',
          accion: 'UPDATE',
          registroId: mockReglaId,
        })
      )
    })
  })

  describe('Impacto Dinámico en getEstudiantesEnRiesgo()', () => {
    it('debe ajustar dinámicamente el umbral de filtrado según configuracion_tenant', async () => {
      // Mock student rows:
      // Student 1: score = 7
      // Student 2: score = 9
      const mockRows = [
        {
          estudiante_id: 'est-1',
          estudiantes: { id: 'est-1', nombre: 'Alumno', apellido: 'Uno', rut: '1-1', cursos: { nombre: '1A' } },
          incidentes: { id: 'inc-1', fecha: '2026-09-01', gravedad: 'Grave' }, // 2 + 3 = 5
        },
        {
          estudiante_id: 'est-1',
          estudiantes: { id: 'est-1', nombre: 'Alumno', apellido: 'Uno', rut: '1-1', cursos: { nombre: '1A' } },
          incidentes: { id: 'inc-2', fecha: '2026-09-02', gravedad: 'Leve' },  // + 2 = 7 total score
        },
        {
          estudiante_id: 'est-2',
          estudiantes: { id: 'est-2', nombre: 'Alumno', apellido: 'Dos', rut: '2-2', cursos: { nombre: '1A' } },
          incidentes: { id: 'inc-3', fecha: '2026-09-01', gravedad: 'Gravísima' }, // 2 + 5 = 7
        },
        {
          estudiante_id: 'est-2',
          estudiantes: { id: 'est-2', nombre: 'Alumno', apellido: 'Dos', rut: '2-2', cursos: { nombre: '1A' } },
          incidentes: { id: 'inc-4', fecha: '2026-09-02', gravedad: 'Leve' }, // + 2 = 9 total score
        },
      ]

      // Escenario A: umbral por defecto (6) -> Ambos alumnos (score 7 y 9) superan el umbral
      supabase.from.mockImplementation((table) => {
        if (table === 'configuracion_tenant') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: { umbral_riesgo: 6, ventana_dias_riesgo: 30 }, error: null }),
          }
        }
        if (table === 'incidente_estudiantes') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn().mockResolvedValue({ data: mockRows, error: null }),
          }
        }
      })

      const enRiesgoUmbral6 = await dashboardService.getEstudiantesEnRiesgo(mockTenantId)
      expect(enRiesgoUmbral6).toHaveLength(2)

      // Escenario B: umbral actualizado a 8 -> Solo Alumno Dos (score 9) califica en riesgo
      supabase.from.mockImplementation((table) => {
        if (table === 'configuracion_tenant') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: { umbral_riesgo: 8, ventana_dias_riesgo: 30 }, error: null }),
          }
        }
        if (table === 'incidente_estudiantes') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn().mockResolvedValue({ data: mockRows, error: null }),
          }
        }
      })

      const enRiesgoUmbral8 = await dashboardService.getEstudiantesEnRiesgo(mockTenantId)
      expect(enRiesgoUmbral8).toHaveLength(1)
      expect(enRiesgoUmbral8[0].id).toBe('est-2')
    })
  })
})
