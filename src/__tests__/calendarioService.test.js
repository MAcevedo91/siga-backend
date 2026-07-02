const calendarioService = require('../services/calendarioService')
const { supabase } = require('../utils/db')

jest.mock('../utils/db')
jest.mock('../services/auditoriaService')
jest.mock('../utils/logger')

describe('CalendarioService', () => {
  const tenantId = 'tenant-123'
  const usuarioId = 'user-123'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('crearEvento', () => {
    it('debe crear evento exitosamente', async () => {
      const mockEvento = {
        id: 'evento-123',
        titulo: 'Reunión Apoderados',
        tipo: 'Reunión',
        fecha_inicio: '2026-07-10T10:00:00Z',
        fecha_fin: '2026-07-10T12:00:00Z'
      }

      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockEvento, error: null })
          })
        })
      })

      const data = {
        titulo: 'Reunión Apoderados',
        tipo: 'Reunión',
        fechaInicio: '2026-07-10T10:00:00Z',
        fechaFin: '2026-07-10T12:00:00Z',
        esPublico: true
      }

      const resultado = await calendarioService.crearEvento(tenantId, data, usuarioId)

      expect(resultado).toEqual(mockEvento)
      expect(supabase.from).toHaveBeenCalledWith('eventos')
    })

    it('debe rechazar fechaFin anterior a fechaInicio', async () => {
      const data = {
        titulo: 'Evento inválido',
        tipo: 'Reunión',
        fechaInicio: '2026-07-10T12:00:00Z',
        fechaFin: '2026-07-10T10:00:00Z'
      }

      await expect(
        calendarioService.crearEvento(tenantId, data, usuarioId)
      ).rejects.toThrow('fechaFin debe ser mayor o igual a fechaInicio')
    })

    it('debe rechazar tipo inválido', async () => {
      const data = {
        titulo: 'Evento',
        tipo: 'TipoInválido',
        fechaInicio: '2026-07-10T10:00:00Z',
        fechaFin: '2026-07-10T12:00:00Z'
      }

      await expect(
        calendarioService.crearEvento(tenantId, data, usuarioId)
      ).rejects.toThrow('Validación fallida')
    })
  })

  describe('getEventos', () => {
    it('debe obtener eventos con filtros', async () => {
      const mockEventos = [
        { id: 'evento-1', titulo: 'Evento 1', tipo: 'Reunión' },
        { id: 'evento-2', titulo: 'Evento 2', tipo: 'Ceremonia' }
      ]

      const mockQuery = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis()
      }

      // Order debe resolver con data al final de la cadena
      mockQuery.lte.mockResolvedValue({ data: mockEventos, error: null })

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue(mockQuery)
      })

      const filtros = {
        fechaInicio: '2026-07-01',
        fechaFin: '2026-07-31'
      }

      const resultado = await calendarioService.getEventos(tenantId, filtros)

      expect(resultado).toEqual(mockEventos)
      expect(mockQuery.eq).toHaveBeenCalledWith('tenant_id', tenantId)
    })
  })
})
