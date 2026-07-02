const derivacionesService = require('../services/derivacionesService')
const { supabase } = require('../utils/db')

jest.mock('../utils/db')
jest.mock('../services/auditoriaService')
jest.mock('../utils/logger')

describe('DerivacionesService', () => {
  const tenantId = '550e8400-e29b-41d4-a716-446655440000'
  const usuarioId = '550e8400-e29b-41d4-a716-446655440001'
  const estudianteId = '550e8400-e29b-41d4-a716-446655440002'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('crearDerivacion', () => {
    it('debe crear derivación exitosamente', async () => {
      const mockEstudiante = {
        id: estudianteId,
        nombre: 'Juan',
        apellido: 'Pérez'
      }

      const mockDerivacion = {
        id: '550e8400-e29b-41d4-a716-446655440003',
        estudiante_id: estudianteId,
        tipo: 'Psicológica',
        prioridad: 'Alta',
        estado: 'Pendiente',
        fecha_derivacion: '2026-07-02'
      }

      supabase.from.mockImplementation((table) => {
        if (table === 'estudiantes') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: mockEstudiante, error: null })
                })
              })
            })
          }
        }
        if (table === 'derivaciones') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: mockDerivacion, error: null })
              })
            })
          }
        }
      })

      const data = {
        estudianteId,
        tipo: 'Psicológica',
        prioridad: 'Alta',
        motivo: 'Requiere apoyo psicológico por situación familiar'
      }

      const resultado = await derivacionesService.crearDerivacion(tenantId, data, usuarioId)

      expect(resultado).toEqual(mockDerivacion)
      expect(resultado.tipo).toBe('Psicológica')
      expect(resultado.prioridad).toBe('Alta')
    })

    it('debe rechazar motivo muy corto', async () => {
      const data = {
        estudianteId,
        tipo: 'Psicológica',
        prioridad: 'Alta',
        motivo: 'Corto'
      }

      await expect(
        derivacionesService.crearDerivacion(tenantId, data, usuarioId)
      ).rejects.toThrow('Validación fallida')
    })
  })

  describe('agregarSeguimiento', () => {
    it('debe agregar seguimiento a derivación activa', async () => {
      const derivacionId = '550e8400-e29b-41d4-a716-446655440010'
      const mockDerivacion = {
        id: derivacionId,
        estado: 'En Proceso'
      }

      const mockSeguimiento = {
        id: '550e8400-e29b-41d4-a716-446655440011',
        fecha_seguimiento: '2026-07-02',
        observaciones: 'Primera sesión realizada'
      }

      supabase.from.mockImplementation((table) => {
        if (table === 'derivaciones') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: mockDerivacion, error: null })
              })
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null })
            })
          }
        }
        if (table === 'derivacion_seguimientos') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: mockSeguimiento, error: null })
              })
            })
          }
        }
      })

      const data = {
        observaciones: 'Primera sesión realizada con éxito',
        accionesRealizadas: 'Entrevista inicial, diagnóstico preliminar'
      }

      const resultado = await derivacionesService.agregarSeguimiento(derivacionId, data, usuarioId)

      expect(resultado).toEqual(mockSeguimiento)
    })

    it('debe rechazar seguimiento en derivación cerrada', async () => {
      const derivacionId = '550e8400-e29b-41d4-a716-446655440012'
      const mockDerivacion = {
        id: derivacionId,
        estado: 'Cerrada'
      }

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockDerivacion, error: null })
          })
        })
      })

      const data = {
        observaciones: 'Seguimiento tardío'
      }

      await expect(
        derivacionesService.agregarSeguimiento(derivacionId, data, usuarioId)
      ).rejects.toThrow('No se puede agregar seguimiento a una derivación cerrada')
    })
  })

  describe('cerrarDerivacion', () => {
    it('debe cerrar derivación activa', async () => {
      const derivacionId = '550e8400-e29b-41d4-a716-446655440020'
      const mockDerivacion = {
        id: derivacionId,
        estado: 'En Proceso',
        tenant_id: tenantId
      }

      const mockUpdated = {
        id: derivacionId,
        estado: 'Cerrada',
        fecha_cierre: '2026-07-02'
      }

      supabase.from.mockImplementation((table) => {
        if (table === 'derivaciones') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: mockDerivacion, error: null })
              })
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: mockUpdated, error: null })
                })
              })
            })
          }
        }
      })

      const resultado = await derivacionesService.cerrarDerivacion(derivacionId, usuarioId)

      expect(resultado.estado).toBe('Cerrada')
      expect(resultado.fecha_cierre).toBeDefined()
    })
  })
})
