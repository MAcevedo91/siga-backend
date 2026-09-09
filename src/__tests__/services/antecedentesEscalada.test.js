const alertasService = require('../../services/alertasService')
const { supabase } = require('../../utils/db')

jest.mock('../../utils/db')
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}))

describe('alertasService — Motor de Detección de Escalada y Reincidencia (HU 5.2 - Tarea 5.2.1)', () => {
  const mockTenantId = '11111111-1111-4111-8111-111111111111'
  const mockEstudianteId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('calcularDiasDiferencia()', () => {
    it('debe calcular correctamente la diferencia en días calendario UTC', () => {
      expect(alertasService.calcularDiasDiferencia('2026-08-01', '2026-08-01')).toBe(0)
      expect(alertasService.calcularDiasDiferencia('2026-08-01', '2026-08-10')).toBe(9)
      expect(alertasService.calcularDiasDiferencia('2026-08-01', '2026-08-16')).toBe(15)
      expect(alertasService.calcularDiasDiferencia('2026-08-01', '2026-08-17')).toBe(16)
    })
  })

  describe('getAntecedentesEscalada()', () => {
    it('debe rechazar con 404 si el estudiante no existe o no pertenece al tenant', async () => {
      supabase.from.mockImplementation((table) => {
        if (table === 'estudiantes') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          }
        }
      })

      await expect(
        alertasService.getAntecedentesEscalada(mockTenantId, mockEstudianteId)
      ).rejects.toThrow('Estudiante no encontrado o no pertenece a este establecimiento')
    })

    it('debe retornar tiene_alerta: false y nivel: null para un estudiante sin incidentes recientes', async () => {
      supabase.from.mockImplementation((table) => {
        if (table === 'estudiantes') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: mockEstudianteId, nombre: 'Juan', apellido: 'Pérez' },
              error: null,
            }),
          }
        }
        if (table === 'configuracion_tenant') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          }
        }
        if (table === 'incidente_estudiantes') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({ data: [], error: null }),
          }
        }
      })

      const tInicio = Date.now()
      const resultado = await alertasService.getAntecedentesEscalada(mockTenantId, mockEstudianteId)
      const duracion = Date.now() - tInicio

      expect(duracion).toBeLessThan(250) // Criterio de latencia < 250ms
      expect(resultado.tiene_alerta).toBe(false)
      expect(resultado.nivel).toBeNull()
      expect(resultado.reincidencia_ambito).toBe(false)
      expect(resultado.escalada_gravedad).toBe(false)
      expect(resultado.motivos).toHaveLength(0)
      expect(resultado.total_incidentes_recientes).toBe(0)
      expect(resultado.sugerencia_accion).toContain('sin alertas activas')
    })

    it('debe detectar Reincidencia de Ámbito (>= 2 faltas del mismo tipo en 45 días) con nivel advertencia', async () => {
      const hoy = new Date()
      const fecha1 = new Date(hoy.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const fecha2 = new Date(hoy.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const mockRows = [
        {
          incidente_id: 'inc-1',
          es_victima: false,
          incidentes: {
            id: 'inc-1',
            fecha: fecha1,
            gravedad: 'Leve',
            tipo_abordaje_id: 1,
            tenant_id: mockTenantId,
            tipos_abordaje: { id: 1, nombre: 'Agresión física o verbal' },
          },
        },
        {
          incidente_id: 'inc-2',
          es_victima: false,
          incidentes: {
            id: 'inc-2',
            fecha: fecha2,
            gravedad: 'Leve',
            tipo_abordaje_id: 1,
            tenant_id: mockTenantId,
            tipos_abordaje: { id: 1, nombre: 'Agresión física o verbal' },
          },
        },
      ]

      supabase.from.mockImplementation((table) => {
        if (table === 'estudiantes') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: mockEstudianteId, nombre: 'Matías', apellido: 'Gómez' },
              error: null,
            }),
          }
        }
        if (table === 'configuracion_tenant') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          }
        }
        if (table === 'incidente_estudiantes') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({ data: mockRows, error: null }),
          }
        }
      })

      const resultado = await alertasService.getAntecedentesEscalada(mockTenantId, mockEstudianteId)

      expect(resultado.tiene_alerta).toBe(true)
      expect(resultado.nivel).toBe('advertencia')
      expect(resultado.reincidencia_ambito).toBe(true)
      expect(resultado.escalada_gravedad).toBe(false)
      expect(resultado.detalles.ambitos_reincidentes).toHaveLength(1)
      expect(resultado.detalles.ambitos_reincidentes[0].nombre).toBe('Agresión física o verbal')
      expect(resultado.detalles.ambitos_reincidentes[0].cantidad).toBe(2)
      expect(resultado.motivos[0]).toContain('Reincidencia detectada: 2 faltas registradas en el ámbito "Agresión física o verbal"')
      expect(resultado.sugerencia_accion).toContain('entrevista formativa con apoderado')
    })

    it('debe detectar Escalada de Gravedad (Leve -> Grave en <= 15 días dentro de 30 días) con nivel crítico', async () => {
      const hoy = new Date()
      // Día 1: hace 12 días (Leve)
      const fechaLeve = new Date(hoy.getTime() - 12 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      // Día 2: hace 4 días (Grave) -> diferencia: 8 días (<= 15 días)
      const fechaGrave = new Date(hoy.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const mockRows = [
        {
          incidente_id: 'inc-10',
          es_victima: false,
          incidentes: {
            id: 'inc-10',
            fecha: fechaLeve,
            gravedad: 'Leve',
            tipo_abordaje_id: 2,
            tenant_id: mockTenantId,
            tipos_abordaje: { id: 2, nombre: 'Uso indebido de celular' },
          },
        },
        {
          incidente_id: 'inc-11',
          es_victima: false,
          incidentes: {
            id: 'inc-11',
            fecha: fechaGrave,
            gravedad: 'Grave',
            tipo_abordaje_id: 3,
            tenant_id: mockTenantId,
            tipos_abordaje: { id: 3, nombre: 'Desacato grave a inspector' },
          },
        },
      ]

      supabase.from.mockImplementation((table) => {
        if (table === 'estudiantes') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: mockEstudianteId, nombre: 'Lucas', apellido: 'Silva' },
              error: null,
            }),
          }
        }
        if (table === 'configuracion_tenant') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          }
        }
        if (table === 'incidente_estudiantes') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({ data: mockRows, error: null }),
          }
        }
      })

      const resultado = await alertasService.getAntecedentesEscalada(mockTenantId, mockEstudianteId)

      expect(resultado.tiene_alerta).toBe(true)
      expect(resultado.nivel).toBe('critico')
      expect(resultado.reincidencia_ambito).toBe(false)
      expect(resultado.escalada_gravedad).toBe(true)
      expect(resultado.detalles.patron_escalada).toHaveLength(1)
      expect(resultado.detalles.patron_escalada[0].gravedad_anterior).toBe('Leve')
      expect(resultado.detalles.patron_escalada[0].gravedad_posterior).toBe('Grave')
      expect(resultado.detalles.patron_escalada[0].dias_diferencia).toBe(8)
      expect(resultado.motivos[0]).toContain('Escalada rápida de gravedad: Falta Leve seguida de una falta Grave en un lapso de 8 día(s)')
      expect(resultado.sugerencia_accion).toContain('Comité de Buena Convivencia Escolar')
    })

    it('no debe activar escalada de gravedad si el intervalo entre Leve y Grave supera los 15 días', async () => {
      const hoy = new Date()
      // Día 1: hace 25 días (Leve)
      const fechaLeve = new Date(hoy.getTime() - 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      // Día 2: hace 2 días (Grave) -> diferencia: 23 días (> 15 días)
      const fechaGrave = new Date(hoy.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const mockRows = [
        {
          incidente_id: 'inc-20',
          es_victima: false,
          incidentes: {
            id: 'inc-20',
            fecha: fechaLeve,
            gravedad: 'Leve',
            tipo_abordaje_id: 1,
            tenant_id: mockTenantId,
            tipos_abordaje: { id: 1, nombre: 'Atraso reiterado' },
          },
        },
        {
          incidente_id: 'inc-21',
          es_victima: false,
          incidentes: {
            id: 'inc-21',
            fecha: fechaGrave,
            gravedad: 'Grave',
            tipo_abordaje_id: 2,
            tenant_id: mockTenantId,
            tipos_abordaje: { id: 2, nombre: 'Discusión fuerte' },
          },
        },
      ]

      supabase.from.mockImplementation((table) => {
        if (table === 'estudiantes') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: mockEstudianteId, nombre: 'Ana', apellido: 'Rojas' },
              error: null,
            }),
          }
        }
        if (table === 'configuracion_tenant') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          }
        }
        if (table === 'incidente_estudiantes') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({ data: mockRows, error: null }),
          }
        }
      })

      const resultado = await alertasService.getAntecedentesEscalada(mockTenantId, mockEstudianteId)

      expect(resultado.tiene_alerta).toBe(false)
      expect(resultado.nivel).toBeNull()
      expect(resultado.reincidencia_ambito).toBe(false)
      expect(resultado.escalada_gravedad).toBe(false)
    })

    it('debe asignar nivel crítico cuando concurren simultáneamente reincidencia y escalada', async () => {
      const hoy = new Date()
      const fecha1 = new Date(hoy.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const fecha2 = new Date(hoy.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const mockRows = [
        {
          incidente_id: 'inc-30',
          es_victima: false,
          incidentes: {
            id: 'inc-30',
            fecha: fecha1,
            gravedad: 'Leve',
            tipo_abordaje_id: 1,
            tenant_id: mockTenantId,
            tipos_abordaje: { id: 1, nombre: 'Agresión' },
          },
        },
        {
          incidente_id: 'inc-31',
          es_victima: false,
          incidentes: {
            id: 'inc-31',
            fecha: fecha2,
            gravedad: 'Gravísima',
            tipo_abordaje_id: 1,
            tenant_id: mockTenantId,
            tipos_abordaje: { id: 1, nombre: 'Agresión' },
          },
        },
      ]

      supabase.from.mockImplementation((table) => {
        if (table === 'estudiantes') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: mockEstudianteId, nombre: 'Esteban', apellido: 'Muñoz' },
              error: null,
            }),
          }
        }
        if (table === 'configuracion_tenant') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          }
        }
        if (table === 'incidente_estudiantes') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({ data: mockRows, error: null }),
          }
        }
      })

      const resultado = await alertasService.getAntecedentesEscalada(mockTenantId, mockEstudianteId)

      expect(resultado.tiene_alerta).toBe(true)
      expect(resultado.nivel).toBe('critico')
      expect(resultado.reincidencia_ambito).toBe(true)
      expect(resultado.escalada_gravedad).toBe(true)
      expect(resultado.motivos).toHaveLength(2)
    })
  })
})
