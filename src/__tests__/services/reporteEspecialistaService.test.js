const reporteEspecialistaService = require('../../services/reporteEspecialistaService')
const auditoriaService = require('../../services/auditoriaService')
const { supabase } = require('../../utils/db')
const { obtenerExpedienteSaludHandler } = require('../../controllers/reporteEspecialistaController')

// Mockear dependencias externas
jest.mock('../../utils/db', () => ({
  supabase: {
    from: jest.fn(),
  },
}))

jest.mock('../../services/auditoriaService', () => ({
  registrarAuditoria: jest.fn().mockResolvedValue(true),
}))

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}))

describe('TASK 8.2.1.1 — Extractor y Sanitizador de Expediente para Especialista de Salud', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001'
  const estudianteFocoId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  const usuarioPsicosocialId = 'uuuuuuuu-uuuu-4uuu-8uuu-uuuuuuuuuuuu'

  const mockUsuarioSolicitante = {
    id: usuarioPsicosocialId,
    nombre: 'Constanza',
    apellido: 'Valenzuela',
    rol: 'Equipo de Formación',
  }

  // Estudiante Foco (paciente que será evaluado por especialista externo de salud)
  const mockEstudianteFoco = {
    id: estudianteFocoId,
    rut: '21.456.789-0',
    nombre: 'Martín',
    apellido: 'Gómez',
    fecha_nacimiento: '2012-05-14',
    genero: 'M',
    curso_id: 'curso-uuid-1',
    estado_matricula: 'activo',
    cursos: {
      id: 'curso-uuid-1',
      nombre: '7° Básico A',
      nivel: '7° Básico',
      letra: 'A',
      anio_academico: 2026,
    },
  }

  // Compañeros de curso y terceros
  const companero1 = { id: 'c1111111-1111-4111-8111-111111111111', nombre: 'Juan Carlos', apellido: 'Pérez González' }
  const companero2 = { id: 'c2222222-2222-4222-8222-222222222222', nombre: 'Camila', apellido: 'Soto' }
  const companero3 = { id: 'c3333333-3333-4333-8333-333333333333', nombre: 'Diego', apellido: 'Fernández' }

  const mockCompaneros = [
    mockEstudianteFoco,
    companero1,
    companero2,
    companero3,
  ]

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Criterio 1: Motor Regex de Sanitización y Anonimización por Iniciales Genéricas', () => {
    it('convertirAIniciales debe formatear nombres completos a iniciales con punto', () => {
      expect(reporteEspecialistaService.convertirAIniciales('Juan Carlos Pérez González')).toBe('J. C. P. G.')
      expect(reporteEspecialistaService.convertirAIniciales('Camila Soto')).toBe('C. S.')
      expect(reporteEspecialistaService.convertirAIniciales('Diego')).toBe('D.')
      expect(reporteEspecialistaService.convertirAIniciales('')).toBe('N. N.')
      expect(reporteEspecialistaService.convertirAIniciales(null)).toBe('N. N.')
    })

    it('anonimizarRelatoConIniciales debe reemplazar nombres completos e individuales de terceros por iniciales genéricas', () => {
      const relatoOriginal =
        'Durante el recreo, Juan Carlos Pérez González empujó a Martín Gómez. Luego Camila Soto intentó intervenir, pero Diego Fernández se interpuso.'

      const relatoSanitizado = reporteEspecialistaService.anonimizarRelatoConIniciales(
        relatoOriginal,
        mockCompaneros,
        mockEstudianteFoco
      )

      // Los terceros deben haber sido convertidos en iniciales
      expect(relatoSanitizado).toContain('J. C. P. G.')
      expect(relatoSanitizado).toContain('C. S.')
      expect(relatoSanitizado).toContain('D. F.')

      // La identidad del estudiante evaluado (foco) debe mantenerse intacta
      expect(relatoSanitizado).toContain('Martín Gómez')

      // No deben figurar los nombres reales de los terceros
      expect(relatoSanitizado).not.toContain('Juan Carlos')
      expect(relatoSanitizado).not.toContain('Camila Soto')
      expect(relatoSanitizado).not.toContain('Diego Fernández')
    })

    it('anonimizarRelatoConIniciales debe anonimizar nombres de pila aislados de compañeros sin alterar el nombre del foco', () => {
      const relatoOriginal =
        'Martín conversó con Camila en la sala. Diego le gritó desde el pasillo.'

      const relatoSanitizado = reporteEspecialistaService.anonimizarRelatoConIniciales(
        relatoOriginal,
        mockCompaneros,
        mockEstudianteFoco
      )

      expect(relatoSanitizado).toContain('Martín')
      expect(relatoSanitizado).toContain('C.')
      expect(relatoSanitizado).toContain('D.')
      expect(relatoSanitizado).not.toContain('Camila')
      expect(relatoSanitizado).not.toContain('Diego')
    })

    it('debe censurar datos PII de terceros (RUTs, teléfonos, emails) preservando el RUT del foco si aparece', () => {
      const relatoConPII =
        'Se cita al apoderado de Juan (RUT 18.234.567-8, fono +56987654321, mail juan@correo.cl). El estudiante Martín Gómez (RUT 21.456.789-0) presenta su testimonio.'

      const relatoSanitizado = reporteEspecialistaService.anonimizarRelatoConIniciales(
        relatoConPII,
        mockCompaneros,
        mockEstudianteFoco
      )

      // RUT de tercero censurado
      expect(relatoSanitizado).toContain('[RUT_RESERVADO]')
      expect(relatoSanitizado).not.toContain('18.234.567-8')

      // Teléfono y email censurados
      expect(relatoSanitizado).toContain('[TEL_RESERVADO]')
      expect(relatoSanitizado).toContain('[EMAIL_RESERVADO]')
      expect(relatoSanitizado).not.toContain('+56987654321')
      expect(relatoSanitizado).not.toContain('juan@correo.cl')

      // RUT del estudiante foco preservado para la ficha clínica
      expect(relatoSanitizado).toContain('21.456.789-0')
    })
  })

  describe('Criterio 1 y 3: Extracción Integral y Auditoría en auditoria_logs', () => {
    const mockIncidente = {
      id: 'inc-100',
      folio: 'INC-2026-0045',
      fecha: '2026-03-20',
      gravedad: 'Grave',
      tipo_incidente: 'Conflicto entre pares',
      descripcion: 'Juan Carlos Pérez González empujó a Martín Gómez en la multicancha.',
      medidas_tomadas: 'Citación a apoderado de Juan Carlos Pérez González y entrevista con Martín Gómez.',
      acuerdos: 'Camila Soto y Diego Fernández actuarán como acompañantes formativos de convivencia.',
      estado: 'cerrado',
      tenant_id: tenantId,
    }

    const mockMediacion = {
      id: 'med-200',
      folio: 'MED-2026-0012',
      fecha_programada: '2026-03-25T10:00:00.000Z',
      fecha_acuerdo: '2026-03-25T11:00:00.000Z',
      estado: 'cerrada',
      motivo: 'Diferencias reiteradas entre Martín Gómez y Juan Carlos Pérez González.',
      conclusiones_cierre: 'Ambos estudiantes acordaron respetarse. Camila Soto atestiguó el cumplimiento.',
      tenant_id: tenantId,
    }

    const configurarMockSupabase = () => {
      supabase.from.mockImplementation((tabla) => {
        switch (tabla) {
          case 'estudiantes':
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockImplementation((campo, valor) => {
                  if (campo === 'id') {
                    return {
                      eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                          data: mockEstudianteFoco,
                          error: null,
                        }),
                      }),
                    }
                  }
                  // Si consulta por curso_id
                  return {
                    eq: jest.fn().mockResolvedValue({
                      data: mockCompaneros,
                      error: null,
                    }),
                  }
                }),
              }),
            }

          case 'incidente_estudiantes':
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockResolvedValue({
                    data: [
                      {
                        incidente_id: mockIncidente.id,
                        estudiante_id: estudianteFocoId,
                        es_victima: true,
                        rol: 'Afectado',
                        observacion: 'Martín relata que Juan Carlos Pérez González lo molestó.',
                        incidentes: mockIncidente,
                      },
                    ],
                    error: null,
                  }),
                }),
                in: jest.fn().mockResolvedValue({
                  data: [
                    {
                      incidente_id: mockIncidente.id,
                      estudiante_id: companero1.id,
                      rol: 'Involucrado',
                      estudiantes: companero1,
                    },
                  ],
                  error: null,
                }),
              }),
            }

          case 'mediacion_participantes':
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockResolvedValue({
                    data: [
                      {
                        mediacion_id: mockMediacion.id,
                        estudiante_id: estudianteFocoId,
                        rol_participante: 'parte_1',
                        mediaciones: mockMediacion,
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }

          case 'derivaciones':
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockResolvedValue({
                    data: [
                      {
                        id: 'der-1',
                        tipo: 'Psicológica',
                        prioridad: 'Alta',
                        motivo: 'Evaluación de déficit atencional y dinámica con Juan Carlos Pérez González.',
                        created_at: '2026-03-26T09:00:00.000Z',
                        estado: 'activa',
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }

          default:
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }
        }
      })
    }

    it('debe extraer el expediente completo con relatos 100% sanitizados y terceros con iniciales', async () => {
      configurarMockSupabase()

      const resultado = await reporteEspecialistaService.extraerExpedienteEspecialistaSalud(
        tenantId,
        estudianteFocoId,
        mockUsuarioSolicitante,
        {
          especialistaDestino: 'Neurólogo Infantil - CESFAM El Salvador',
          motivo: 'Informe de apoyo para evaluación diagnóstica',
        }
      )

      expect(resultado).toHaveProperty('estudiante_evaluado')
      expect(resultado.estudiante_evaluado.nombre_completo).toBe('Martín Gómez')
      expect(resultado.estudiante_evaluado.rut).toBe('21.456.789-0')

      // Verificar sanitización de incidentes
      expect(resultado.incidentes).toHaveLength(1)
      const incSanitizado = resultado.incidentes[0]
      expect(incSanitizado.descripcion_sanitizada).toContain('J. C. P. G.')
      expect(incSanitizado.descripcion_sanitizada).toContain('Martín Gómez')
      expect(incSanitizado.medidas_tomadas_sanitizadas).toContain('J. C. P. G.')
      expect(incSanitizado.acuerdos_sanitizados).toContain('C. S.')
      expect(incSanitizado.acuerdos_sanitizados).toContain('D. F.')
      expect(incSanitizado.observacion_individual_sanitizada).toContain('J. C. P. G.')

      // Verificar que otros involucrados figuren con iniciales genéricas
      expect(incSanitizado.otros_involucrados_anonimizados).toHaveLength(1)
      expect(incSanitizado.otros_involucrados_anonimizados[0].iniciales).toBe('J. C. P. G.')

      // Verificar sanitización de mediaciones
      expect(resultado.mediaciones).toHaveLength(1)
      const medSanitizada = resultado.mediaciones[0]
      expect(medSanitizada.motivo_sanitizado).toContain('J. C. P. G.')
      expect(medSanitizada.conclusiones_sanitizadas).toContain('C. S.')

      // Verificar sanitización de derivaciones previas
      expect(resultado.derivaciones_anteriores).toHaveLength(1)
      expect(resultado.derivaciones_anteriores[0].motivo_sanitizado).toContain('J. C. P. G.')
    })

    it('Criterio 3: debe registrar el evento inmutablemente en auditoriaService.registrarAuditoria', async () => {
      configurarMockSupabase()

      await reporteEspecialistaService.extraerExpedienteEspecialistaSalud(
        tenantId,
        estudianteFocoId,
        mockUsuarioSolicitante,
        {
          especialistaDestino: 'Psiquiatra Infantil',
          motivo: 'Evaluación integral de salud mental',
          ip: '192.168.1.50',
        }
      )

      expect(auditoriaService.registrarAuditoria).toHaveBeenCalledTimes(1)
      expect(auditoriaService.registrarAuditoria).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          userId: usuarioPsicosocialId,
          accion: 'GENERAR_REPORTE_ESPECIALISTA',
          tabla: 'estudiantes',
          registroId: estudianteFocoId,
          datosAfter: expect.objectContaining({
            estudiante_id: estudianteFocoId,
            estudiante_nombre: 'Martín Gómez',
            especialista_destino: 'Psiquiatra Infantil',
            total_incidentes_sanitizados: 1,
            total_mediaciones_sanitizadas: 1,
            total_derivaciones_sanitizadas: 1,
          }),
        })
      )
    })

    it('debe arrojar 404 si el estudiante no existe en el establecimiento', async () => {
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
            }),
          }),
        }),
      })

      await expect(
        reporteEspecialistaService.extraerExpedienteEspecialistaSalud(
          tenantId,
          'non-existent-id',
          mockUsuarioSolicitante
        )
      ).rejects.toMatchObject({
        message: 'Estudiante no encontrado en el establecimiento',
        statusCode: 404,
      })
    })

    it('debe arrojar 400 si estudianteId no es proporcionado', async () => {
      await expect(
        reporteEspecialistaService.extraerExpedienteEspecialistaSalud(
          tenantId,
          null,
          mockUsuarioSolicitante
        )
      ).rejects.toMatchObject({
        message: 'estudianteId es requerido',
        statusCode: 400,
      })
    })
  })

  describe('Criterio 2: Controlador y Restricción de Autorización', () => {
    it('obtenerExpedienteSaludHandler debe responder HTTP 200 con el payload sanitizado', async () => {
      jest.spyOn(reporteEspecialistaService, 'extraerExpedienteEspecialistaSalud').mockResolvedValueOnce({
        estudiante_evaluado: { id: estudianteFocoId, nombre: 'Martín Gómez' },
        incidentes: [],
        mediaciones: [],
      })

      const req = {
        user: { tenant_id: tenantId, id: usuarioPsicosocialId, rol: 'Equipo de Formación' },
        params: { id: estudianteFocoId },
        query: { especialista: 'Neurólogo', motivo: 'Diagnóstico' },
      }
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      }
      const next = jest.fn()

      await obtenerExpedienteSaludHandler(req, res, next)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          message: expect.any(String),
          data: expect.any(Object),
        })
      )
      expect(next).not.toHaveBeenCalled()
    })

    it('obtenerExpedienteSaludHandler debe delegar excepciones a next(err)', async () => {
      const errorForzado = new Error('Database timeout')
      jest.spyOn(reporteEspecialistaService, 'extraerExpedienteEspecialistaSalud').mockRejectedValueOnce(errorForzado)

      const req = {
        user: { tenant_id: tenantId, id: usuarioPsicosocialId },
        params: { id: estudianteFocoId },
        query: {},
      }
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      }
      const next = jest.fn()

      await obtenerExpedienteSaludHandler(req, res, next)

      expect(next).toHaveBeenCalledWith(errorForzado)
    })

    describe('Restricción RBAC Estricta para Roles Directivos y Psicosociales', () => {
      const requireRole = require('../../middlewares/requireRole')
      const rolesAutorizados = ['Administrador', 'Directivo', 'Equipo de Formación']

      it('debe autorizar a Administrador, Directivo y Equipo de Formación', () => {
        const middleware = requireRole(...rolesAutorizados)

        rolesAutorizados.forEach((rol) => {
          const req = { user: { id: 'usr-1', rol } }
          const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }
          const next = jest.fn()

          middleware(req, res, next)

          expect(next).toHaveBeenCalled()
          expect(res.status).not.toHaveBeenCalled()
        })
      })

      it('debe rechazar con HTTP 403 Forbidden a roles no autorizados (Docente, Inspector, Apoderado)', () => {
        const middleware = requireRole(...rolesAutorizados)
        const rolesDenegados = ['Docente', 'Inspector', 'Apoderado', 'Estudiante']

        rolesDenegados.forEach((rol) => {
          const req = { user: { id: 'usr-2', rol } }
          const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }
          const next = jest.fn()

          middleware(req, res, next)

          expect(res.status).toHaveBeenCalledWith(403)
          expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
              statusCode: 403,
              message: 'No tienes permisos para realizar esta acción.',
            })
          )
          expect(next).not.toHaveBeenCalled()
        })
      })
    })
  })
})
