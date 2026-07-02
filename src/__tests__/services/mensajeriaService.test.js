const mensajeriaService = require('../../services/mensajeriaService')
const { supabase } = require('../../utils/db')
const { registrarAuditoria } = require('../../services/auditoriaService')

jest.mock('../../utils/db')
jest.mock('../../services/auditoriaService')
jest.mock('../../utils/socket', () => ({
  getIO: jest.fn(() => ({
    to: jest.fn().mockReturnThis(),
    emit: jest.fn()
  }))
}))

describe('mensajeriaService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('crearConversacion', () => {
    it('should create individual conversation', async () => {
      const mockConversacion = { id: 'conv-uuid', tipo: 'individual' }

      // Mock para verificar conversaciones existentes (no encuentra ninguna)
      const mockEq2 = jest.fn().mockResolvedValue({ data: [], error: null })
      const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 })
      const mockSelectExisting = jest.fn().mockReturnValue({ eq: mockEq1 })

      // Mock para insertar nueva conversación
      const mockSingle = jest.fn().mockResolvedValue({ data: mockConversacion, error: null })
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle })
      const mockInsert = jest.fn().mockReturnValue({ select: mockSelect })

      // Mock para insertar participantes
      const mockInsertParticipantes = jest.fn().mockResolvedValue({ error: null })

      let callCount = 0
      supabase.from.mockImplementation((table) => {
        if (table === 'conversaciones') {
          callCount++
          if (callCount === 1) {
            // First call: check for existing conversation
            return { select: mockSelectExisting }
          } else {
            // Second call: insert new conversation
            return { insert: mockInsert }
          }
        }
        if (table === 'conversacion_participantes') {
          return {
            insert: mockInsertParticipantes
          }
        }
      })

      const result = await mensajeriaService.crearConversacion(
        'tenant-uuid',
        'individual',
        ['9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6e']
      )

      expect(result.tipo).toBe('individual')
      expect(supabase.from).toHaveBeenCalledWith('conversaciones')
    })

    it('should throw error if participantes < 2', async () => {
      await expect(
        mensajeriaService.crearConversacion('tenant-uuid', 'individual', ['9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'])
      ).rejects.toThrow('Mínimo 2 participantes')
    })
  })

  describe('enviarMensaje', () => {
    it('should send message and emit socket event', async () => {
      const mockMensaje = {
        id: 'msg-uuid',
        conversacion_id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        contenido: 'Hola',
        enviado_at: new Date()
      }

      const mockSingle = jest.fn().mockResolvedValue({ data: mockMensaje, error: null })
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle })
      const mockInsert = jest.fn().mockReturnValue({ select: mockSelect })

      const mockEq = jest.fn().mockResolvedValue({ data: [{ usuario_id: 'user2-uuid' }], error: null })
      const mockSelectParticipantes = jest.fn().mockReturnValue({ eq: mockEq })

      supabase.from.mockImplementation((table) => {
        if (table === 'mensajes') {
          return { insert: mockInsert }
        }
        if (table === 'conversacion_participantes') {
          return { select: mockSelectParticipantes }
        }
      })

      const result = await mensajeriaService.enviarMensaje(
        'tenant-uuid',
        '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        'user1-uuid',
        'Hola'
      )

      expect(result.contenido).toBe('Hola')
      expect(registrarAuditoria).toHaveBeenCalled()
    })
  })

  describe('getConversacionesUsuario', () => {
    it('should return conversaciones with unread count', async () => {
      const mockConversaciones = [
        {
          id: 'conv1-uuid',
          tipo: 'individual',
          nombre: null,
          created_at: '2026-07-01T10:00:00Z',
          conversacion_participantes: [
            { usuario_id: 'user-uuid', ultimo_leido_at: '2026-07-01T10:00:00Z' }
          ],
          mensajes: [
            {
              id: 'msg1',
              enviado_at: '2026-07-02T10:00:00Z',
              contenido: 'Nuevo mensaje',
              remitente_id: 'other-user'
            }
          ]
        }
      ]

      const mockOrder = jest.fn().mockResolvedValue({ data: mockConversaciones, error: null })
      const mockEq2 = jest.fn().mockReturnValue({ order: mockOrder })
      const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 })
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 })

      supabase.from.mockReturnValue({ select: mockSelect })

      const result = await mensajeriaService.getConversacionesUsuario('tenant-uuid', 'user-uuid')

      expect(result.length).toBeGreaterThan(0)
      expect(result[0]).toHaveProperty('noLeidos')
    })
  })
})
