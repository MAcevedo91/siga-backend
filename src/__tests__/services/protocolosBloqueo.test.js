const protocolosService = require('../../services/protocolosService')
const { supabase } = require('../../utils/db')
const { registrarAuditoria } = require('../../services/auditoriaService')

jest.mock('../../utils/db')
jest.mock('../../services/auditoriaService', () => ({
  registrarAuditoria: jest.fn().mockResolvedValue({ id: 'audit-1' }),
}))
jest.mock('../../services/emailService')
jest.mock('../../services/notificacionesService')
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}))

describe('protocolosService — Certificación de Pasos y Bloqueo Estricto (HU 5.1.2)', () => {
  const mockTenantId = '11111111-1111-4111-8111-111111111111'
  const mockUsuarioId = '22222222-2222-4222-8222-222222222222'
  const mockProtocoloId = 'b1ffcd88-8b0a-4de7-aa5c-5aa8ac270b22'
  const mockPasoId = 'c3ffcd88-8b0a-4de7-aa5c-5aa8ac270c33'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('actualizarPasoProtocolo()', () => {
    it('debe rechazar con 400 si completado=true y la observación está ausente o tiene menos de 5 caracteres', async () => {
      await expect(
        protocolosService.actualizarPasoProtocolo(
          mockProtocoloId,
          mockPasoId,
          mockTenantId,
          mockUsuarioId,
          { completado: true, observacion: '   ' },
          '127.0.0.1'
        )
      ).rejects.toThrow('La observación es obligatoria al completar un paso y debe tener al menos 5 caracteres')

      await expect(
        protocolosService.actualizarPasoProtocolo(
          mockProtocoloId,
          mockPasoId,
          mockTenantId,
          mockUsuarioId,
          { completado: true, observacion: 'abc' },
          '127.0.0.1'
        )
      ).rejects.toThrow('La observación es obligatoria al completar un paso y debe tener al menos 5 caracteres')
    })

    it('debe rechazar con 400 si completado no es un booleano', async () => {
      await expect(
        protocolosService.actualizarPasoProtocolo(
          mockProtocoloId,
          mockPasoId,
          mockTenantId,
          mockUsuarioId,
          { completado: 'si', observacion: 'Válida' },
          '127.0.0.1'
        )
      ).rejects.toThrow('El campo "completado" es requerido y debe ser un valor booleano')
    })

    it('debe rechazar con 400 si el protocolo ya se encuentra en estado "Cerrado"', async () => {
      supabase.from = jest.fn((table) => {
        if (table === 'protocolos_rice') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: mockProtocoloId, estado: 'Cerrado' },
              error: null,
            }),
          }
        }
        return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis() }
      })

      await expect(
        protocolosService.actualizarPasoProtocolo(
          mockProtocoloId,
          mockPasoId,
          mockTenantId,
          mockUsuarioId,
          { completado: true, observacion: 'Observación formal de cierre' },
          '127.0.0.1'
        )
      ).rejects.toThrow('No se pueden modificar los pasos de un protocolo cerrado')
    })

    it('debe actualizar el paso correctamente, asignar responsable_id y fecha_completado, y registrar auditoría', async () => {
      const mockPasoAntes = {
        id: mockPasoId,
        completado: false,
        fecha_completado: null,
        responsable_id: null,
        observacion: null,
      }

      const mockPasoDespues = {
        id: mockPasoId,
        orden: 1,
        accion: 'Entrevista inicial',
        plazo_dias: 2,
        completado: true,
        fecha_completado: new Date().toISOString(),
        responsable_id: mockUsuarioId,
        observacion: 'Se realizó la entrevista en inspectoría con las partes.',
        responsable: { id: mockUsuarioId, nombre: 'Admin', apellido: 'User', rol: 'Administrador' },
      }

      supabase.from = jest.fn((table) => {
        if (table === 'protocolos_rice') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: mockProtocoloId, estado: 'En Investigación' },
              error: null,
            }),
          }
        }
        if (table === 'protocolo_pasos') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: mockPasoAntes, error: null }),
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: mockPasoDespues, error: null }),
              }),
            }),
          }
        }
        return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis() }
      })

      const resultado = await protocolosService.actualizarPasoProtocolo(
        mockProtocoloId,
        mockPasoId,
        mockTenantId,
        mockUsuarioId,
        { completado: true, observacion: 'Se realizó la entrevista en inspectoría con las partes.' },
        '192.168.1.50'
      )

      expect(resultado).toBeDefined()
      expect(resultado.completado).toBe(true)
      expect(resultado.observacion).toBe('Se realizó la entrevista en inspectoría con las partes.')
      expect(registrarAuditoria).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: mockTenantId,
          userId: mockUsuarioId,
          accion: 'UPDATE',
          tabla: 'protocolo_pasos',
          registroId: mockPasoId,
        })
      )
    })
  })

  describe('cambiarEstado() y Bloqueo Estricto de Pasos', () => {
    it('debe rechazar con 400 y listar pasos pendientes al intentar avanzar a Derivado o Cerrado con tareas incompletas', async () => {
      const mockPasosPendientes = [
        { id: 'p-1', orden: 2, accion: 'Citación a apoderados', plazo_dias: 5 },
        { id: 'p-2', orden: 3, accion: 'Informe a Dirección', plazo_dias: 7 },
      ]

      supabase.from = jest.fn((table) => {
        if (table === 'protocolos_rice') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: mockProtocoloId, estado: 'En Investigación' },
              error: null,
            }),
          }
        }
        if (table === 'protocolo_pasos') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
              data: mockPasosPendientes,
              error: null,
            }),
          }
        }
        return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis() }
      })

      try {
        await protocolosService.cambiarEstado(
          mockProtocoloId,
          mockTenantId,
          'Derivado',
          'Intento de derivar con pasos pendientes'
        )
        fail('Debió lanzar error 400')
      } catch (err) {
        expect(err.statusCode).toBe(400)
        expect(err.message).toBe('No se puede avanzar el estado: existen pasos normativos pendientes')
        expect(err.pasos_pendientes).toHaveLength(2)
        expect(err.pasos_pendientes[0].orden).toBe(2)
      }
    })

    it('debe permitir cambiar de estado exitosamente cuando todos los pasos están completados', async () => {
      supabase.from = jest.fn((table) => {
        if (table === 'protocolos_rice') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { id: mockProtocoloId, estado: 'Derivado' },
                error: null,
              }),
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: mockProtocoloId,
                    estado: 'Cerrado',
                    fecha_cierre: '2026-09-08',
                    observaciones: 'Caso completamente resuelto y notificado.',
                  },
                  error: null,
                }),
              }),
            }),
          }
        }
        if (table === 'protocolo_pasos') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({
                data: [], // Cero pasos pendientes
                error: null,
              }),
            }),
          }
        }
        return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis() }
      })

      const resultado = await protocolosService.cambiarEstado(
        mockProtocoloId,
        mockTenantId,
        'Cerrado',
        'Caso completamente resuelto y notificado.'
      )

      expect(resultado).toBeDefined()
      expect(resultado.estado).toBe('Cerrado')
      expect(resultado.fecha_cierre).toBeDefined()
    })
  })
})
