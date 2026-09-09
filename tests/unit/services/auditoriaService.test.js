const auditoriaService = require('../../../src/services/auditoriaService')
const { supabase } = require('../../../src/utils/db')

jest.mock('../../../src/utils/db')

describe('Auditoría Service', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('calculateDiff', () => {
    it('debe retornar cambios cuando hay diferencias', () => {
      const before = {
        estado: 'En Investigación',
        gravedad: 'Leve',
        relato: 'Incidente original'
      }

      const after = {
        estado: 'Derivado',
        gravedad: 'Leve',
        relato: 'Incidente actualizado'
      }

      const diff = auditoriaService.calculateDiff(before, after)

      expect(diff).toEqual({
        estado: {
          before: 'En Investigación',
          after: 'Derivado'
        },
        relato: {
          before: 'Incidente original',
          after: 'Incidente actualizado'
        }
      })
    })

    it('debe manejar campos nuevos agregados', () => {
      const before = {
        nombre: 'Juan'
      }

      const after = {
        nombre: 'Juan',
        apellido: 'Pérez'
      }

      const diff = auditoriaService.calculateDiff(before, after)

      expect(diff).toEqual({
        apellido: {
          before: undefined,
          after: 'Pérez'
        }
      })
    })

    it('debe manejar campos eliminados', () => {
      const before = {
        nombre: 'Juan',
        apellido: 'Pérez'
      }

      const after = {
        nombre: 'Juan'
      }

      const diff = auditoriaService.calculateDiff(before, after)

      expect(diff).toEqual({
        apellido: {
          before: 'Pérez',
          after: undefined
        }
      })
    })

    it('debe retornar objeto vacío si no hay cambios', () => {
      const before = {
        estado: 'En Investigación',
        gravedad: 'Leve'
      }

      const after = {
        estado: 'En Investigación',
        gravedad: 'Leve'
      }

      const diff = auditoriaService.calculateDiff(before, after)

      expect(diff).toEqual({})
    })

    it('debe manejar objetos anidados', () => {
      const before = {
        usuario: { id: 1, nombre: 'Juan' }
      }

      const after = {
        usuario: { id: 1, nombre: 'Pedro' }
      }

      const diff = auditoriaService.calculateDiff(before, after)

      expect(diff.usuario).toBeDefined()
      expect(diff.usuario.before).toEqual({ id: 1, nombre: 'Juan' })
      expect(diff.usuario.after).toEqual({ id: 1, nombre: 'Pedro' })
    })

    it('debe manejar valores null y undefined', () => {
      const before = {
        campo1: null,
        campo2: 'valor'
      }

      const after = {
        campo1: 'nuevo',
        campo2: null
      }

      const diff = auditoriaService.calculateDiff(before, after)

      expect(diff).toEqual({
        campo1: {
          before: null,
          after: 'nuevo'
        },
        campo2: {
          before: 'valor',
          after: null
        }
      })
    })
  })

  describe('registrarAuditoria', () => {
    it('debe insertar registro de auditoría con diff calculado', async () => {
      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'audit-123' },
            error: null
          })
        })
      })

      supabase.from = jest.fn().mockReturnValue({
        insert: mockInsert
      })

      const before = { estado: 'En Investigación' }
      const after = { estado: 'Derivado' }

      const result = await auditoriaService.registrarAuditoria({
        tenantId: 'tenant-1',
        userId: 'user-1',
        accion: 'UPDATE',
        tabla: 'incidentes',
        registroId: 'inc-1',
        datosBefore: before,
        datosAfter: after,
        ip: '192.168.1.1'
      })

      expect(supabase.from).toHaveBeenCalledWith('auditoria')
      expect(mockInsert).toHaveBeenCalled()

      const insertedData = mockInsert.mock.calls[0][0]
      expect(insertedData.tenant_id).toBe('tenant-1')
      expect(insertedData.usuario_id).toBe('user-1')
      expect(insertedData.accion).toBe('UPDATE')
      expect(insertedData.tabla_afectada).toBe('incidentes')
      expect(insertedData.registro_id).toBe('inc-1')
      expect(insertedData.datos_antes).toEqual(before)
      expect(insertedData.datos_despues).toEqual(after)
      expect(insertedData.cambios).toEqual({
        estado: {
          before: 'En Investigación',
          after: 'Derivado'
        }
      })
      expect(insertedData.ip).toBe('192.168.1.1')
    })

    it('debe lanzar error si falla la inserción', async () => {
      supabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' }
            })
          })
        })
      })

      await expect(
        auditoriaService.registrarAuditoria({
          tenantId: 'tenant-1',
          userId: 'user-1',
          accion: 'UPDATE',
          tabla: 'incidentes',
          registroId: 'inc-1',
          datosBefore: {},
          datosAfter: {}
        })
      ).rejects.toThrow('Database error')
    })
  })

  describe('getAuditoriaTimeline', () => {
    it('debe retornar timeline de auditoría ordenado por fecha', async () => {
      const mockData = [
        {
          id: 'audit-2',
          fecha_hora: '2026-07-01T10:00:00Z',
          accion: 'UPDATE',
          usuarios: { nombre: 'Admin', apellido: 'User' }
        },
        {
          id: 'audit-1',
          fecha_hora: '2026-07-01T09:00:00Z',
          accion: 'CREATE',
          usuarios: { nombre: 'Admin', apellido: 'User' }
        }
      ]

      const mockOrder = jest.fn().mockResolvedValue({
        data: mockData,
        error: null
      })

      const mockEq3 = jest.fn().mockReturnValue({
        order: mockOrder
      })

      const mockEq2 = jest.fn().mockReturnValue({
        eq: mockEq3
      })

      const mockEq1 = jest.fn().mockReturnValue({
        eq: mockEq2
      })

      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: mockEq1
        })
      })

      const result = await auditoriaService.getAuditoriaTimeline({
        tenantId: 'tenant-1',
        tabla: 'incidentes',
        registroId: 'inc-1'
      })

      expect(result).toEqual(mockData)
      expect(mockOrder).toHaveBeenCalledWith('fecha_hora', { ascending: false })
    })

    it('debe lanzar error si falla la consulta', async () => {
      const mockOrder = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Query error' }
      })

      const mockEq3 = jest.fn().mockReturnValue({
        order: mockOrder
      })

      const mockEq2 = jest.fn().mockReturnValue({
        eq: mockEq3
      })

      const mockEq1 = jest.fn().mockReturnValue({
        eq: mockEq2
      })

      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: mockEq1
        })
      })

      await expect(
        auditoriaService.getAuditoriaTimeline({
          tenantId: 'tenant-1',
          tabla: 'incidentes',
          registroId: 'inc-1'
        })
      ).rejects.toThrow('Query error')
    })
  })

  describe('getAuditoriaLogs', () => {
    it('debe aplicar filtros correctamente', async () => {
      const mockData = []

      const mockLimit = jest.fn().mockResolvedValue({
        data: mockData,
        error: null
      })

      const mockOrder = jest.fn().mockReturnValue({
        limit: mockLimit
      })

      const mockEq = jest.fn().mockReturnThis()

      const mockQuery = {
        eq: mockEq,
        order: mockOrder,
        limit: mockLimit
      }

      // Chain eq to return itself for multiple filters
      mockEq.mockReturnValue(mockQuery)
      mockOrder.mockReturnValue(mockQuery)

      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue(mockQuery)
      })

      const result = await auditoriaService.getAuditoriaLogs({
        tenantId: 'tenant-1',
        tabla: 'incidentes',
        limit: 50
      })

      expect(result).toEqual(mockData)
      expect(mockEq).toHaveBeenCalledWith('tenant_id', 'tenant-1')
      expect(mockEq).toHaveBeenCalledWith('tabla_afectada', 'incidentes')
      expect(mockLimit).toHaveBeenCalledWith(50)
      expect(mockOrder).toHaveBeenCalledWith('fecha_hora', { ascending: false })
    })

    it('debe retornar logs sin filtros opcionales', async () => {
      const mockData = [
        { id: 'audit-1', accion: 'CREATE' }
      ]

      const mockLimit = jest.fn().mockResolvedValue({
        data: mockData,
        error: null
      })

      const mockOrder = jest.fn().mockReturnValue({
        limit: mockLimit
      })

      const mockEq = jest.fn().mockReturnValue({
        order: mockOrder
      })

      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: mockEq
        })
      })

      const result = await auditoriaService.getAuditoriaLogs({
        tenantId: 'tenant-1'
      })

      expect(result).toEqual(mockData)
      expect(mockEq).toHaveBeenCalledWith('tenant_id', 'tenant-1')
    })
  })
})
