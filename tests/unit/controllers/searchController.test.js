jest.mock('../../../src/utils/db', () => ({
  supabase: {
    rpc: jest.fn()
  }
}))

const { supabase } = require('../../../src/utils/db')
const searchController = require('../../../src/controllers/searchController')

describe('Search Controller', () => {
  let req, res

  beforeEach(() => {
    req = {
      user: { tenant_id: 'tenant-123' },
      query: { q: 'juan' }
    }
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('searchEstudiantes', () => {
    it('debe retornar estudiantes que coincidan con búsqueda', async () => {
      const mockData = [
        { id: 1, nombre: 'Juan', apellido: 'Pérez', rut: '12345678-9', relevancia: 0.8 }
      ]

      supabase.rpc.mockResolvedValue({ data: mockData, error: null })

      await searchController.searchEstudiantes(req, res)

      expect(supabase.rpc).toHaveBeenCalledWith('search_estudiantes', {
        p_tenant_id: 'tenant-123',
        p_query: 'juan',
        p_limite: 20
      })
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockData
      })
    })

    it('debe retornar error 400 si falta query', async () => {
      req.query = {}

      await searchController.searchEstudiantes(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Parámetro q (query) es requerido'
      })
    })
  })

  describe('searchIncidentes', () => {
    it('debe retornar incidentes que coincidan con búsqueda', async () => {
      const mockData = [
        { id: 1, descripcion: 'Pelea en el patio', gravedad: 'alta', fecha: '2024-06-01', relevancia: 0.9 }
      ]

      supabase.rpc.mockResolvedValue({ data: mockData, error: null })

      await searchController.searchIncidentes(req, res)

      expect(supabase.rpc).toHaveBeenCalledWith('search_incidentes', {
        p_tenant_id: 'tenant-123',
        p_query: 'juan',
        p_limite: 20
      })
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockData
      })
    })

    it('debe retornar error 400 si falta query', async () => {
      req.query = {}

      await searchController.searchIncidentes(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Parámetro q (query) es requerido'
      })
    })
  })
})
