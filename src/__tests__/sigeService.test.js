const sigeService = require('../services/sigeService')
const { supabase } = require('../utils/db')

jest.mock('../utils/db')
jest.mock('../utils/logger')

describe('SIGEService', () => {
  const tenantId = 'tenant-123'
  const usuarioId = 'user-123'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('generarExportacionMatricula', () => {
    it('debe generar exportación de matrícula exitosamente', async () => {
      const mockExportacion = { id: 'exp-123' }
      const mockEstudiantes = [
        {
          id: 'est-1',
          rut: '12345678-9',
          nombre: 'Juan',
          apellido: 'Pérez González',
          fecha_nacimiento: '2010-05-15',
          activo: true,
          cursos: { nombre: '8°A', nivel: '8° Básico', anio_academico: 2026 },
          apoderados: [
            {
              nombre: 'María',
              apellido: 'González',
              email: 'maria@example.com',
              telefono: '+56912345678',
              es_titular: true
            }
          ]
        }
      ]

      supabase.from.mockImplementation((table) => {
        if (table === 'sige_exportaciones') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: mockExportacion, error: null })
              })
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null })
            })
          }
        }
        if (table === 'estudiantes') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: mockEstudiantes, error: null })
              })
            })
          }
        }
      })

      const params = {
        fechaInicio: '2026-01-01',
        fechaFin: '2026-12-31'
      }

      const resultado = await sigeService.generarExportacionMatricula(tenantId, params, usuarioId)

      expect(resultado).toHaveProperty('exportacionId')
      expect(resultado).toHaveProperty('registros', 1)
      expect(resultado).toHaveProperty('archivoUrl')
    })

    it('debe marcar exportación como fallida en caso de error', async () => {
      const mockExportacion = { id: 'exp-123' }

      supabase.from.mockImplementation((table) => {
        if (table === 'sige_exportaciones') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: mockExportacion, error: null })
              })
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null })
            })
          }
        }
        if (table === 'estudiantes') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: null, error: new Error('DB error') })
              })
            })
          }
        }
      })

      const params = {
        fechaInicio: '2026-01-01',
        fechaFin: '2026-12-31'
      }

      await expect(
        sigeService.generarExportacionMatricula(tenantId, params, usuarioId)
      ).rejects.toThrow()
    })
  })

  describe('generarExportacionAsistencia', () => {
    it('debe generar exportación de asistencia', async () => {
      const mockExportacion = { id: 'exp-456' }
      const mockAsistencias = [
        {
          fecha: '2026-07-01',
          estado: 'Presente',
          bloque: 1,
          estudiantes: {
            rut: '12345678-9',
            nombre: 'Juan',
            apellido: 'Pérez',
            cursos: { nombre: '8°A' }
          }
        }
      ]

      supabase.from.mockImplementation((table) => {
        if (table === 'sige_exportaciones') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: mockExportacion, error: null })
              })
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null })
            })
          }
        }
        if (table === 'asistencia') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  lte: jest.fn().mockReturnValue({
                    order: jest.fn().mockResolvedValue({ data: mockAsistencias, error: null })
                  })
                })
              })
            })
          }
        }
      })

      const params = {
        fechaInicio: '2026-07-01',
        fechaFin: '2026-07-31'
      }

      const resultado = await sigeService.generarExportacionAsistencia(tenantId, params, usuarioId)

      expect(resultado).toHaveProperty('exportacionId')
      expect(resultado.registros).toBe(1)
    })
  })
})
