const protocolosService = require('../../services/protocolosService')
const { supabase } = require('../../utils/db')

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

describe('protocolosService — Catálogo de Tipos de Protocolo RICE (Hallazgo 6)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('debe retornar únicamente los protocolos activos y excluir los subsumidos (VIF, Abuso sexual)', async () => {
    const mockDbData = [
      { id: 1, nombre: 'Acoso escolar', activo: true, descripcion: 'Hostigamiento reiterado' },
      { id: 2, nombre: 'Ciberacoso', activo: true, descripcion: 'Acoso telemático' },
      { id: 3, nombre: 'Maltrato entre adultos', activo: true, descripcion: 'Conductas de agresión entre adultos' },
      { id: 4, nombre: 'Vulneración de derechos', activo: true, descripcion: 'Incluye hechos de VIF y abusos' },
      { id: 5, nombre: 'Violencia intrafamiliar', activo: false, descripcion: 'Subsumido' },
      { id: 6, nombre: 'Abuso sexual entre estudiantes', activo: false, descripcion: 'Subsumido' },
      { id: 7, nombre: 'Abuso sexual por adulto', activo: false, descripcion: 'Subsumido' },
    ]

    const orderMock = jest.fn().mockResolvedValue({ data: mockDbData, error: null })
    const selectMock = jest.fn().mockReturnValue({ order: orderMock })
    supabase.from.mockReturnValue({ select: selectMock })

    const resultado = await protocolosService.listarTiposProtocolo()

    expect(supabase.from).toHaveBeenCalledWith('tipos_protocolo')
    expect(selectMock).toHaveBeenCalledWith('id, nombre, activo, descripcion')
    expect(orderMock).toHaveBeenCalledWith('id')

    // Verificar que solo vienen los 4 activos
    expect(resultado).toHaveLength(4)
    const nombres = resultado.map((t) => t.nombre)
    expect(nombres).toContain('Acoso escolar')
    expect(nombres).toContain('Ciberacoso')
    expect(nombres).toContain('Maltrato entre adultos')
    expect(nombres).toContain('Vulneración de derechos')

    // Verificar que NINGUNO de los subsumidos esté presente
    expect(nombres).not.toContain('Violencia intrafamiliar')
    expect(nombres).not.toContain('Abuso sexual entre estudiantes')
    expect(nombres).not.toContain('Abuso sexual por adulto')
  })

  it('debe filtrar en memoria protocolos subsumidos si por alguna razón la BD devuelve registros con activo=true o sin filtrar', async () => {
    const mockDbData = [
      { id: 1, nombre: 'Acoso escolar', activo: true },
      { id: 2, nombre: 'Ciberacoso', activo: true },
      { id: 5, nombre: 'Violencia intrafamiliar', activo: true }, // Caso anómalo en BD
      { id: 6, nombre: 'Abuso sexual por adulto', activo: true }, // Caso anómalo en BD
    ]

    const orderMock = jest.fn().mockResolvedValue({ data: mockDbData, error: null })
    const selectMock = jest.fn().mockReturnValue({ order: orderMock })
    supabase.from.mockReturnValue({ select: selectMock })

    const resultado = await protocolosService.listarTiposProtocolo()

    expect(resultado).toHaveLength(2)
    const nombres = resultado.map((t) => t.nombre)
    expect(nombres).toEqual(['Acoso escolar', 'Ciberacoso'])
    expect(nombres).not.toContain('Violencia intrafamiliar')
    expect(nombres).not.toContain('Abuso sexual por adulto')
  })

  it('debe ejecutar fallback defensivo si la columna activo no existe en la base de datos (error 42703)', async () => {
    // Primer intento con select('id, nombre, activo, descripcion') falla con 42703 (undefined_column)
    const firstOrderMock = jest.fn().mockResolvedValue({
      data: null,
      error: { code: '42703', message: 'column "activo" does not exist' },
    })
    const firstSelectMock = jest.fn().mockReturnValue({ order: firstOrderMock })

    // Segundo intento (fallback): select('id, nombre').order('id')
    const fallbackOrderMock = jest.fn().mockResolvedValue({
      data: [
        { id: 1, nombre: 'Acoso escolar' },
        { id: 2, nombre: 'Violencia intrafamiliar' }, // Este debe filtrarse en memoria
        { id: 3, nombre: 'Vulneración de derechos' },
        { id: 4, nombre: 'Abuso sexual entre estudiantes' }, // Este debe filtrarse en memoria
      ],
      error: null,
    })
    const fallbackSelectMock = jest.fn().mockReturnValue({ order: fallbackOrderMock })

    supabase.from
      .mockReturnValueOnce({ select: firstSelectMock })
      .mockReturnValueOnce({ select: fallbackSelectMock })

    const resultado = await protocolosService.listarTiposProtocolo()

    expect(resultado).toHaveLength(2)
    const nombres = resultado.map((t) => t.nombre)
    expect(nombres).toEqual(['Acoso escolar', 'Vulneración de derechos'])
    expect(nombres).not.toContain('Violencia intrafamiliar')
    expect(nombres).not.toContain('Abuso sexual entre estudiantes')
  })
})
