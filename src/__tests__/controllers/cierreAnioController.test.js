const cierreAnioController = require('../../controllers/cierreAnioController')
const cierreAnioService = require('../../services/cierreAnioService')

jest.mock('../../services/cierreAnioService')
jest.mock('../../utils/logger')

describe('cierreAnioController', () => {
  let req, res, next
  const mockTenantId = 'tenant-uuid-123'
  const mockUserId = 'user-uuid-456'

  beforeEach(() => {
    req = {
      user: {
        id: mockUserId,
        tenant_id: mockTenantId,
        rol: 'Administrador',
      },
      body: {},
      query: {},
      params: {},
    }
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }
    next = jest.fn()
    jest.clearAllMocks()
  })

  describe('GET /api/v1/cierre-anio/estado-actual', () => {
    it('debe retornar 200 con el estado del período activo y cursos', async () => {
      const mockData = {
        periodo_activo: { id: 'per-1', anio: 2026, activo: true },
        total_estudiantes_activos: 180,
        cursos: [{ id: 'cur-1', nombre: '1° Básico A', nivel: '1° Básico' }],
        docentes_disponibles: [{ id: 'doc-1', nombre: 'Juan', apellido: 'Pérez' }],
      }
      cierreAnioService.obtenerEstadoActual.mockResolvedValue(mockData)

      await cierreAnioController.obtenerEstadoActualHandler(req, res, next)

      expect(cierreAnioService.obtenerEstadoActual).toHaveBeenCalledWith(mockTenantId)
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: mockData,
      })
      expect(next).not.toHaveBeenCalled()
    })

    it('debe propagar el error con next() si el servicio falla', async () => {
      const error = new Error('Database connection failed')
      cierreAnioService.obtenerEstadoActual.mockRejectedValue(error)

      await cierreAnioController.obtenerEstadoActualHandler(req, res, next)

      expect(next).toHaveBeenCalledWith(error)
      expect(res.status).not.toHaveBeenCalled()
    })
  })

  describe('GET /api/v1/cierre-anio/propuesta', () => {
    it('debe retornar 200 con la matriz de propuesta automática', async () => {
      const mockPropuesta = {
        periodo_actual: { anio: 2026 },
        nuevo_anio_sugerido: 2027,
        cursos_proyectados: [
          { nombre: '1° Básico A', nivel: '1° Básico', letra: 'A', profesor_jefe_id: 'doc-1' },
          { nombre: '8° Básico A', nivel: '8° Básico', letra: 'A', profesor_jefe_id: 'doc-2' },
        ],
        alumnos_propuesta: [
          {
            estudiante_id: 'est-1',
            nombre: 'Carlos',
            curso_anterior_nombre: '7° Básico A',
            estado_propuesto: 'Promovido',
            nuevo_curso_nombre_sugerido: '8° Básico A',
          },
          {
            estudiante_id: 'est-2',
            nombre: 'Ana',
            curso_anterior_nombre: '8° Básico A',
            estado_propuesto: 'Egresado',
            nuevo_curso_nombre_sugerido: null,
            es_egresado_automatico: true,
          },
        ],
        resumen: { total_estudiantes: 2, promovidos_propuestos: 1, egresados_propuestos: 1 },
      }
      cierreAnioService.generarPropuestaPromocion.mockResolvedValue(mockPropuesta)

      await cierreAnioController.generarPropuestaHandler(req, res, next)

      expect(cierreAnioService.generarPropuestaPromocion).toHaveBeenCalledWith(
        mockTenantId,
        { tipo_establecimiento: undefined }
      )
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: mockPropuesta,
      })
    })

    it('debe invocar next() en caso de error en la propuesta', async () => {
      const err = new Error('Error de cálculo')
      cierreAnioService.generarPropuestaPromocion.mockRejectedValue(err)

      await cierreAnioController.generarPropuestaHandler(req, res, next)

      expect(next).toHaveBeenCalledWith(err)
    })
  })

  describe('POST /api/v1/cierre-anio/ejecutar', () => {
    it('debe ejecutar exitosamente la promoción transaccional y retornar 200', async () => {
      req.body = {
        periodo_anterior_id: 'per-anterior-uuid',
        nuevo_anio: 2027,
        fecha_inicio: '2027-03-01',
        fecha_fin: '2027-12-31',
        cursos_config: [
          { nombre: '1° Básico A', nivel: '1° Básico', letra: 'A', profesor_jefe_id: null },
        ],
        promociones: [
          {
            estudiante_id: '11111111-1111-1111-1111-111111111111',
            curso_anterior_id: 'cur-ant-uuid',
            estado_final: 'Promovido',
            nuevo_curso_nombre: '1° Básico A',
          },
        ],
      }

      const mockRespuestaRPC = {
        success: true,
        nuevo_periodo_id: 'nuevo-per-uuid',
        nuevo_anio: 2027,
        total_promovidos: 1,
        total_repitentes: 0,
        total_egresados: 0,
        total_retirados: 0,
      }
      cierreAnioService.ejecutarCierreYPromocion.mockResolvedValue(mockRespuestaRPC)

      await cierreAnioController.ejecutarCierreHandler(req, res, next)

      expect(cierreAnioService.ejecutarCierreYPromocion).toHaveBeenCalledWith(
        mockTenantId,
        mockUserId,
        req.body
      )
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        message: 'Cierre de año lectivo y promoción de cursos ejecutado exitosamente',
        data: mockRespuestaRPC,
      })
    })

    it('debe propagar error si la ejecución transaccional falla', async () => {
      const dbError = new Error('Fallo de transacción RPC')
      cierreAnioService.ejecutarCierreYPromocion.mockRejectedValue(dbError)

      await cierreAnioController.ejecutarCierreHandler(req, res, next)

      expect(next).toHaveBeenCalledWith(dbError)
    })
  })
})

describe('cierreAnioService - Secuencia y Progresión Escolar Chilena', () => {
  const { obtenerSiguienteNivel, SECUENCIA_NIVELES } = jest.requireActual(
    '../../services/cierreAnioService'
  )

  it('debe incluir la secuencia oficial desde Pre-Kínder hasta 4° Medio', () => {
    expect(SECUENCIA_NIVELES).toEqual([
      'Pre-Kínder',
      'Kínder',
      '1° Básico',
      '2° Básico',
      '3° Básico',
      '4° Básico',
      '5° Básico',
      '6° Básico',
      '7° Básico',
      '8° Básico',
      '1° Medio',
      '2° Medio',
      '3° Medio',
      '4° Medio',
    ])
  })

  it('debe promover correlativamente los niveles de enseñanza básica y media', () => {
    expect(obtenerSiguienteNivel('Pre-Kínder')).toBe('Kínder')
    expect(obtenerSiguienteNivel('Kínder')).toBe('1° Básico')
    expect(obtenerSiguienteNivel('1° Básico')).toBe('2° Básico')
    expect(obtenerSiguienteNivel('7° Básico')).toBe('8° Básico')
    expect(obtenerSiguienteNivel('8° Básico')).toBe('1° Medio')
    expect(obtenerSiguienteNivel('1° Medio')).toBe('2° Medio')
    expect(obtenerSiguienteNivel('3° Medio')).toBe('4° Medio')
  })

  it('debe retornar null (egresado) para alumnos de 4° Medio al finalizar ciclo', () => {
    expect(obtenerSiguienteNivel('4° Medio')).toBeNull()
  })
})
