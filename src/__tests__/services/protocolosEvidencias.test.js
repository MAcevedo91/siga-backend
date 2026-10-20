const protocolosService = require('../../services/protocolosService')
const evidenciasStorageService = require('../../services/evidenciasStorageService')
const { supabase } = require('../../utils/db')

jest.mock('../../utils/db')
jest.mock('../../services/auditoriaService', () => ({
  registrarAuditoria: jest.fn().mockResolvedValue({ id: 'audit-1' }),
}))
jest.mock('../../services/evidenciasStorageService', () => ({
  subirEvidenciaStorage: jest.fn().mockResolvedValue({
    publicUrl: 'https://storage.supabase.co/evidencias/tenant-1/file.pdf',
    storagePath: 'tenant-1/protocolos/prot-1/pasos/paso-1/file.pdf',
    nombreArchivo: 'acta_entrevista.pdf',
  }),
  eliminarEvidenciaStorage: jest.fn().mockResolvedValue(true),
  sanitizarNombreArchivo: jest.fn((n) => n),
}))
jest.mock('../../services/pdfService', () => ({
  generarExpedienteProtocoloPDF: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 Mock Expediente')),
}))
jest.mock('../../services/emailService')
jest.mock('../../services/notificacionesService')
const pdfService = require('../../services/pdfService')
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}))

