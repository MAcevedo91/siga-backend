const pdfMediacionService = require('../../services/pdfMediacionService')
const mediacionesController = require('../../controllers/mediacionesController')
const mediacionesService = require('../../services/mediacionesService')

jest.mock('../../services/mediacionesService')
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}))

describe('TASK 7.2.3.1 — Motor PDFKit de Acta Oficial de Mediación Escolar', () => {
  const mockMediacion = {
    id: '55555555-5555-4555-8555-555555555555',
    folio: 'MED-2026-0001',
    tipo_origen: 'preventiva_convivencia',
    estado: 'acordada',
    motivo: 'Diferencias reiteradas durante el recreo respecto al uso de la cancha deportiva principal.',
    fecha_programada: '2026-10-20T10:30:00.000Z',
    fecha_seguimiento: '2026-10-27',
    lugar_sesion: 'Sala de Convivencia y Mediación',
    conclusiones_cierre: 'Ambas partes expresaron su voluntad de convivir en armonía.',
    usuarios: {
      nombre: 'Constanza',
      apellido: 'Valenzuela',
      email: 'c.valenzuela@colegioelsalvador.cl',
    },
    mediacion_participantes: [
      {
        id: 'p1',
        estudiante_id: '33333333-3333-4333-8333-333333333333',
        rol_participante: 'parte_1',
        aviso_apoderado_enviado: true,
        estudiantes: {
          nombre: 'Mateo',
          apellido: 'González',
          rut: '22.333.444-5',
          cursos: { nombre: '7° Básico A' },
        },
      },
      {
        id: 'p2',
        estudiante_id: '44444444-4444-4444-8444-444444444444',
        rol_participante: 'parte_2',
        aviso_apoderado_enviado: true,
        estudiantes: {
          nombre: 'Joaquín',
          apellido: 'Muñoz',
          rut: '23.444.555-6',
          cursos: { nombre: '7° Básico B' },
        },
      },
    ],
    mediacion_compromisos: [
      {
        id: 'c1',
        estudiante_id: '33333333-3333-4333-8333-333333333333',
        tipo_compromiso: 'reparacion_relacional',
        descripcion: 'Ofrecer disculpa respetuosa en privado y comprometerse a compartir el turno de cancha.',
        fecha_limite: '2026-10-22',
        cumplido: false,
      },
      {
        id: 'c2',
        estudiante_id: '44444444-4444-4444-8444-444444444444',
        tipo_compromiso: 'cuidado_espacios',
        descripcion: 'Colaborar en la entrega del equipamiento deportivo al finalizar el recreo.',
        fecha_limite: '2026-10-24',
        cumplido: false,
      },
    ],
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ===========================================================================
  // 1. HASH CRIPTOGRÁFICO SHA-256 INMUTABLE
  // ===========================================================================
  describe('calcularHashMediacion', () => {
    it('debe generar un hash SHA-256 válido de 64 caracteres hexadecimales', () => {
      const hash = pdfMediacionService.calcularHashMediacion(mockMediacion)
      expect(hash).toBeDefined()
      expect(typeof hash).toBe('string')
      expect(hash).toMatch(/^[a-f0-9]{64}$/)
    })

    it('debe ser determinista (mismo contenido genera el mismo hash)', () => {
      const hash1 = pdfMediacionService.calcularHashMediacion(mockMediacion)
      const hash2 = pdfMediacionService.calcularHashMediacion(mockMediacion)
      expect(hash1).toBe(hash2)
    })

    it('debe cambiar ante cualquier alteración de los datos canónicos', () => {
      const hashOriginal = pdfMediacionService.calcularHashMediacion(mockMediacion)
      const mediacionModificada = {
        ...mockMediacion,
        motivo: 'Motivo alterado posteriormente de forma arbitraria',
      }
      const hashModificado = pdfMediacionService.calcularHashMediacion(mediacionModificada)
      expect(hashOriginal).not.toBe(hashModificado)
    })
  })

  // ===========================================================================
  // 2. GENERACIÓN DEL BUFFER PDF CON PDFKIT
  // ===========================================================================
  describe('generarActaMediacionPDF', () => {
    it('CRITERIO 1, 2, 3, 4: debe generar un Buffer PDF válido que comience con la cabecera %PDF-', async () => {
      const buffer = await pdfMediacionService.generarActaMediacionPDF(mockMediacion)

      expect(Buffer.isBuffer(buffer)).toBe(true)
      expect(buffer.length).toBeGreaterThan(1000)

      // Comprobar número mágico estándar de archivo PDF
      const pdfMagicBytes = buffer.toString('ascii', 0, 5)
      expect(pdfMagicBytes).toBe('%PDF-')

      // Verificar que el PDF contenga los metadatos estructurados en UTF-16BE
      expect(buffer.includes(Buffer.from('MED-2026-0001', 'utf16le').swap16())).toBe(true)
      expect(buffer.includes(Buffer.from('9876-5', 'utf16le').swap16())).toBe(true)
    })

    it('debe tolerar una mediación sin compromisos registrados y generar el PDF', async () => {
      const mediacionSinCompromisos = {
        ...mockMediacion,
        mediacion_compromisos: [],
      }

      const buffer = await pdfMediacionService.generarActaMediacionPDF(mediacionSinCompromisos)
      expect(Buffer.isBuffer(buffer)).toBe(true)
      expect(buffer.slice(0, 5).toString('utf-8')).toBe('%PDF-')
    })

    it('debe tolerar participantes sin datos de apoderado o cursos incompletos', async () => {
      const mediacionIncompleta = {
        ...mockMediacion,
        usuarios: null,
        mediacion_participantes: [
          {
            estudiante_id: 'e1',
            rol_participante: 'parte_1',
            estudiantes: { nombre: 'SoloNombre' },
          },
        ],
      }

      const buffer = await pdfMediacionService.generarActaMediacionPDF(mediacionIncompleta)
      expect(Buffer.isBuffer(buffer)).toBe(true)
      expect(buffer.length).toBeGreaterThan(500)
    })
  })

  // ===========================================================================
  // 3. HANDLER DEL CONTROLADOR: descargarActaPdfHandler
  // ===========================================================================
  describe('mediacionesController.descargarActaPdfHandler', () => {
    let mockReq, mockRes, mockNext

    beforeEach(() => {
      mockReq = {
        user: { tenant_id: 'tenant-123', id: 'user-123' },
        params: { id: mockMediacion.id },
      }
      mockRes = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      }
      mockNext = jest.fn()
    })

    it('debe configurar cabeceras application/pdf y enviar el Buffer correctamente', async () => {
      mediacionesService.obtenerMediacionPorId.mockResolvedValue(mockMediacion)

      await mediacionesController.descargarActaPdfHandler(mockReq, mockRes, mockNext)

      expect(mediacionesService.obtenerMediacionPorId).toHaveBeenCalledWith('tenant-123', mockMediacion.id)
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf')
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringMatching(/inline; filename="Acta_Mediacion_MED-2026-0001.pdf"/)
      )
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Length', expect.any(Number))
      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.send).toHaveBeenCalledWith(expect.any(Buffer))
    })

    it('debe capturar errores de mediación no encontrada y delegarlos a next', async () => {
      const errorMock = new Error('Mediación no encontrada')
      errorMock.statusCode = 404
      mediacionesService.obtenerMediacionPorId.mockRejectedValue(errorMock)

      await mediacionesController.descargarActaPdfHandler(mockReq, mockRes, mockNext)

      expect(mockNext).toHaveBeenCalledWith(errorMock)
    })
  })
})
