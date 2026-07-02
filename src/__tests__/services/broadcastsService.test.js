const broadcastsService = require('../../services/broadcastsService')
const { supabase } = require('../../utils/db')
const { registrarAuditoria } = require('../../services/auditoriaService')

jest.mock('../../utils/db')
jest.mock('../../services/auditoriaService')
jest.mock('../../utils/logger')
jest.mock('bull', () => {
  return jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: 'job-id' }),
    process: jest.fn(),
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(true)
  }))
})

describe('broadcastsService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('crearBroadcast', () => {
    it('should create broadcast inmediato', async () => {
      const mockBroadcast = {
        id: 'broadcast-uuid',
        tenant_id: 'tenant-uuid',
        titulo: 'Aviso importante',
        contenido: 'Contenido del aviso',
        destinatarios_tipo: 'todos',
        enviado_por: 'user-uuid',
        enviado_at: expect.any(String),
        confirmacion_lectura: false
      }

      supabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockBroadcast, error: null })
          })
        })
      })

      registrarAuditoria.mockResolvedValue({})

      const result = await broadcastsService.crearBroadcast(
        'tenant-uuid',
        {
          titulo: 'Aviso importante',
          contenido: 'Contenido del aviso',
          destinatarios_tipo: 'todos'
        },
        'user-uuid'
      )

      expect(result.titulo).toBe('Aviso importante')
      expect(result.destinatarios_tipo).toBe('todos')
      expect(supabase.from).toHaveBeenCalledWith('broadcasts')
      expect(registrarAuditoria).toHaveBeenCalled()
    })

    it('should create broadcast programado', async () => {
      const mockBroadcast = {
        id: 'broadcast-uuid',
        tenant_id: 'tenant-uuid',
        titulo: 'Aviso programado',
        contenido: 'Contenido del aviso',
        destinatarios_tipo: 'todos',
        enviado_por: 'user-uuid',
        programado_para: '2026-07-03T10:00:00Z',
        enviado_at: null,
        confirmacion_lectura: false
      }

      supabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockBroadcast, error: null })
          })
        })
      })

      registrarAuditoria.mockResolvedValue({})

      const result = await broadcastsService.crearBroadcast(
        'tenant-uuid',
        {
          titulo: 'Aviso programado',
          contenido: 'Contenido del aviso',
          destinatarios_tipo: 'todos',
          programado_para: '2026-07-03T10:00:00Z'
        },
        'user-uuid'
      )

      expect(result.programado_para).toBe('2026-07-03T10:00:00Z')
      expect(result.enviado_at).toBeNull()
    })

    it('should sanitize contenido with DOMPurify', async () => {
      // Mock the insert to capture what was inserted
      let insertedData = null
      supabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockImplementation((data) => {
          insertedData = data
          return {
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'broadcast-uuid',
                  ...data
                },
                error: null
              })
            })
          }
        })
      })

      registrarAuditoria.mockResolvedValue({})

      await broadcastsService.crearBroadcast(
        'tenant-uuid',
        {
          titulo: 'Aviso',
          contenido: '<p>Contenido limpio</p><script>alert("xss")</script>',
          destinatarios_tipo: 'todos'
        },
        'user-uuid'
      )

      // Check the actual data that was inserted
      expect(insertedData.contenido).toBeDefined()
      expect(insertedData.contenido).not.toContain('<script>')
      expect(insertedData.contenido).toContain('<p>Contenido limpio</p>')
    })

    it('should throw error on invalid data', async () => {
      await expect(
        broadcastsService.crearBroadcast(
          'tenant-uuid',
          {
            titulo: '',
            contenido: 'Contenido',
            destinatarios_tipo: 'todos'
          },
          'user-uuid'
        )
      ).rejects.toThrow('Validación fallida')
    })
  })

  describe('calcularDestinatarios', () => {
    it('should return all users for tipo=todos', async () => {
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [{ id: 'user1' }, { id: 'user2' }],
            error: null
          })
        })
      })

      const result = await broadcastsService.calcularDestinatarios(
        'tenant-uuid',
        'todos',
        []
      )

      expect(result.length).toBe(2)
      expect(result).toEqual(['user1', 'user2'])
    })

    it('should return users by rol', async () => {
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({
              data: [{ id: 'user1' }, { id: 'user2' }],
              error: null
            })
          })
        })
      })

      const result = await broadcastsService.calcularDestinatarios(
        'tenant-uuid',
        'rol',
        ['profesor']
      )

      expect(result.length).toBe(2)
    })

    it('should return estudiantes by curso', async () => {
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({
              data: [{ id: 'estudiante1' }, { id: 'estudiante2' }],
              error: null
            })
          })
        })
      })

      const result = await broadcastsService.calcularDestinatarios(
        'tenant-uuid',
        'curso',
        ['curso-uuid-1']
      )

      expect(result.length).toBe(2)
    })
  })

  describe('marcarBroadcastLeido', () => {
    it('should mark broadcast as read', async () => {
      supabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          onConflict: jest.fn().mockResolvedValue({ error: null })
        })
      })

      await broadcastsService.marcarBroadcastLeido('broadcast-uuid', 'user-uuid')

      expect(supabase.from).toHaveBeenCalledWith('broadcast_lecturas')
      const insertCall = supabase.from().insert.mock.calls[0][0]
      expect(insertCall.broadcast_id).toBe('broadcast-uuid')
      expect(insertCall.usuario_id).toBe('user-uuid')
    })

    it('should ignore duplicate errors', async () => {
      supabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          onConflict: jest.fn().mockResolvedValue({
            error: { code: '23505', message: 'duplicate key' }
          })
        })
      })

      await expect(
        broadcastsService.marcarBroadcastLeido('broadcast-uuid', 'user-uuid')
      ).resolves.not.toThrow()
    })
  })

  describe('getBroadcastsEnviados', () => {
    it('should return broadcasts sent by user', async () => {
      const mockData = [
        {
          id: 'broadcast-1',
          titulo: 'Aviso 1',
          contenido: 'Contenido 1',
          destinatarios_tipo: 'todos',
          destinatarios_ids: [],
          enviado_at: '2026-07-01T10:00:00Z',
          broadcast_lecturas: [{ count: 5 }]
        }
      ]

      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                range: jest.fn().mockResolvedValue({
                  data: mockData,
                  error: null
                })
              })
            })
          })
        })
      })

      // Mock calcularDestinatarios call within the service
      supabase.from = jest.fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  range: jest.fn().mockResolvedValue({
                    data: mockData,
                    error: null
                  })
                })
              })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [{ id: 'user1' }, { id: 'user2' }],
              error: null
            })
          })
        })

      const result = await broadcastsService.getBroadcastsEnviados(
        'tenant-uuid',
        'user-uuid',
        20,
        0
      )

      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('getBroadcastsRecibidos', () => {
    it('should return broadcasts received by user', async () => {
      const mockData = [
        {
          id: 'broadcast-1',
          titulo: 'Aviso 1',
          contenido: 'Contenido 1',
          enviado_at: '2026-07-01T10:00:00Z',
          broadcast_lecturas: []
        }
      ]

      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            not: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                range: jest.fn().mockResolvedValue({
                  data: mockData,
                  error: null
                })
              })
            })
          })
        })
      })

      const result = await broadcastsService.getBroadcastsRecibidos(
        'tenant-uuid',
        'user-uuid',
        20,
        0
      )

      expect(Array.isArray(result)).toBe(true)
      expect(result[0]).toHaveProperty('leido')
    })
  })
})
