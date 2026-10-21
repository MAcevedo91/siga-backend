const mediacionesService = require('../../services/mediacionesService')
const protocolosService = require('../../services/protocolosService')
const auditoriaService = require('../../services/auditoriaService')
const { supabase } = require('../../utils/db')
const {
  evaluarCompromisosHandler,
  cerrarMediacionHandler,
  historialEstudianteHandler,
} = require('../../controllers/mediacionesController')

// Mockear dependencias externas
jest.mock('../../utils/db', () => ({
  supabase: {
    from: jest.fn(),
  },
}))

jest.mock('../../services/protocolosService', () => ({
  crearProtocolo: jest.fn(),
}))

jest.mock('../../services/auditoriaService', () => ({
  registrarAuditoria: jest.fn().mockResolvedValue(true),
}))

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}))

describe('TASK 7.2.4.1 — Evaluación de Compromisos, Cierre Inmutable e Historial por Estudiante', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001'
  const usuarioId = '11111111-1111-4111-8111-111111111111'
  const mediacionId = '55555555-5555-4555-8555-555555555555'
  const estudianteId = '33333333-3333-4333-8333-333333333333'
  const compromisoId1 = '77777777-7777-4777-8777-777777777771'
  const compromisoId2 = '77777777-7777-4777-8777-777777777772'

  const mockMediacionAbierta = {
    id: mediacionId,
    folio: 'MED-2026-0005',
    tipo_origen: 'preventiva_convivencia',
    estado: 'acordada',
    motivo: 'Diferencias reiteradas durante el recreo.',
    fecha_programada: '2026-10-20T10:00:00.000Z',
    lugar_sesion: 'Sala de Convivencia',
    fecha_seguimiento: '2026-10-27T10:00:00.000Z',
    conclusiones_cierre: null,
    cerrada_at: null,
    cerrada_por_id: null,
    protocolo_id: null,
    usuarios: { id: usuarioId, nombre: 'Constanza', apellido: 'Valenzuela' },
    mediacion_participantes: [
      {
        id: 'part-1',
        estudiante_id: estudianteId,
        rol_participante: 'parte_1',
      },
      {
        id: 'part-2',
        estudiante_id: '44444444-4444-4444-8444-444444444444',
        rol_participante: 'parte_2',
      },
    ],
    mediacion_compromisos: [
      {
        id: compromisoId1,
        estudiante_id: estudianteId,
        tipo_compromiso: 'reparacion_relacional',
        descripcion: 'Disculpa sincera y trato respetuoso',
        fecha_limite: '2026-10-25',
        estado: 'pendiente',
        cumplido: false,
      },
      {
        id: compromisoId2,
        estudiante_id: '44444444-4444-4444-8444-444444444444',
        tipo_compromiso: 'cuidado_espacios',
        descripcion: 'Mantener orden en sala',
        fecha_limite: '2026-10-26',
        estado: 'pendiente',
        cumplido: false,
      },
    ],
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Criterio 1: Evaluación de Compromisos Formativos (evaluarCompromisos)', () => {
    it('debe actualizar los estados de los compromisos a cumplido, parcial o incumplido y sincronizar cumplido booleano', async () => {
      // Mock para obtenerMediacionPorId
      const selectChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockMediacionAbierta, error: null }),
      }

      // Mock para update en mediacion_compromisos
      const updateComp1 = {
        id: compromisoId1,
        estado: 'cumplido',
        cumplido: true,
        fecha_cumplimiento: expect.any(String),
      }
      const updateComp2 = {
        id: compromisoId2,
        estado: 'parcial',
        cumplido: false,
        fecha_cumplimiento: null,
      }

      const updateChain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest
          .fn()
          .mockResolvedValueOnce({ data: updateComp1, error: null })
          .mockResolvedValueOnce({ data: updateComp2, error: null }),
      }

      supabase.from.mockImplementation((table) => {
        if (table === 'mediaciones') return selectChain
        if (table === 'mediacion_compromisos') return updateChain
        return {}
      })

      const payload = {
        evaluaciones: [
          {
            compromiso_id: compromisoId1,
            estado: 'cumplido',
            observaciones_seguimiento: 'El alumno cumplió satisfactoriamente con la disculpa.',
          },
          {
            compromiso_id: compromisoId2,
            estado: 'parcial',
            observaciones_seguimiento: 'Cumplió en 2 de 3 jornadas.',
          },
        ],
      }

      const resultado = await mediacionesService.evaluarCompromisos(
        tenantId,
        mediacionId,
        usuarioId,
        payload
      )

      expect(resultado).toBeDefined()
      expect(resultado.mediacion_id).toBe(mediacionId)
      expect(resultado.total_evaluados).toBe(2)
      expect(resultado.compromisos).toHaveLength(2)

      // Verificar que se invocó a auditoriaService
      expect(auditoriaService.registrarAuditoria).toHaveBeenCalledTimes(1)
      const auditCall = auditoriaService.registrarAuditoria.mock.calls[0][0]
      expect(auditCall.tenantId).toBe(tenantId)
      expect(auditCall.userId).toBe(usuarioId)
      expect(auditCall.tabla).toBe('mediacion_compromisos')
      expect(auditCall.datosAfter.accion_especifica).toBe('EVALUAR_COMPROMISOS')
    })

    it('debe rechazar la evaluación con 409 si el expediente de mediación ya fue sellado y cerrado inmutablemente', async () => {
      const mockMediacionCerrada = {
        ...mockMediacionAbierta,
        cerrada_at: '2026-10-21T12:00:00.000Z',
        conclusiones_cierre: 'Sesión concluida exitosamente.',
      }

      const selectChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockMediacionCerrada, error: null }),
      }

      supabase.from.mockReturnValue(selectChain)

      const payload = {
        evaluaciones: [
          { compromiso_id: compromisoId1, estado: 'cumplido' },
        ],
      }

      await expect(
        mediacionesService.evaluarCompromisos(tenantId, mediacionId, usuarioId, payload)
      ).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringContaining('sellado y cerrado inmutablemente'),
      })
    })

    it('debe rechazar si el payload de evaluación contiene estados no válidos', async () => {
      const payloadInvalido = {
        evaluaciones: [
          { compromiso_id: compromisoId1, estado: 'estado_inexistente' },
        ],
      }

      await expect(
        mediacionesService.evaluarCompromisos(tenantId, mediacionId, usuarioId, payloadInvalido)
      ).rejects.toMatchObject({
        statusCode: 400,
      })
    })
  })

  describe('Criterio 2: Cierre Inmutable del Expediente (cerrarMediacion)', () => {
    it('debe sellar inmutablemente el expediente registrando conclusiones, timestamp y usuario de cierre', async () => {
      const selectChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockMediacionAbierta, error: null }),
      }

      const updateMedChain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            ...mockMediacionAbierta,
            estado: 'acordada',
            conclusiones_cierre: 'Los estudiantes lograron restablecer el diálogo pacífico.',
            cerrada_at: '2026-10-21T14:00:00.000Z',
            cerrada_por_id: usuarioId,
          },
          error: null,
        }),
      }

      supabase.from.mockImplementation((table) => {
        if (table === 'mediaciones') {
          // Primero hace select en obtenerMediacionPorId, luego update
          return {
            select: selectChain.select,
            update: updateMedChain.update,
            eq: jest.fn().mockReturnThis(),
            single: jest
              .fn()
              .mockResolvedValueOnce({ data: mockMediacionAbierta, error: null })
              .mockResolvedValueOnce({
                data: {
                  ...mockMediacionAbierta,
                  estado: 'acordada',
                  conclusiones_cierre: 'Los estudiantes lograron restablecer el diálogo pacífico.',
                  cerrada_at: '2026-10-21T14:00:00.000Z',
                  cerrada_por_id: usuarioId,
                },
                error: null,
              }),
          }
        }
        return {}
      })

      const payload = {
        estado: 'acordada',
        conclusiones_cierre: 'Los estudiantes lograron restablecer el diálogo pacífico.',
      }

      const resultado = await mediacionesService.cerrarMediacion(
        tenantId,
        mediacionId,
        usuarioId,
        payload
      )

      expect(resultado).toBeDefined()
      expect(resultado.folio).toBe('MED-2026-0005')
      expect(resultado.estado_final).toBe('acordada')
      expect(resultado.cerrada_at).toBeDefined()
      expect(resultado.cerrada_por_id).toBe(usuarioId)

      // Verificar auditoría de cierre
      expect(auditoriaService.registrarAuditoria).toHaveBeenCalledTimes(1)
      const auditCall = auditoriaService.registrarAuditoria.mock.calls[0][0]
      expect(auditCall.datosAfter.accion_especifica).toBe('CERRAR_MEDIACION_INMUTABLE')
    })

    it('debe rechazar con 409 si se intenta volver a cerrar un expediente ya sellado', async () => {
      const mockYaCerrada = {
        ...mockMediacionAbierta,
        cerrada_at: '2026-10-20T18:00:00.000Z',
      }

      const selectChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockYaCerrada, error: null }),
      }

      supabase.from.mockReturnValue(selectChain)

      const payload = {
        estado: 'sin_acuerdo',
        conclusiones_cierre: 'Intento de re-cierre no permitido.',
      }

      await expect(
        mediacionesService.cerrarMediacion(tenantId, mediacionId, usuarioId, payload)
      ).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringContaining('ya fue cerrado y sellado'),
      })
    })

    it('debe impedir guardar compromisos posteriores si el expediente está sellado (guardarCompromisos)', async () => {
      const mockYaCerrada = {
        id: mediacionId,
        folio: 'MED-2026-0005',
        fecha_programada: '2026-10-20T10:00:00.000Z',
        estado: 'acordada',
        cerrada_at: '2026-10-20T18:00:00.000Z',
      }

      const selectChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockYaCerrada, error: null }),
      }

      supabase.from.mockReturnValue(selectChain)

      const payloadCompromisos = {
        compromisos: [
          {
            tipo_compromiso: 'reparacion_relacional',
            descripcion: 'Compromiso tardío no permitido',
            fecha_limite: '2026-10-25',
          },
        ],
      }

      await expect(
        mediacionesService.guardarCompromisos(tenantId, mediacionId, usuarioId, payloadCompromisos)
      ).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringContaining('sellado y cerrado inmutablemente'),
      })
    })
  })

  describe('Criterio 3: Derivación a Inspectoría y Enlace RICE Opcional', () => {
    it('si el estado es derivada_inspectoria y se proporciona protocolo_rice, debe aperturar y enlazar el protocolo RICE', async () => {
      const mockProtocoloCreado = {
        id: '99999999-9999-4999-8999-999999999999',
        tipo_protocolo_id: 1,
        estado: 'En Investigación',
        estudiante_id: estudianteId,
      }

      protocolosService.crearProtocolo.mockResolvedValue(mockProtocoloCreado)

      supabase.from.mockImplementation((table) => {
        if (table === 'mediaciones') {
          return {
            select: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest
              .fn()
              .mockResolvedValueOnce({ data: mockMediacionAbierta, error: null })
              .mockResolvedValueOnce({
                data: {
                  ...mockMediacionAbierta,
                  estado: 'derivada_inspectoria',
                  conclusiones_cierre: 'No fue posible conciliación; se deriva por protocolo normativo.',
                  protocolo_id: mockProtocoloCreado.id,
                  cerrada_at: '2026-10-21T15:00:00.000Z',
                },
                error: null,
              }),
          }
        }
        return {}
      })

      const payload = {
        estado: 'derivada_inspectoria',
        conclusiones_cierre: 'No fue posible conciliación; se deriva por protocolo normativo.',
        protocolo_rice: {
          tipo_protocolo_id: 1,
          estudiante_id: estudianteId,
          observaciones: 'Apertura formal de protocolo tras fracaso de mediación preliminar.',
        },
      }

      const resultado = await mediacionesService.cerrarMediacion(
        tenantId,
        mediacionId,
        usuarioId,
        payload
      )

      expect(resultado).toBeDefined()
      expect(resultado.estado_final).toBe('derivada_inspectoria')
      expect(resultado.protocolo_rice).toBeDefined()
      expect(resultado.protocolo_rice.id).toBe(mockProtocoloCreado.id)

      // Se debe haber llamado a crearProtocolo con los datos correctos
      expect(protocolosService.crearProtocolo).toHaveBeenCalledWith(
        tenantId,
        usuarioId,
        expect.objectContaining({
          tipo_protocolo_id: 1,
          estudiante_id: estudianteId,
        })
      )
    })
  })

  describe('Criterio 4: Historial de Mediaciones por Estudiante (obtenerHistorialMediacionesEstudiante)', () => {
    it('debe retornar el expediente conductual consolidado y las métricas de cumplimiento del alumno', async () => {
      const mockEstudiante = {
        id: estudianteId,
        rut: '22.333.444-5',
        nombre: 'Mateo',
        apellido: 'González',
        curso_id: 'curso-1',
        cursos: { id: 'curso-1', nombre: '7° Básico A' },
      }

      const mockParticipaciones = [
        {
          id: 'part-1',
          rol_participante: 'parte_1',
          aviso_apoderado_enviado: true,
          mediacion_id: mediacionId,
          mediaciones: {
            id: mediacionId,
            folio: 'MED-2026-0001',
            tipo_origen: 'preventiva_convivencia',
            estado: 'acordada',
            motivo: 'Diferencias en patio',
            fecha_programada: '2026-10-18T10:00:00.000Z',
            lugar_sesion: 'Sala Convivencia',
            fecha_seguimiento: '2026-10-25',
            conclusiones_cierre: 'Acuerdo formativo alcanzado',
            cerrada_at: '2026-10-18T11:00:00.000Z',
            usuarios: { id: 'prof-1', nombre: 'Constanza', apellido: 'Valenzuela' },
            mediacion_compromisos: [
              {
                id: compromisoId1,
                estudiante_id: estudianteId,
                tipo_compromiso: 'reparacion_relacional',
                descripcion: 'Disculpa sincera',
                fecha_limite: '2026-10-22',
                estado: 'cumplido',
                cumplido: true,
              },
            ],
          },
        },
      ]

      supabase.from.mockImplementation((table) => {
        if (table === 'estudiantes') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockEstudiante, error: null }),
          }
        }
        if (table === 'mediacion_participantes') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            then: (resolve) => resolve({ data: mockParticipaciones, error: null }),
          }
        }
        return {}
      })

      const resultado = await mediacionesService.obtenerHistorialMediacionesEstudiante(
        tenantId,
        estudianteId
      )

      expect(resultado).toBeDefined()
      expect(resultado.estudiante.rut).toBe('22.333.444-5')
      expect(resultado.estudiante.curso).toBe('7° Básico A')
      expect(resultado.metricas.total_mediaciones).toBe(1)
      expect(resultado.metricas.acordadas).toBe(1)
      expect(resultado.metricas.total_compromisos).toBe(1)
      expect(resultado.metricas.compromisos_cumplidos).toBe(1)
      expect(resultado.metricas.tasa_cumplimiento).toBe(100)
      expect(resultado.mediaciones).toHaveLength(1)
      expect(resultado.mediaciones[0].folio).toBe('MED-2026-0001')
      expect(resultado.mediaciones[0].rol_participante).toBe('parte_1')
    })

    it('debe retornar 404 si el estudiante no existe en el establecimiento', async () => {
      supabase.from.mockImplementation((table) => {
        if (table === 'estudiantes') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          }
        }
        return {}
      })

      await expect(
        mediacionesService.obtenerHistorialMediacionesEstudiante(tenantId, 'uuid-fantasma')
      ).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringContaining('Estudiante no encontrado'),
      })
    })
  })

  describe('Controladores Express: mediacionesController', () => {
    it('evaluarCompromisosHandler debe responder 200 con el resultado', async () => {
      const mockResultado = { mediacion_id: mediacionId, total_evaluados: 1 }
      const req = {
        user: { tenant_id: tenantId, user_id: usuarioId },
        params: { id: mediacionId },
        body: { evaluaciones: [{ compromiso_id: compromisoId1, estado: 'cumplido' }] },
      }
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      }
      const next = jest.fn()

      const spy = jest
        .spyOn(mediacionesService, 'evaluarCompromisos')
        .mockResolvedValue(mockResultado)

      await evaluarCompromisosHandler(req, res, next)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        message: 'Compromisos formativos evaluados exitosamente',
        data: mockResultado,
      })
      expect(next).not.toHaveBeenCalled()
      spy.mockRestore()
    })

    it('cerrarMediacionHandler debe responder 200 con el resultado del cierre', async () => {
      const mockResultado = { mediacion_id: mediacionId, estado_final: 'acordada' }
      const req = {
        user: { tenant_id: tenantId, user_id: usuarioId },
        params: { id: mediacionId },
        body: { estado: 'acordada', conclusiones_cierre: 'Acuerdo total' },
      }
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      }
      const next = jest.fn()

      const spy = jest
        .spyOn(mediacionesService, 'cerrarMediacion')
        .mockResolvedValue(mockResultado)

      await cerrarMediacionHandler(req, res, next)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        message: 'Expediente de mediación cerrado y sellado inmutablemente',
        data: mockResultado,
      })
      expect(next).not.toHaveBeenCalled()
      spy.mockRestore()
    })

    it('historialEstudianteHandler debe responder 200 con los datos del alumno', async () => {
      const mockHistorial = {
        estudiante: { nombre: 'Mateo' },
        metricas: { total_mediaciones: 1 },
      }
      const req = {
        user: { tenant_id: tenantId },
        params: { estudianteId },
      }
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      }
      const next = jest.fn()

      const spy = jest
        .spyOn(mediacionesService, 'obtenerHistorialMediacionesEstudiante')
        .mockResolvedValue(mockHistorial)

      await historialEstudianteHandler(req, res, next)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: mockHistorial,
      })
      expect(next).not.toHaveBeenCalled()
      spy.mockRestore()
    })

    it('los handlers deben delegar a next(err) en caso de excepción', async () => {
      const req = {
        user: { tenant_id: tenantId, user_id: usuarioId },
        params: { id: mediacionId },
        body: {},
      }
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      }
      const next = jest.fn()
      const mockError = new Error('Fallo simulado')

      const spy = jest
        .spyOn(mediacionesService, 'evaluarCompromisos')
        .mockRejectedValue(mockError)

      await evaluarCompromisosHandler(req, res, next)

      expect(next).toHaveBeenCalledWith(mockError)
      spy.mockRestore()
    })
  })
})
