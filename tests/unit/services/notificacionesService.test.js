const { getIO } = require('../../../src/sockets')

jest.mock('../../../src/sockets')
jest.mock('../../../src/utils/db', () => ({
  supabase: {
    from: jest.fn()
  }
}))

const { supabase } = require('../../../src/utils/db')
const notificacionesService = require('../../../src/services/notificacionesService')

describe('Notificaciones Service', () => {
  let mockIO

  beforeEach(() => {
    mockIO = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    }
    getIO.mockReturnValue(mockIO)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('crearNotificacion', () => {
    it('debe crear notificación y emitir evento socket', async () => {
      const mockNotificacion = {
        id: 1,
        usuario_id: 10,
        tenant_id: 'tenant-123',
        tipo: 'incidente',
        titulo: 'Nuevo incidente',
        mensaje: 'Se creó un incidente grave',
        url: '/incidentes/5',
        leida: false,
        created_at: new Date().toISOString()
      }

      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockNotificacion, error: null })
          })
        })
      })

      const result = await notificacionesService.crearNotificacion({
        userId: 10,
        tenantId: 'tenant-123',
        tipo: 'incidente',
        titulo: 'Nuevo incidente',
        mensaje: 'Se creó un incidente grave',
        url: '/incidentes/5'
      })

      expect(result).toEqual(mockNotificacion)
      expect(mockIO.to).toHaveBeenCalledWith('user-10')
      expect(mockIO.emit).toHaveBeenCalledWith('notificacion:nueva', mockNotificacion)
    })

    it('debe lanzar error si falla la creación', async () => {
      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } })
          })
        })
      })

      await expect(
        notificacionesService.crearNotificacion({
          userId: 10,
          tenantId: 'tenant-123',
          tipo: 'incidente',
          titulo: 'Test',
          mensaje: 'Test'
        })
      ).rejects.toThrow('DB error')
    })
  })

  describe('obtenerNotificaciones', () => {
    it('debe retornar notificaciones del usuario ordenadas por fecha', async () => {
      const mockNotificaciones = [
        { id: 2, titulo: 'Notif 2', created_at: '2026-07-01T12:00:00Z' },
        { id: 1, titulo: 'Notif 1', created_at: '2026-07-01T11:00:00Z' }
      ]

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: mockNotificaciones, error: null })
        })
      })

      const result = await notificacionesService.obtenerNotificaciones(10, 'tenant-123')

      expect(result).toEqual(mockNotificaciones)
      expect(supabase.from).toHaveBeenCalledWith('notificaciones')
    })
  })

  describe('marcarComoLeida', () => {
    it('debe marcar notificación como leída', async () => {
      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockResolvedValue({ data: [{ id: 1, leida: true }], error: null })
        })
      })

      await notificacionesService.marcarComoLeida(1, 10)

      expect(supabase.from).toHaveBeenCalledWith('notificaciones')
    })
  })

  describe('contarNoLeidas', () => {
    it('debe contar notificaciones no leídas', async () => {
      const mockChain = {
        eq: jest.fn().mockReturnThis()
      }
      // Second eq() call returns the promise
      mockChain.eq.mockReturnValueOnce(mockChain).mockResolvedValueOnce({ count: 5, error: null })

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue(mockChain)
      })

      const count = await notificacionesService.contarNoLeidas(10)

      expect(count).toBe(5)
    })
  })

  describe('marcarTodasComoLeidas', () => {
    it('debe marcar todas las notificaciones pendientes del usuario como leídas', async () => {
      const mockChain = {
        eq: jest.fn().mockReturnThis()
      }
      mockChain.eq
        .mockReturnValueOnce(mockChain)
        .mockReturnValueOnce(mockChain)
        .mockResolvedValueOnce({ error: null })

      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue(mockChain)
      })

      await expect(notificacionesService.marcarTodasComoLeidas('user-uuid', 'tenant-uuid')).resolves.not.toThrow()
      expect(supabase.from).toHaveBeenCalledWith('notificaciones')
    })
  })

  describe('notificarUsuariosPorRol', () => {
    it('debe buscar usuarios por rol y crear una notificación para cada uno', async () => {
      const mockUsuarios = [
        { id: 'user-admin-1', rol: 'Administrador' },
        { id: 'user-directivo-1', rol: 'Directivo' }
      ]

      supabase.from.mockImplementation((tabla) => {
        if (tabla === 'usuarios') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({ data: mockUsuarios, error: null })
          }
        }
        if (tabla === 'notificaciones') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: { id: 'notif-uuid', leida: false }, error: null })
              })
            })
          }
        }
      })

      const resultados = await notificacionesService.notificarUsuariosPorRol({
        tenantId: 'tenant-123',
        roles: ['Administrador', 'Directivo'],
        tipo: 'incidente',
        titulo: 'Incidente Grave',
        mensaje: 'Se registró una incidencia',
        url: '/incidentes/uuid-1'
      })

      expect(resultados).toHaveLength(2)
      expect(mockIO.to).toHaveBeenCalledWith('user-user-admin-1')
      expect(mockIO.to).toHaveBeenCalledWith('user-user-directivo-1')
    })

    it('debe retornar arreglo vacío si no encuentra usuarios con esos roles', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: [], error: null })
      })

      const resultados = await notificacionesService.notificarUsuariosPorRol({
        tenantId: 'tenant-123',
        roles: ['Inspector'],
        tipo: 'sistema',
        titulo: 'Test',
        mensaje: 'Sin usuarios'
      })

      expect(resultados).toEqual([])
    })
  })
})