describe('protocolosService — Carga de Evidencias en Checklist (Hallazgo 7)', () => {
  const mockTenantId = '11111111-1111-4111-8111-111111111111'
  const mockUsuarioId = '22222222-2222-4222-8222-222222222222'
  const mockProtocoloId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const mockPasoId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const mockEvidenciaId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('subirEvidenciaPaso()', () => {
    it('debe rechazar con 400 si no se proporciona archivo', async () => {
      await expect(
        protocolosService.subirEvidenciaPaso(
          mockProtocoloId,
          mockPasoId,
          mockTenantId,
          mockUsuarioId,
          null,
          '127.0.0.1'
        )
      ).rejects.toThrow('No se ha proporcionado ningún archivo para adjuntar')
    })

    it('debe rechazar con 404 si el protocolo no existe', async () => {
      // Mock de consulta a protocolos_rice
      const singleMock = jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } })
      const eqTenant = jest.fn().mockReturnValue({ single: singleMock })
      const eqId = jest.fn().mockReturnValue({ eq: eqTenant })
      const selectMock = jest.fn().mockReturnValue({ eq: eqId })
      supabase.from.mockReturnValue({ select: selectMock })

      await expect(
        protocolosService.subirEvidenciaPaso(
          mockProtocoloId,
          mockPasoId,
          mockTenantId,
          mockUsuarioId,
          { buffer: Buffer.from('test'), originalname: 'doc.pdf', mimetype: 'application/pdf' },
          '127.0.0.1'
        )
      ).rejects.toThrow('Protocolo no encontrado o no pertenece a este establecimiento')
    })

    it('debe rechazar con 400 si el protocolo ya está Cerrado', async () => {
      const singleMock = jest.fn().mockResolvedValue({ data: { id: mockProtocoloId, estado: 'Cerrado' }, error: null })
      const eqTenant = jest.fn().mockReturnValue({ single: singleMock })
      const eqId = jest.fn().mockReturnValue({ eq: eqTenant })
      const selectMock = jest.fn().mockReturnValue({ eq: eqId })
      supabase.from.mockReturnValue({ select: selectMock })

      await expect(
        protocolosService.subirEvidenciaPaso(
          mockProtocoloId,
          mockPasoId,
          mockTenantId,
          mockUsuarioId,
          { buffer: Buffer.from('test'), originalname: 'doc.pdf', mimetype: 'application/pdf' },
          '127.0.0.1'
        )
      ).rejects.toThrow('No se pueden adjuntar evidencias a un protocolo cerrado')
    })

    it('debe subir a storage y persistir el registro si el protocolo y paso son válidos', async () => {
      // Mock protocolo válido
      const singleProtMock = jest.fn().mockResolvedValue({
        data: { id: mockProtocoloId, estado: 'En Investigación' },
        error: null,
      })
      const eqProtTenant = jest.fn().mockReturnValue({ single: singleProtMock })
      const eqProtId = jest.fn().mockReturnValue({ eq: eqProtTenant })

      // Mock paso válido
      const singlePasoMock = jest.fn().mockResolvedValue({
        data: { id: mockPasoId, orden: 1 },
        error: null,
      })
      const eqPasoTenant = jest.fn().mockReturnValue({ single: singlePasoMock })
      const eqPasoProt = jest.fn().mockReturnValue({ eq: eqPasoTenant })
      const eqPasoId = jest.fn().mockReturnValue({ eq: eqPasoProt })

      // Mock insert evidencia
      const mockEvidenciaInsertada = {
        id: mockEvidenciaId,
        nombre_archivo: 'acta_entrevista.pdf',
        url_archivo: 'https://storage.supabase.co/evidencias/tenant-1/file.pdf',
      }
      const singleInsertMock = jest.fn().mockResolvedValue({ data: mockEvidenciaInsertada, error: null })
      const selectInsertMock = jest.fn().mockReturnValue({ single: singleInsertMock })
      const insertMock = jest.fn().mockReturnValue({ select: selectInsertMock })

      supabase.from.mockImplementation((table) => {
        if (table === 'protocolos_rice') {
          return { select: jest.fn().mockReturnValue({ eq: eqProtId }) }
        }
        if (table === 'protocolo_pasos') {
          return { select: jest.fn().mockReturnValue({ eq: eqPasoId }) }
        }
        if (table === 'protocolo_paso_evidencias') {
          return { insert: insertMock }
        }
        return {}
      })

      const resultado = await protocolosService.subirEvidenciaPaso(
        mockProtocoloId,
        mockPasoId,
        mockTenantId,
        mockUsuarioId,
        { buffer: Buffer.from('test pdf content'), originalname: 'acta_entrevista.pdf', mimetype: 'application/pdf', size: 1024 },
        '127.0.0.1'
      )

      expect(evidenciasStorageService.subirEvidenciaStorage).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: mockTenantId,
          protocoloId: mockProtocoloId,
          pasoId: mockPasoId,
          nombreOriginal: 'acta_entrevista.pdf',
          mimeType: 'application/pdf',
        })
      )
      expect(resultado).toEqual(mockEvidenciaInsertada)
    })
  })

  describe('eliminarEvidenciaPaso()', () => {
    it('debe rechazar con 400 si el protocolo está Cerrado', async () => {
      const singleMock = jest.fn().mockResolvedValue({ data: { id: mockProtocoloId, estado: 'Cerrado' }, error: null })
      const eqTenant = jest.fn().mockReturnValue({ single: singleMock })
      const eqId = jest.fn().mockReturnValue({ eq: eqTenant })
      const selectMock = jest.fn().mockReturnValue({ eq: eqId })
      supabase.from.mockReturnValue({ select: selectMock })

      await expect(
        protocolosService.eliminarEvidenciaPaso(
          mockProtocoloId,
          mockPasoId,
          mockEvidenciaId,
          mockTenantId,
          mockUsuarioId,
          '127.0.0.1'
        )
      ).rejects.toThrow('No se pueden eliminar evidencias de un protocolo cerrado')
    })

    it('debe eliminar de la BD y purgar en Storage exitosamente', async () => {
      // Mock protocolo abierto
      const singleProtMock = jest.fn().mockResolvedValue({
        data: { id: mockProtocoloId, estado: 'En Investigación' },
        error: null,
      })
      const eqProtTenant = jest.fn().mockReturnValue({ single: singleProtMock })
      const eqProtId = jest.fn().mockReturnValue({ eq: eqProtTenant })

      // Mock evidencia encontrada
      const singleEvMock = jest.fn().mockResolvedValue({
        data: { id: mockEvidenciaId, storage_path: 'tenant-1/path/file.pdf' },
        error: null,
      })
      const eqEvTenant = jest.fn().mockReturnValue({ single: singleEvMock })
      const eqEvProt = jest.fn().mockReturnValue({ eq: eqEvTenant })
      const eqEvPaso = jest.fn().mockReturnValue({ eq: eqEvProt })
      const eqEvId = jest.fn().mockReturnValue({ eq: eqEvPaso })

      // Mock delete
      const eqDelTenant = jest.fn().mockResolvedValue({ error: null })
      const eqDelId = jest.fn().mockReturnValue({ eq: eqDelTenant })
      const deleteMock = jest.fn().mockReturnValue({ eq: eqDelId })

      supabase.from.mockImplementation((table) => {
        if (table === 'protocolos_rice') {
          return { select: jest.fn().mockReturnValue({ eq: eqProtId }) }
        }
        if (table === 'protocolo_paso_evidencias') {
          return {
            select: jest.fn().mockReturnValue({ eq: eqEvId }),
            delete: deleteMock,
          }
        }
        return {}
      })

      const resultado = await protocolosService.eliminarEvidenciaPaso(
        mockProtocoloId,
        mockPasoId,
        mockEvidenciaId,
        mockTenantId,
        mockUsuarioId,
        '127.0.0.1'
      )

      expect(resultado).toEqual({ success: true, id: mockEvidenciaId })
      expect(evidenciasStorageService.eliminarEvidenciaStorage).toHaveBeenCalledWith('tenant-1/path/file.pdf')
    })
  })

  describe('generarPdfExpedienteProtocolo()', () => {
    it('debe rechazar con 404 si el protocolo no existe', async () => {
      const singleMock = jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } })
      const eqTenant = jest.fn().mockReturnValue({ single: singleMock })
      const eqId = jest.fn().mockReturnValue({ eq: eqTenant })
      const selectMock = jest.fn().mockReturnValue({ eq: eqId })
      supabase.from.mockReturnValue({ select: selectMock })

      await expect(
        protocolosService.generarPdfExpedienteProtocolo(mockProtocoloId, mockTenantId)
      ).rejects.toThrow('Protocolo no encontrado')
    })

    it('debe compilar datos, invocar pdfService y retornar buffer con filename oficial', async () => {
      const mockProtData = {
        id: mockProtocoloId,
        estado: 'En Investigación',
        fecha_apertura: '2026-10-15',
        fecha_cierre: null,
        observaciones: 'Caso de prueba RICE',
        tipos_protocolo: { id: 1, nombre: 'Acoso escolar' },
        estudiantes: {
          id: 'est-1',
          rut: '12.345.678-9',
          nombre: 'Juan',
          apellido: 'Pérez',
          cursos: { id: 'c1', nombre: '8° Básico B' },
          apoderados: [{ id: 'a1', nombre: 'Carlos Pérez', telefono: '+56911112222', es_titular: true }],
        },
        usuarios: { id: mockUsuarioId, nombre: 'Ana', apellido: 'Gómez' },
      }

      // Mock de supabase para protocolos_rice y protocolo_pasos
      const singleMock = jest.fn().mockResolvedValue({ data: mockProtData, error: null })
      const eqTenant = jest.fn().mockReturnValue({ single: singleMock })
      const eqId = jest.fn().mockReturnValue({ eq: eqTenant })

      const pasosOrderMock = jest.fn().mockResolvedValue({
        data: [{ id: mockPasoId, paso_numero: 1, nombre: 'Recepción', completado: true }],
        error: null,
      })
      const pasosEqTenant = jest.fn().mockReturnValue({ order: pasosOrderMock })
      const pasosEqProt = jest.fn().mockReturnValue({ eq: pasosEqTenant })

      const evEqTenant = jest.fn().mockResolvedValue({
        data: [{ id: mockEvidenciaId, paso_id: mockPasoId, nombre_archivo: 'acta.pdf' }],
        error: null,
      })
      const evInPaso = jest.fn().mockReturnValue({ eq: evEqTenant })

      supabase.from.mockImplementation((table) => {
        if (table === 'protocolos_rice') {
          return { select: jest.fn().mockReturnValue({ eq: eqId }) }
        }
        if (table === 'protocolo_pasos') {
          return { select: jest.fn().mockReturnValue({ eq: pasosEqProt }) }
        }
        if (table === 'protocolo_paso_evidencias') {
          return { select: jest.fn().mockReturnValue({ in: evInPaso }) }
        }
        return {}
      })

      const resultado = await protocolosService.generarPdfExpedienteProtocolo(mockProtocoloId, mockTenantId)

      expect(resultado).toHaveProperty('pdfBuffer')
      expect(resultado).toHaveProperty('filename')
      expect(resultado.filename).toContain('Expediente_RICE_')
      expect(resultado.filename).toContain('Pérez.pdf')
      expect(pdfService.generarExpedienteProtocoloPDF).toHaveBeenCalled()
    })
  })
})

