const {
  obtenerDestinatariosCitacion,
  despacharActaOficialCitacion,
} = require('../../services/emailServiceCitacion')

// Mocks de dependencias
const mockSupabase = {
  from: jest.fn(),
}

jest.mock('../../utils/db', () => ({
  supabase: {
    from: (...args) => mockSupabase.from(...args),
  },
}))

jest.mock('../../services/emailService', () => ({
  enviarEmail: jest.fn().mockResolvedValue({ messageId: 'mock-msg-123' }),
}))

jest.mock('../../services/pdfCitacionActaService', () => ({
  generarActaCitacionPDF: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 Mock PDF Citacion')),
  calcularHashActaCitacion: jest.fn().mockReturnValue('a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90'),
}))

jest.mock('../../services/auditoriaService', () => ({
  registrarAuditoria: jest.fn().mockResolvedValue(true),
}))

const emailService = require('../../services/emailService')
const pdfCitacionActaService = require('../../services/pdfCitacionActaService')
const { registrarAuditoria } = require('../../services/auditoriaService')

describe('TASK 10.2.2 — Dispatcher Automático de Copias de Citación por Correo', () => {
  const mockTenantId = '1ea5232c-3631-4271-990c-8b4bf4d93db6'
  const mockCitacionId = 'c1234567-89ab-cdef-0123-456789abcdef'
  const mockUsuarioId = 'u9876543-210f-edcb-a987-654321fedcba'

  const mockCitacionData = {
    id: mockCitacionId,
    tenant_id: mockTenantId,
    folio: 'CIT-2026-0088',
    motivo_categoria: 'acuerdos_convivencia',
    motivo_detalle: 'Reunión de diálogo formativo para consolidar compromisos de convivencia.',
    fecha_hora_programada: '2026-11-15T10:30:00.000Z',
    modalidad: 'presencial',
    lugar_entrevista: 'Oficina de Convivencia Escolar',
    estado: 'realizada',
    estudiantes: {
      id: 'est-1',
      nombre: 'Sofía',
      apellido: 'Morales Alarcón',
      rut: '23.456.789-0',
      curso_id: 'curso-1',
      cursos: {
        id: 'curso-1',
        nombre: '7° Básico A',
        nivel: '7° Básico',
        profesores_jefes: {
          id: 'pj-1',
          nombre: 'Prof. Pedro',
          apellido: 'Pascal',
          email: 'pedro.pascal@escuelaelsalvador.cl',
        },
      },
    },
    apoderados: {
      id: 'apo-1',
      nombre: 'Carmen',
      apellido: 'Alarcón Silva',
      rut: '13.579.246-8',
      email: 'carmen.alarcon@correo.cl',
      telefono: '+56987654321',
    },
    usuarios: {
      id: 'doc-1',
      nombre: 'Prof. Mario',
      apellido: 'Casas',
      email: 'mario.casas@escuelaelsalvador.cl',
    },
  }

  const mockAcuerdosData = {
    id: 'acu-1',
    citacion_id: mockCitacionId,
    compromisos_colegio: [{ descripcion: 'Monitoreo diario en aula' }],
    compromisos_apoderado: [{ descripcion: 'Revisión de tareas' }],
    fecha_proximo_seguimiento: '2026-12-05',
    hash_sha256: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('1. Resolución y Desduplicación de Destinatarios', () => {
    it('debe obtener al Apoderado Titular y al Profesor Jefe del curso sin duplicados', async () => {
      const citacion = {
        ...mockCitacionData,
        estudiante: mockCitacionData.estudiantes,
        apoderado: mockCitacionData.apoderados,
        docente: mockCitacionData.usuarios,
      }

      const destinatarios = await obtenerDestinatariosCitacion(mockTenantId, citacion)

      expect(destinatarios).toHaveLength(2)
      expect(destinatarios).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            email: 'carmen.alarcon@correo.cl',
            tipo: 'apoderado_titular',
          }),
          expect.objectContaining({
            email: 'pedro.pascal@escuelaelsalvador.cl',
            tipo: 'profesor_jefe',
          }),
        ])
      )
    })

    it('si el profesor jefe no viene incrustado en el curso, debe consultar a Supabase por su email', async () => {
      const citacionSinPj = {
        ...mockCitacionData,
        estudiante: {
          ...mockCitacionData.estudiantes,
          cursos: { id: 'curso-1', nombre: '7° Básico A', profesor_jefe_id: 'pj-db' },
        },
        apoderado: mockCitacionData.apoderados,
        docente: mockCitacionData.usuarios,
      }

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            id: 'pj-db',
            nombre: 'Claudio',
            apellido: 'Bravo',
            email: 'claudio.bravo@escuelaelsalvador.cl',
          },
          error: null,
        }),
      })

      const destinatarios = await obtenerDestinatariosCitacion(mockTenantId, citacionSinPj)

      expect(destinatarios.some((d) => d.email === 'claudio.bravo@escuelaelsalvador.cl')).toBe(true)
    })
  })

  describe('2. Criterios de Aceptación: Despacho de Correo y Copia Informativa', () => {
    const setupMocksSupabase = (citacion = mockCitacionData, acuerdos = mockAcuerdosData) => {
      mockSupabase.from.mockImplementation((tabla) => {
        if (tabla === 'citaciones_formativas') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: citacion, error: null }),
          }
        }
        if (tabla === 'citacion_acuerdos_mutuos') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: acuerdos, error: null }),
          }
        }
        if (tabla === 'auditoria_logs') {
          return {
            insert: jest.fn().mockResolvedValue({ data: null, error: null }),
          }
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        }
      })
    }

    it('Criterio 1: Debe enviar correo formal al Apoderado Titular con PDF adjunto al cerrar la entrevista', async () => {
      setupMocksSupabase()

      const resultado = await despacharActaOficialCitacion({
        tenantId: mockTenantId,
        citacionId: mockCitacionId,
        usuarioId: mockUsuarioId,
      })

      expect(pdfCitacionActaService.generarActaCitacionPDF).toHaveBeenCalled()
      expect(emailService.enviarEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'carmen.alarcon@correo.cl',
          fromName: 'Prof. Mario Casas (vía SIGA Escolar)',
          replyTo: 'mario.casas@escuelaelsalvador.cl',
          subject: expect.stringContaining('CIT-2026-0088'),
          attachments: [
            expect.objectContaining({
              filename: 'Acta_Citacion_CIT-2026-0088.pdf',
              contentType: 'application/pdf',
              encoding: 'base64',
            }),
          ],
        })
      )
      expect(resultado.folio).toBe('CIT-2026-0088')
    })

    it('Criterio 2: Debe enviar copia informativa al Profesor Jefe del curso con el mismo PDF adjunto', async () => {
      setupMocksSupabase()

      await despacharActaOficialCitacion({
        tenantId: mockTenantId,
        citacionId: mockCitacionId,
        usuarioId: mockUsuarioId,
      })

      expect(emailService.enviarEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'pedro.pascal@escuelaelsalvador.cl',
          subject: expect.stringContaining('CIT-2026-0088'),
          attachments: [
            expect.objectContaining({
              filename: 'Acta_Citacion_CIT-2026-0088.pdf',
            }),
          ],
        })
      )
    })

    it('Criterio 3: Debe registrar inmutablemente la trazabilidad con Hash SHA-256 en auditoria_logs', async () => {
      setupMocksSupabase()

      const res = await despacharActaOficialCitacion({
        tenantId: mockTenantId,
        citacionId: mockCitacionId,
        usuarioId: mockUsuarioId,
      })

      expect(registrarAuditoria).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: mockTenantId,
          userId: mockUsuarioId,
          accion: 'SEND_EMAIL',
          tabla: 'citacion_acuerdos_mutuos',
          registroId: mockCitacionId,
          datosAfter: expect.objectContaining({
            folio: 'CIT-2026-0088',
            hash_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
            total_destinatarios: 2,
          }),
        })
      )
      expect(res.hash_sha256).toMatch(/^[a-f0-9]{64}$/)
    })

    it('debe arrojar 404 si la citación no existe en la base de datos', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      })

      await expect(
        despacharActaOficialCitacion({
          tenantId: mockTenantId,
          citacionId: 'cit-invalida',
          usuarioId: mockUsuarioId,
        })
      ).rejects.toThrow('Citación formativa no encontrada')
    })

    it('debe arrojar 400 si ni el apoderado ni el profesor jefe tienen correo registrado', async () => {
      const citacionSinCorreos = {
        ...mockCitacionData,
        apoderados: { nombre: 'Sin Correo' },
        estudiantes: {
          ...mockCitacionData.estudiantes,
          cursos: { id: 'c1', nombre: 'Curso' },
        },
        usuarios: { nombre: 'Docente Sin Correo' },
      }
      setupMocksSupabase(citacionSinCorreos)

      await expect(
        despacharActaOficialCitacion({
          tenantId: mockTenantId,
          citacionId: mockCitacionId,
          usuarioId: mockUsuarioId,
        })
      ).rejects.toThrow(/No se encontraron correos electrónicos válidos/i)
    })
  })
})
