const protocolosService = require('../../services/protocolosService')
const { supabase } = require('../../utils/db')
const emailService = require('../../services/emailService')
const notificacionesService = require('../../services/notificacionesService')

jest.mock('../../utils/db')
jest.mock('../../services/emailService')
jest.mock('../../services/notificacionesService')
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}))

describe('protocolosService — Checklist RICE (protocolo_pasos)', () => {
  const mockTenantId = '11111111-1111-4111-8111-111111111111'
  const mockOtherTenantId = '99999999-9999-4999-8999-999999999999'
  const mockUsuarioId = '22222222-2222-4222-8222-222222222222'
  const mockEstudianteId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  const mockProtocoloId = 'b1ffcd88-8b0a-4de7-aa5c-5aa8ac270b22'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('crearProtocolo con inicialización automática de pasos', () => {
    const validBody = {
      estudiante_id: mockEstudianteId,
      tipo_protocolo_id: 1,
      fecha_apertura: '2026-09-08',
      observaciones: 'Apertura inicial del caso',
    }

    const mockReglas = [
      { id: 'r-1', orden: 1, accion: 'Entrevista inicial', plazo_dias: 2 },
      { id: 'r-2', orden: 2, accion: 'Citación a apoderados', plazo_dias: 5 },
      { id: 'r-3', orden: 3, accion: 'Informe a Dirección', plazo_dias: 7 },
      { id: 'r-4', orden: 4, accion: 'Cierre o derivación', plazo_dias: 10 },
    ]

    it('debe crear el protocolo e insertar automáticamente sus 4 pasos iniciales con completado=false', async () => {
      // Mock insert protocolo
      const insertProtMock = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { id: mockProtocoloId }, error: null }),
      }

      // Mock select reglas
      const selectReglasMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockReglas, error: null }),
      }

      // Mock insert pasos
      const insertPasosMock = {
        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      }

      // Mock queries for notifications & emails
      const estudiantesMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockEstudianteId, nombre: 'Juan', apellido: 'Pérez', apoderados: null },
          error: null,
        }),
      }

      const tiposProtMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { nombre: 'Maltrato entre pares' }, error: null }),
      }

      const usuariosMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: [], error: null }),
        single: jest.fn().mockResolvedValue({ data: { nombre: 'Coordinador', apellido: 'Test' }, error: null }),
      }

      // Mock obtenerProtocolo detail
      const obtenerProtMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: mockProtocoloId,
            estado: 'En Investigación',
            fecha_apertura: '2026-09-08',
            tipos_protocolo: { id: 1, nombre: 'Maltrato entre pares' },
            estudiantes: { id: mockEstudianteId, rut: '12345678-9', nombre: 'Juan', apellido: 'Pérez' },
            usuarios: { id: mockUsuarioId, nombre: 'Admin', apellido: 'User' },
          },
          error: null,
        }),
      }

      // Mock listarPasosProtocolo inside obtenerProtocolo
      const pasosProtMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockReglas.map(r => ({ ...r, completado: false, fecha_completado: null })),
          error: null,
        }),
      }

      supabase.from = jest.fn((table) => {
        if (table === 'protocolos_rice') {
          // Both insert and select on protocolos_rice
          return {
            insert: insertProtMock.insert,
            select: jest.fn().mockReturnValue(obtenerProtMock),
            eq: jest.fn().mockReturnThis(),
            single: obtenerProtMock.single,
            delete: jest.fn().mockReturnThis(),
          }
        }
        if (table === 'reglas_protocolo') return selectReglasMock
        if (table === 'protocolo_pasos') return insertPasosMock
        if (table === 'estudiantes') return estudiantesMock
        if (table === 'tipos_protocolo') return tiposProtMock
        if (table === 'usuarios') return usuariosMock
        return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis() }
      })

      const resultado = await protocolosService.crearProtocolo(mockTenantId, mockUsuarioId, validBody)

      // Verificaciones
      expect(resultado).toBeDefined()
      expect(resultado.id).toBe(mockProtocoloId)
      expect(selectReglasMock.select).toHaveBeenCalled()
      expect(insertPasosMock.insert).toHaveBeenCalledTimes(1)

      const payloadPasos = insertPasosMock.insert.mock.calls[0][0]
      expect(payloadPasos).toHaveLength(4)
      expect(payloadPasos[0]).toMatchObject({
        tenant_id: mockTenantId,
        protocolo_id: mockProtocoloId,
        orden: 1,
        completado: false,
      })
    })

    it('debe revertir (rollback) el protocolo si la inserción de pasos falla', async () => {
      const deleteProtMock = jest.fn().mockReturnThis()

      const insertMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { id: mockProtocoloId }, error: null }),
        }),
      })

      const selectReglasMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockReglas, error: null }),
      }

      const insertPasosFailMock = {
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'violates foreign key constraint' },
        }),
      }

      supabase.from = jest.fn((table) => {
        if (table === 'protocolos_rice') {
          return {
            insert: insertMock,
            delete: deleteProtMock,
            eq: jest.fn().mockReturnThis(),
          }
        }
        if (table === 'reglas_protocolo') return selectReglasMock
        if (table === 'protocolo_pasos') return insertPasosFailMock
        return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis() }
      })

      await expect(
        protocolosService.crearProtocolo(mockTenantId, mockUsuarioId, validBody)
      ).rejects.toThrow('Error al inicializar el checklist normativo del protocolo')

      expect(deleteProtMock).toHaveBeenCalled()
    })
  })

  describe('listarPasosProtocolo y Aislamiento Multi-tenant', () => {
    it('debe rechazar la consulta si el protocolo pertenece a otro tenant o no existe', async () => {
      supabase.from = jest.fn((table) => {
        if (table === 'protocolos_rice') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Row not found' } }),
          }
        }
        return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis() }
      })

      await expect(
        protocolosService.listarPasosProtocolo(mockProtocoloId, mockOtherTenantId)
      ).rejects.toThrow('Protocolo no encontrado o no pertenece a este establecimiento')
    })

    it('debe listar los pasos ordenados ascendentemente cuando el tenant coincide', async () => {
      const mockPasosDb = [
        { id: 'p-1', orden: 1, accion: 'Paso 1', completado: true },
        { id: 'p-2', orden: 2, accion: 'Paso 2', completado: false },
      ]

      supabase.from = jest.fn((table) => {
        if (table === 'protocolos_rice') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: { id: mockProtocoloId }, error: null }),
          }
        }
        if (table === 'protocolo_pasos') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({ data: mockPasosDb, error: null }),
          }
        }
        return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis() }
      })

      const resultado = await protocolosService.listarPasosProtocolo(mockProtocoloId, mockTenantId)
      expect(resultado).toHaveLength(2)
      expect(resultado[0].orden).toBe(1)
      expect(resultado[1].orden).toBe(2)
    })
  })
})
