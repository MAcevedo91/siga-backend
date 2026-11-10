const emailServiceMediacion = require('../../services/emailServiceMediacion')
const emailService = require('../../services/emailService')
const mediacionesService = require('../../services/mediacionesService')
const pdfMediacionService = require('../../services/pdfMediacionService')
const auditoriaService = require('../../services/auditoriaService')
const { despacharActaHandler } = require('../../controllers/mediacionesController')

// Mockear dependencias externas
jest.mock('../../services/emailService', () => ({
  enviarEmail: jest.fn(),
}))
jest.mock('../../services/mediacionesService', () => ({
  obtenerMediacionPorId: jest.fn(),
}))
jest.mock('../../services/pdfMediacionService', () => ({
  generarActaMediacionPDF: jest.fn(),
  calcularHashMediacion: jest.fn(),
}))
jest.mock('../../services/auditoriaService', () => ({
  registrarAuditoria: jest.fn(),
}))
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}))

// Mock de db.js para simular supabase y auditoria_logs si es requerida
jest.mock('../../utils/db', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn().mockResolvedValue({ error: null }),
    })),
  },
}))

describe('TASK 7.2.3.2 — Servicio Dispatcher Transaccional de Correos de Mediación', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001'
  const usuarioId = '11111111-1111-4111-8111-111111111111'
  const mediacionId = '55555555-5555-4555-8555-555555555555'

  const mockPdfBuffer = Buffer.from('%PDF-1.4 Mock PDF Content')
  const mockHash = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'

  beforeEach(() => {
    jest.clearAllMocks()
    pdfMediacionService.generarActaMediacionPDF.mockResolvedValue(mockPdfBuffer)
    pdfMediacionService.calcularHashMediacion.mockReturnValue(mockHash)
    auditoriaService.registrarAuditoria.mockResolvedValue(true)
    emailService.enviarEmail.mockImplementation(({ to }) =>
      Promise.resolve({ id: `job-${to}-${Date.now()}` })
    )
  })

  describe('Criterio 1 y 2: Despacho a Apoderados y Profesores Jefes con PDF Adjunto', () => {
    it('debe obtener apoderado titular y profesor jefe y enviarles el correo con el PDF adjunto', async () => {
      const mockMediacionDistintosCursos = {
        id: mediacionId,
        folio: 'MED-2026-0001',
        tipo_origen: 'preventiva_convivencia',
        estado: 'acordada',
        motivo: 'Diferencias reiteradas en patio central.',
        fecha_programada: '2026-10-20T10:30:00.000Z',
        lugar_sesion: 'Sala de Convivencia',
        usuarios: {
          nombre: 'Constanza',
          apellido: 'Valenzuela',
          email: 'c.valenzuela@colegioelsalvador.cl',
        },
        mediacion_participantes: [
          {
            id: 'p1',
            estudiante_id: 'est-1',
            rol_participante: 'parte_1',
            estudiantes: {
              nombre: 'Mateo',
              apellido: 'González',
              rut: '22.333.444-5',
              cursos: {
                id: 'cur-1',
                nombre: '7° Básico A',
                profesores_jefes: {
                  id: 'pj-1',
                  nombre: 'Carlos',
                  apellido: 'Pérez',
                  email: 'carlos.perez@colegioelsalvador.cl',
                },
              },
              apoderados: [
                {
                  id: 'apo-1',
                  nombre: 'María',
                  apellido: 'González',
                  email: 'maria.gonzalez@example.com',
                  es_titular: true,
                },
              ],
            },
          },
          {
            id: 'p2',
            estudiante_id: 'est-2',
            rol_participante: 'parte_2',
            estudiantes: {
              nombre: 'Joaquín',
              apellido: 'Muñoz',
              rut: '23.444.555-6',
              cursos: {
                id: 'cur-2',
                nombre: '7° Básico B',
                profesores_jefes: {
                  id: 'pj-2',
                  nombre: 'Lorena',
                  apellido: 'Reyes',
                  email: 'lorena.reyes@colegioelsalvador.cl',
                },
              },
              apoderados: [
                {
                  id: 'apo-2',
                  nombre: 'Pedro',
                  apellido: 'Muñoz',
                  email: 'pedro.munoz@example.com',
                  es_titular: true,
                },
              ],
            },
          },
        ],
        mediacion_compromisos: [
          {
            id: 'c1',
            descripcion: 'Trato respetuoso recíproco',
            fecha_limite: '2026-10-25',
          },
        ],
      }

      mediacionesService.obtenerMediacionPorId.mockResolvedValue(mockMediacionDistintosCursos)

      const resultado = await emailServiceMediacion.despacharActaOficial({
        tenantId,
        mediacionId,
        usuarioId,
      })

      expect(resultado).toBeDefined()
      expect(resultado.folio).toBe('MED-2026-0001')
      expect(resultado.hash_sha256).toBe(mockHash)
      expect(resultado.total_destinatarios).toBe(4) // 2 apoderados + 2 profesores jefes

      // Se debe haber generado el PDF
      expect(pdfMediacionService.generarActaMediacionPDF).toHaveBeenCalledWith(
        mockMediacionDistintosCursos
      )

      // Debe haberse llamado a enviarEmail exactamente 4 veces
      expect(emailService.enviarEmail).toHaveBeenCalledTimes(4)

      // Comprobar que a cada uno se le envió el adjunto del acta PDF
      const emailsDestinatarios = emailService.enviarEmail.mock.calls.map((call) => call[0].to)
      expect(emailsDestinatarios).toContain('maria.gonzalez@example.com')
      expect(emailsDestinatarios).toContain('carlos.perez@colegioelsalvador.cl')
      expect(emailsDestinatarios).toContain('pedro.munoz@example.com')
      expect(emailsDestinatarios).toContain('lorena.reyes@colegioelsalvador.cl')

      const primerLlamado = emailService.enviarEmail.mock.calls[0][0]
      expect(primerLlamado.attachments).toHaveLength(1)
      expect(primerLlamado.attachments[0].filename).toBe('Acta_Mediacion_MED-2026-0001.pdf')
      expect(primerLlamado.attachments[0].contentType).toBe('application/pdf')
      expect(primerLlamado.attachments[0].content).toBe(mockPdfBuffer.toString('base64'))
    })
  })

  describe('Criterio 3: Desduplicación Estricta de Profesores Jefes y Apoderados', () => {
    it('si ambos alumnos pertenecen al mismo curso o tienen el mismo profesor jefe, NO debe duplicar el correo', async () => {
      const mockMediacionMismoCurso = {
        id: mediacionId,
        folio: 'MED-2026-0002',
        tipo_origen: 'preventiva_convivencia',
        estado: 'acordada',
        motivo: 'Diferencias en sala de 8° Básico A.',
        usuarios: {
          nombre: 'Constanza',
          apellido: 'Valenzuela',
          email: 'c.valenzuela@colegioelsalvador.cl',
        },
        mediacion_participantes: [
          {
            id: 'p1',
            estudiante_id: 'est-1',
            rol_participante: 'parte_1',
            estudiantes: {
              nombre: 'Alumno A',
              apellido: 'Silva',
              cursos: {
                id: 'cur-1',
                nombre: '8° Básico A',
                profesores_jefes: {
                  id: 'pj-compartido',
                  nombre: 'Profesor Único',
                  apellido: 'Docente',
                  email: 'profesor.unico@colegioelsalvador.cl',
                },
              },
              apoderados: [
                {
                  id: 'apo-1',
                  nombre: 'Apoderado 1',
                  email: 'apoderado1@example.com',
                  es_titular: true,
                },
              ],
            },
          },
          {
            id: 'p2',
            estudiante_id: 'est-2',
            rol_participante: 'parte_2',
            estudiantes: {
              nombre: 'Alumno B',
              apellido: 'Rojas',
              cursos: {
                id: 'cur-1',
                nombre: '8° Básico A',
                profesores_jefes: {
                  id: 'pj-compartido',
                  nombre: 'Profesor Único',
                  apellido: 'Docente',
                  email: 'PROFESOR.UNICO@colegioelsalvador.cl', // Con mayúsculas para probar normalización case-insensitive
                },
              },
              apoderados: [
                {
                  id: 'apo-2',
                  nombre: 'Apoderado 2',
                  email: 'apoderado2@example.com',
                  es_titular: true,
                },
              ],
            },
          },
        ],
        mediacion_compromisos: [],
      }

      mediacionesService.obtenerMediacionPorId.mockResolvedValue(mockMediacionMismoCurso)

      const resultado = await emailServiceMediacion.despacharActaOficial({
        tenantId,
        mediacionId,
        usuarioId,
      })

      // Eran 2 apoderados y 1 profesor jefe compartido => total 3
      expect(resultado.total_destinatarios).toBe(3)
      expect(emailService.enviarEmail).toHaveBeenCalledTimes(3)

      const llamadasAProfesor = emailService.enviarEmail.mock.calls.filter(
        (call) => call[0].to.toLowerCase() === 'profesor.unico@colegioelsalvador.cl'
      )
      expect(llamadasAProfesor).toHaveLength(1)
    })

    it('si los alumnos son hermanos y comparten el mismo apoderado titular, NO debe duplicar el correo', async () => {
      const mockMediacionHermanos = {
        id: mediacionId,
        folio: 'MED-2026-0003',
        usuarios: { nombre: 'Constanza', apellido: 'Valenzuela' },
        mediacion_participantes: [
          {
            id: 'p1',
            estudiantes: {
              nombre: 'Hermano Mayor',
              cursos: {
                profesores_jefes: { email: 'profe1@colegio.cl', nombre: 'P1' },
              },
              apoderados: [
                { nombre: 'Mamá', email: 'mama.compartida@example.com', es_titular: true },
              ],
            },
          },
          {
            id: 'p2',
            estudiantes: {
              nombre: 'Hermano Menor',
              cursos: {
                profesores_jefes: { email: 'profe2@colegio.cl', nombre: 'P2' },
              },
              apoderados: [
                { nombre: 'Mamá', email: 'mama.compartida@example.com', es_titular: true },
              ],
            },
          },
        ],
      }

      mediacionesService.obtenerMediacionPorId.mockResolvedValue(mockMediacionHermanos)

      const resultado = await emailServiceMediacion.despacharActaOficial({
        tenantId,
        mediacionId,
        usuarioId,
      })

      // 1 mamá compartida + 2 profesores distintos = 3 destinatarios
      expect(resultado.total_destinatarios).toBe(3)
      expect(emailService.enviarEmail).toHaveBeenCalledTimes(3)
    })
  })

  describe('Criterio 4: Registro Inmutable en Auditoría con SHA-256 y Destinatarios', () => {
    it('debe registrar el evento en la auditoría con los datos canónicos, timestamp y hash SHA-256', async () => {
      const mockMediacion = {
        id: mediacionId,
        folio: 'MED-2026-0004',
        usuarios: { nombre: 'Constanza', apellido: 'Valenzuela' },
        mediacion_participantes: [
          {
            estudiantes: {
              nombre: 'Alumno',
              cursos: { profesores_jefes: { email: 'profe@colegio.cl', nombre: 'Profe' } },
              apoderados: [{ email: 'apo@example.com', nombre: 'Apo', es_titular: true }],
            },
          },
        ],
      }

      mediacionesService.obtenerMediacionPorId.mockResolvedValue(mockMediacion)

      await emailServiceMediacion.despacharActaOficial({
        tenantId,
        mediacionId,
        usuarioId,
      })

      expect(auditoriaService.registrarAuditoria).toHaveBeenCalledTimes(1)
      const auditCall = auditoriaService.registrarAuditoria.mock.calls[0][0]

      expect(auditCall.tenantId).toBe(tenantId)
      expect(auditCall.userId).toBe(usuarioId)
      expect(auditCall.accion).toBe('SEND_EMAIL')
      expect(auditCall.tabla).toBe('mediacion_actas')
      expect(auditCall.registroId).toBe(mediacionId)
      expect(auditCall.datosAfter).toBeDefined()
      expect(auditCall.datosAfter.folio).toBe('MED-2026-0004')
      expect(auditCall.datosAfter.hash_sha256).toBe(mockHash)
      expect(auditCall.datosAfter.timestamp).toBeDefined()
      expect(auditCall.datosAfter.destinatarios).toHaveLength(2)
      expect(auditCall.datosAfter.destinatarios[0]).toHaveProperty('email')
      expect(auditCall.datosAfter.destinatarios[0]).toHaveProperty('tipo')
    })
  })

  describe('Casos Borde y Manejo de Errores', () => {
    it('debe rechazar con error si no se especifica tenantId o mediacionId', async () => {
      await expect(
        emailServiceMediacion.despacharActaOficial({ mediacionId })
      ).rejects.toThrow('tenantId y mediacionId son requeridos')

      await expect(
        emailServiceMediacion.despacharActaOficial({ tenantId })
      ).rejects.toThrow('tenantId y mediacionId son requeridos')
    })

    it('debe arrojar error si la mediación no tiene destinatarios con email válido', async () => {
      const mockMediacionSinEmails = {
        id: mediacionId,
        folio: 'MED-2026-SIN-MAIL',
        usuarios: { nombre: 'Constanza', apellido: 'Valenzuela' },
        mediacion_participantes: [
          {
            estudiantes: {
              nombre: 'Sin Correo',
              cursos: {},
              apoderados: [],
            },
          },
        ],
      }

      mediacionesService.obtenerMediacionPorId.mockResolvedValue(mockMediacionSinEmails)

      await expect(
        emailServiceMediacion.despacharActaOficial({
          tenantId,
          mediacionId,
          usuarioId,
        })
      ).rejects.toThrow('No se encontraron correos válidos de apoderados ni profesores jefes')
    })
  })

  describe('mediacionesController.despacharActaHandler', () => {
    it('debe responder HTTP 200 con el resultado del despacho exitoso', async () => {
      const mockResultado = {
        mediacion_id: mediacionId,
        folio: 'MED-2026-0001',
        hash_sha256: mockHash,
        total_destinatarios: 2,
        despachos: [
          { email: 'apo@example.com', tipo: 'Apoderado Titular', status: 'enqueued' },
        ],
      }

      const req = {
        user: { tenant_id: tenantId, user_id: usuarioId },
        params: { id: mediacionId },
      }
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      }
      const next = jest.fn()

      const spy = jest
        .spyOn(emailServiceMediacion, 'despacharActaOficial')
        .mockResolvedValue(mockResultado)

      await despacharActaHandler(req, res, next)

      expect(spy).toHaveBeenCalledWith({
        tenantId,
        mediacionId,
        usuarioId,
      })
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        message: 'Acta oficial de mediación despachada exitosamente',
        data: mockResultado,
      })
      expect(next).not.toHaveBeenCalled()
      spy.mockRestore()
    })

    it('debe delegar a next(err) ante cualquier excepción capturada', async () => {
      const req = {
        user: { tenant_id: tenantId, user_id: usuarioId },
        params: { id: mediacionId },
      }
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      }
      const next = jest.fn()

      const mockError = new Error('Fallo simulado en cola de correo')
      const spy = jest
        .spyOn(emailServiceMediacion, 'despacharActaOficial')
        .mockRejectedValue(mockError)

      await despacharActaHandler(req, res, next)

      expect(next).toHaveBeenCalledWith(mockError)
      spy.mockRestore()
    })
  })
})
