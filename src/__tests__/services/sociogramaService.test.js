const sociogramaService = require('../../services/sociogramaService')
const { supabase } = require('../../utils/db')
const { obtenerSociogramaCursoHandler } = require('../../controllers/sociogramaController')

// Mockear dependencias externas
jest.mock('../../utils/db', () => ({
  supabase: {
    from: jest.fn(),
  },
}))

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}))

describe('TASK 8.1.1.1 — Algoritmo de Co-ocurrencias y Matriz de Adyacencia Ponderada', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001'
  const cursoId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

  const mockCurso = {
    id: cursoId,
    nombre: '8° Básico A',
    nivel: '8° Básico',
    letra: 'A',
    anio_academico: 2026,
  }

  // Estudiantes del curso
  const est1 = {
    id: '11111111-1111-4111-8111-111111111111',
    rut: '11.111.111-1',
    nombre: 'Juan',
    apellido: 'Álvarez',
    avatar_url: null,
    genero: 'M',
    estado_matricula: 'activo',
  }
  const est2 = {
    id: '22222222-2222-4222-8222-222222222222',
    rut: '22.222.222-2',
    nombre: 'Beatriz',
    apellido: 'Bravo',
    avatar_url: null,
    genero: 'F',
    estado_matricula: 'activo',
  }
  const est3 = {
    id: '33333333-3333-4333-8333-333333333333',
    rut: '33.333.333-3',
    nombre: 'Carlos',
    apellido: 'Carrasco',
    avatar_url: null,
    genero: 'M',
    estado_matricula: 'activo',
  }
  const est4Aislado = {
    id: '44444444-4444-4444-8444-444444444444',
    rut: '44.444.444-4',
    nombre: 'Diana',
    apellido: 'Díaz',
    avatar_url: null,
    genero: 'F',
    estado_matricula: 'activo',
  }

  const mockEstudiantes = [est1, est2, est3, est4Aislado]

  beforeEach(() => {
    jest.clearAllMocks()
  })

  // Helper para simular respuestas fluidas de Supabase
  const configurarMockSupabase = ({
    curso = mockCurso,
    cursoError = null,
    estudiantes = mockEstudiantes,
    estudiantesError = null,
    incidentes = [],
    incidenteEstudiantes = [],
    mediaciones = [],
    mediacionParticipantes = [],
  } = {}) => {
    const incidentesMap = new Map(incidentes.map((inc) => [inc.id, inc]))
    const incEstEnriquecidos = incidenteEstudiantes.map((ie) => ({
      ...ie,
      incidentes: ie.incidentes || incidentesMap.get(ie.incidente_id) || { id: ie.incidente_id, gravedad: 'Leve' },
    }))

    const mediacionesMap = new Map(mediaciones.map((m) => [m.id, m]))
    const medPartEnriquecidos = mediacionParticipantes.map((mp) => ({
      ...mp,
      mediaciones: mp.mediaciones || mediacionesMap.get(mp.mediacion_id) || { id: mp.mediacion_id, estado: 'acordada' },
    }))

    supabase.from.mockImplementation((tabla) => {
      switch (tabla) {
        case 'cursos':
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: curso,
                    error: cursoError,
                  }),
                }),
              }),
            }),
          }

        case 'estudiantes':
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: estudiantes,
                    error: estudiantesError,
                  }),
                }),
              }),
            }),
          }

        case 'incidentes':
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: incidentes,
                    error: null,
                  }),
                }),
              }),
            }),
          }

        case 'incidente_estudiantes':
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                in: jest.fn().mockResolvedValue({
                  data: incEstEnriquecidos,
                  error: null,
                }),
              }),
            }),
          }

        case 'mediaciones':
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                in: jest.fn().mockResolvedValue({
                  data: mediaciones,
                  error: null,
                }),
              }),
            }),
          }

        case 'mediacion_participantes':
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                in: jest.fn().mockResolvedValue({
                  data: medPartEnriquecidos,
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

  describe('Criterio 1: Desempeño y Estructura del Payload { nodes, links, metricas }', () => {
    it('debe responder en < 200 ms y contener el payload { nodes, links, metricas, matriz_adyacencia, curso }', async () => {
      configurarMockSupabase({
        curso: mockCurso,
        estudiantes: mockEstudiantes,
        incidentes: [],
        incidenteEstudiantes: [],
        mediaciones: [],
        mediacionParticipantes: [],
      })

      const resultado = await sociogramaService.obtenerSociogramaPorCurso(tenantId, cursoId)

      expect(resultado).toHaveProperty('curso')
      expect(resultado).toHaveProperty('nodes')
      expect(resultado).toHaveProperty('links')
      expect(resultado).toHaveProperty('metricas')
      expect(resultado).toHaveProperty('matriz_adyacencia')

      // Verificar que el tiempo de ejecución reportado es < 200 ms
      expect(resultado.metricas.tiempo_ejecucion_ms).toBeLessThan(200)
      expect(resultado.nodes).toHaveLength(4)
      expect(resultado.metricas.total_estudiantes).toBe(4)
      expect(resultado.metricas.estudiantes_aislados).toBe(4) // Sin incidentes, todos aislados
    })

    it('debe manejar adecuadamente un curso sin estudiantes retornando grafo vacío en < 200ms', async () => {
      configurarMockSupabase({
        curso: mockCurso,
        estudiantes: [],
      })

      const resultado = await sociogramaService.obtenerSociogramaPorCurso(tenantId, cursoId)

      expect(resultado.nodes).toEqual([])
      expect(resultado.links).toEqual([])
      expect(resultado.matriz_adyacencia).toEqual([])
      expect(resultado.metricas.total_estudiantes).toBe(0)
      expect(resultado.metricas.tiempo_ejecucion_ms).toBeLessThan(200)
    })
  })

  describe('Criterio 2: Ponderación de Pesos Matemática por Gravedad y Mediación', () => {
    it('debe respetar los pesos canónicos: Leve (+1), Grave (+3), Gravísimo (+5), Mediación (-2)', () => {
      expect(sociogramaService.PONDERACION_PESOS.LEVE).toBe(1)
      expect(sociogramaService.PONDERACION_PESOS.GRAVE).toBe(3)
      expect(sociogramaService.PONDERACION_PESOS.GRAVISIMO).toBe(5)
      expect(sociogramaService.PONDERACION_PESOS.MEDIACION).toBe(-2)
    })

    it('obtenerPesoPorGravedad debe normalizar variaciones de texto correctamente', () => {
      expect(sociogramaService.obtenerPesoPorGravedad('Leve')).toBe(1)
      expect(sociogramaService.obtenerPesoPorGravedad('leve')).toBe(1)
      expect(sociogramaService.obtenerPesoPorGravedad('Grave')).toBe(3)
      expect(sociogramaService.obtenerPesoPorGravedad('grave')).toBe(3)
      expect(sociogramaService.obtenerPesoPorGravedad('Gravísima')).toBe(5)
      expect(sociogramaService.obtenerPesoPorGravedad('Gravísimo')).toBe(5)
      expect(sociogramaService.obtenerPesoPorGravedad('gravisimo')).toBe(5)
      expect(sociogramaService.obtenerPesoPorGravedad(null)).toBe(1) // Por defecto leve
    })

    it('debe calcular peso = 4 para un par con 1 incidente Leve (+1) y 1 Grave (+3)', async () => {
      const inc1 = { id: 'inc-1', folio: 'INC-001', gravedad: 'Leve', fecha_incidente: '2026-03-01' }
      const inc2 = { id: 'inc-2', folio: 'INC-002', gravedad: 'Grave', fecha_incidente: '2026-03-05' }

      configurarMockSupabase({
        curso: mockCurso,
        estudiantes: [est1, est2],
        incidentes: [inc1, inc2],
        incidenteEstudiantes: [
          { incidente_id: 'inc-1', estudiante_id: est1.id, rol: 'involucrado' },
          { incidente_id: 'inc-1', estudiante_id: est2.id, rol: 'involucrado' },
          { incidente_id: 'inc-2', estudiante_id: est1.id, rol: 'involucrado' },
          { incidente_id: 'inc-2', estudiante_id: est2.id, rol: 'involucrado' },
        ],
        mediaciones: [],
        mediacionParticipantes: [],
      })

      const resultado = await sociogramaService.obtenerSociogramaPorCurso(tenantId, cursoId)

      expect(resultado.links).toHaveLength(1)
      const link = resultado.links[0]
      expect(link.weight).toBe(4) // 1 + 3
      expect(link.tipo_vinculo).toBe('conflicto_moderado')
      expect(link.co_ocurrencias_incidentes).toBe(2)
      expect(link.mediaciones_realizadas).toBe(0)
    })

    it('debe restar 2 puntos al peso acumulado cuando existe una mediación escolar entre el par', async () => {
      // 1 Incidente Gravísimo (+5) + 1 Mediación Escolar (-2) => Peso Neto = 3
      const incGrav = { id: 'inc-grav', folio: 'INC-GRAV', gravedad: 'Gravísimo', fecha_incidente: '2026-03-10' }
      const med1 = { id: 'med-1', folio: 'MED-001', estado: 'acordada', fecha_acuerdo: '2026-03-12' }

      configurarMockSupabase({
        curso: mockCurso,
        estudiantes: [est1, est2],
        incidentes: [incGrav],
        incidenteEstudiantes: [
          { incidente_id: 'inc-grav', estudiante_id: est1.id, rol: 'involucrado' },
          { incidente_id: 'inc-grav', estudiante_id: est2.id, rol: 'involucrado' },
        ],
        mediaciones: [med1],
        mediacionParticipantes: [
          { mediacion_id: 'med-1', estudiante_id: est1.id, rol_participante: 'parte_1' },
          { mediacion_id: 'med-1', estudiante_id: est2.id, rol_participante: 'parte_2' },
        ],
      })

      const resultado = await sociogramaService.obtenerSociogramaPorCurso(tenantId, cursoId)

      expect(resultado.links).toHaveLength(1)
      const link = resultado.links[0]
      expect(link.weight).toBe(3) // 5 - 2 = 3
      expect(link.tipo_vinculo).toBe('conflicto_moderado')
      expect(link.mediaciones_realizadas).toBe(1)
    })

    it('debe registrar vínculo como "acuerdo_restaurativo" si el peso neto es negativo', async () => {
      // 1 Incidente Leve (+1) + 1 Mediación (-2) => Peso Neto = -1
      const incLeve = { id: 'inc-leve', folio: 'INC-L1', gravedad: 'Leve', fecha_incidente: '2026-03-10' }
      const med1 = { id: 'med-1', folio: 'MED-001', estado: 'cerrada', fecha_acuerdo: '2026-03-15' }

      configurarMockSupabase({
        curso: mockCurso,
        estudiantes: [est1, est2],
        incidentes: [incLeve],
        incidenteEstudiantes: [
          { incidente_id: 'inc-leve', estudiante_id: est1.id, rol: 'involucrado' },
          { incidente_id: 'inc-leve', estudiante_id: est2.id, rol: 'involucrado' },
        ],
        mediaciones: [med1],
        mediacionParticipantes: [
          { mediacion_id: 'med-1', estudiante_id: est1.id, rol_participante: 'parte_1' },
          { mediacion_id: 'med-1', estudiante_id: est2.id, rol_participante: 'parte_2' },
        ],
      })

      const resultado = await sociogramaService.obtenerSociogramaPorCurso(tenantId, cursoId)

      expect(resultado.links).toHaveLength(1)
      const link = resultado.links[0]
      expect(link.weight).toBe(-1)
      expect(link.tipo_vinculo).toBe('acuerdo_restaurativo')
    })
  })

  describe('Criterio 3: Propiedades Matemáticas de la Matriz de Adyacencia A[N x N]', () => {
    it('la matriz de adyacencia debe ser estrictamente simétrica (A[i][j] === A[j][i]) y diagonal nula (A[i][i] === 0)', async () => {
      // Creamos incidentes cruzados entre est1 y est2, y entre est2 y est3
      const inc1 = { id: 'inc-1', folio: 'INC-1', gravedad: 'Grave', fecha_incidente: '2026-04-01' } // est1-est2 (peso 3)
      const inc2 = { id: 'inc-2', folio: 'INC-2', gravedad: 'Gravísimo', fecha_incidente: '2026-04-02' } // est2-est3 (peso 5)

      configurarMockSupabase({
        curso: mockCurso,
        estudiantes: mockEstudiantes, // 4 estudiantes
        incidentes: [inc1, inc2],
        incidenteEstudiantes: [
          { incidente_id: 'inc-1', estudiante_id: est1.id, rol: 'involucrado' },
          { incidente_id: 'inc-1', estudiante_id: est2.id, rol: 'involucrado' },
          { incidente_id: 'inc-2', estudiante_id: est2.id, rol: 'involucrado' },
          { incidente_id: 'inc-2', estudiante_id: est3.id, rol: 'involucrado' },
        ],
      })

      const resultado = await sociogramaService.obtenerSociogramaPorCurso(tenantId, cursoId)
      const A = resultado.matriz_adyacencia
      const n = mockEstudiantes.length

      expect(A).toHaveLength(n)

      for (let i = 0; i < n; i++) {
        // 1. Diagonal debe ser siempre 0
        expect(A[i][i]).toBe(0)

        for (let j = 0; j < n; j++) {
          // 2. Simetría estricta
          expect(A[i][j]).toBe(A[j][i])
        }
      }

      // Estudiante 4 (Diana Díaz) debe tener todas sus aristas en 0 (estudiante aislado)
      const idxDiana = resultado.nodes.findIndex((n) => n.id === est4Aislado.id)
      for (let j = 0; j < n; j++) {
        expect(A[idxDiana][j]).toBe(0)
      }

      const nodoDiana = resultado.nodes[idxDiana]
      expect(nodoDiana.grado_centralidad).toBe(0)
      expect(nodoDiana.conflictividad_total).toBe(0)
      expect(nodoDiana.estado_riesgo).toBe('nulo')
    })

    it('debe calcular métricas de red y topología: densidad, estudiantes en riesgo y pares críticos', async () => {
      const inc = { id: 'inc-critico', folio: 'INC-C', gravedad: 'Gravísimo', fecha_incidente: '2026-04-10' }

      configurarMockSupabase({
        curso: mockCurso,
        estudiantes: [est1, est2, est3],
        incidentes: [inc],
        incidenteEstudiantes: [
          { incidente_id: 'inc-critico', estudiante_id: est1.id, rol: 'involucrado' },
          { incidente_id: 'inc-critico', estudiante_id: est2.id, rol: 'involucrado' },
        ],
      })

      const resultado = await sociogramaService.obtenerSociogramaPorCurso(tenantId, cursoId)

      // 3 estudiantes -> 3 pares posibles: (est1-est2), (est1-est3), (est2-est3).
      // Solo 1 arista activa (est1-est2). Densidad = 1 / 3 = 0.3333
      expect(resultado.metricas.densidad_red).toBeCloseTo(0.3333, 3)
      expect(resultado.metricas.pares_criticos).toHaveLength(1)
      expect(resultado.metricas.pares_criticos[0].weight).toBe(5)
      expect(resultado.metricas.estudiantes_aislados).toBe(1) // est3 aislado
    })
  })

  describe('Casos Borde y Manejo de Errores', () => {
    it('debe rechazar con 400 si cursoId no es provisto', async () => {
      await expect(sociogramaService.obtenerSociogramaPorCurso(tenantId, null)).rejects.toMatchObject({
        message: 'cursoId es requerido',
        statusCode: 400,
      })
    })

    it('debe arrojar 404 si el curso no existe en el establecimiento (tenant)', async () => {
      configurarMockSupabase({
        curso: null,
        cursoError: { message: 'Row not found' },
      })

      await expect(sociogramaService.obtenerSociogramaPorCurso(tenantId, cursoId)).rejects.toMatchObject({
        message: 'Curso no encontrado en el establecimiento',
        statusCode: 404,
      })
    })

    it('debe arrojar 500 si falla la consulta de estudiantes', async () => {
      configurarMockSupabase({
        curso: mockCurso,
        estudiantes: null,
        estudiantesError: { message: 'DB connection error' },
      })

      await expect(sociogramaService.obtenerSociogramaPorCurso(tenantId, cursoId)).rejects.toMatchObject({
        message: 'Error al consultar nómina de estudiantes',
        statusCode: 500,
      })
    })
  })

  describe('Controlador Express: sociogramaController', () => {
    it('obtenerSociogramaCursoHandler debe responder HTTP 200 con { status, nodes, links, metricas }', async () => {
      configurarMockSupabase({
        curso: mockCurso,
        estudiantes: mockEstudiantes,
      })

      const req = {
        user: { tenant_id: tenantId },
        params: { cursoId },
      }
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      }
      const next = jest.fn()

      await obtenerSociogramaCursoHandler(req, res, next)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          nodes: expect.any(Array),
          links: expect.any(Array),
          metricas: expect.any(Object),
        })
      )
      expect(next).not.toHaveBeenCalled()
    })

    it('obtenerSociogramaCursoHandler debe delegar a next(err) en caso de excepción', async () => {
      const errorForzado = new Error('Database down')
      jest.spyOn(sociogramaService, 'obtenerSociogramaPorCurso').mockRejectedValueOnce(errorForzado)

      const req = {
        user: { tenant_id: tenantId },
        params: { cursoId },
      }
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      }
      const next = jest.fn()

      await obtenerSociogramaCursoHandler(req, res, next)

      expect(next).toHaveBeenCalledWith(errorForzado)
    })
  })

  describe('TASK 8.1.2.1 — Análisis de Redes (SNA): Centralidad de Grado, Agrupamiento y Cohesión Grupal', () => {
    describe('Criterio 1 y 3: Cálculo Matemático sobre Grafos Sintéticos Canónicos', () => {
      it('Grafo Completo K4 (4 nodos, 6 aristas): cada nodo conectado a los demás', () => {
        // En K4, cada nodo tiene grado 3, centralidad 100%, clustering 100%
        const matrizK4 = [
          [0, 1, 1, 1],
          [1, 0, 1, 1],
          [1, 1, 0, 1],
          [1, 1, 1, 0],
        ]

        const centralidad = sociogramaService.calcularCentralidadGrado(matrizK4, 4)
        expect(centralidad).toHaveLength(4)
        centralidad.forEach((c) => {
          expect(c.grado).toBe(3)
          expect(c.centralidad_grado_pct).toBe(100) // (3 / 3) * 100
        })

        const agrupamiento = sociogramaService.calcularCoeficienteAgrupamiento(matrizK4, 4)
        expect(agrupamiento.coeficientesLocales).toHaveLength(4)
        agrupamiento.coeficientesLocales.forEach((cl) => {
          expect(cl.clustering_local_pct).toBe(100)
          expect(cl.triangulos).toBe(3) // Entre los 3 vecinos hay 3 aristas
        })
        expect(agrupamiento.coeficienteAgrupamientoPromedioPct).toBe(100)
      })

      it('Grafo Estrella S5 (5 nodos, 4 aristas): nodo 0 central conectado a 4 hojas', () => {
        // Nodo 0: grado 4, centralidad 100%, vecinos sin aristas entre sí -> clustering 0%
        // Nodos 1..4: grado 1, centralidad 25%, k < 2 -> clustering 0%
        const matrizS5 = [
          [0, 1, 1, 1, 1],
          [1, 0, 0, 0, 0],
          [1, 0, 0, 0, 0],
          [1, 0, 0, 0, 0],
          [1, 0, 0, 0, 0],
        ]

        const centralidad = sociogramaService.calcularCentralidadGrado(matrizS5, 5)
        expect(centralidad[0].grado).toBe(4)
        expect(centralidad[0].centralidad_grado_pct).toBe(100) // 4 / 4 * 100

        for (let i = 1; i <= 4; i++) {
          expect(centralidad[i].grado).toBe(1)
          expect(centralidad[i].centralidad_grado_pct).toBe(25) // 1 / 4 * 100
        }

        const agrupamiento = sociogramaService.calcularCoeficienteAgrupamiento(matrizS5, 5)
        expect(agrupamiento.coeficienteAgrupamientoPromedioPct).toBe(0)
        agrupamiento.coeficientesLocales.forEach((cl) => {
          expect(cl.clustering_local_pct).toBe(0)
        })
      })

      it('Grafo Ciclo C4 (4 nodos, 4 aristas en anillo): 0-1, 1-2, 2-3, 3-0', () => {
        // Cada nodo tiene grado 2. Centralidad: 2/3 * 100 = 66.67%.
        // Los dos vecinos de cada nodo no se conectan entre sí -> clustering = 0%
        const matrizC4 = [
          [0, 1, 0, 1],
          [1, 0, 1, 0],
          [0, 1, 0, 1],
          [1, 0, 1, 0],
        ]

        const centralidad = sociogramaService.calcularCentralidadGrado(matrizC4, 4)
        centralidad.forEach((c) => {
          expect(c.grado).toBe(2)
          expect(c.centralidad_grado_pct).toBe(66.67)
        })

        const agrupamiento = sociogramaService.calcularCoeficienteAgrupamiento(matrizC4, 4)
        expect(agrupamiento.coeficienteAgrupamientoPromedioPct).toBe(0)
      })

      it('Grafo Triángulo con Hoja (4 nodos): 0-1, 1-2, 2-0 y nodo 3 conectado a 0', () => {
        // Nodo 0: vecinos {1, 2, 3}. Entre 1 y 2 hay arista (1 triángulo). C_0 = (2 * 1) / (3 * 2) = 1/3 ~ 33.33%
        // Nodos 1 y 2: vecinos {0, 2} y {0, 1}. Grado 2, arista entre vecinos = 1 -> C = 100%
        // Nodo 3: grado 1 -> C = 0%
        const matrizTrianguloHoja = [
          [0, 1, 1, 1],
          [1, 0, 1, 0],
          [1, 1, 0, 0],
          [1, 0, 0, 0],
        ]

        const agrupamiento = sociogramaService.calcularCoeficienteAgrupamiento(matrizTrianguloHoja, 4)
        expect(agrupamiento.coeficientesLocales[0].clustering_local_pct).toBe(33.33)
        expect(agrupamiento.coeficientesLocales[1].clustering_local_pct).toBe(100)
        expect(agrupamiento.coeficientesLocales[2].clustering_local_pct).toBe(100)
        expect(agrupamiento.coeficientesLocales[3].clustering_local_pct).toBe(0)

        // Promedio: (0.3333 + 1 + 1 + 0) / 4 = 2.3333 / 4 = 0.5833 (58.33%)
        expect(agrupamiento.coeficienteAgrupamientoPromedioPct).toBe(58.33)
      })

      it('Grafo Vacío (4 nodos, 0 aristas): sin interacciones', () => {
        const matrizVacia = [
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ]

        const centralidad = sociogramaService.calcularCentralidadGrado(matrizVacia, 4)
        centralidad.forEach((c) => {
          expect(c.grado).toBe(0)
          expect(c.centralidad_grado_pct).toBe(0)
        })

        const agrupamiento = sociogramaService.calcularCoeficienteAgrupamiento(matrizVacia, 4)
        expect(agrupamiento.coeficienteAgrupamientoPromedioPct).toBe(0)
      })
    })

    describe('Criterio 1: Indicadores Normalizados de 0 a 100 para Cohesión de Aula', () => {
      it('calcularIndiceCohesion debe retornar escala estricta [0, 100] y diagnóstico pedagógico', () => {
        // Caso 1: Curso ideal sin conflictos
        const casoIdeal = sociogramaService.calcularIndiceCohesion({
          n: 20,
          aisladosCount: 0,
          coeficienteAgrupamientoPromedioPct: 50,
          totalConflictividad: 0,
          mediacionesCount: 0,
        })
        expect(casoIdeal.indice_cohesion).toBe(100)
        expect(casoIdeal.diagnostico_clima).toBe('Cohesión positiva y clima colaborativo')

        // Caso 2: Curso con conflicto moderado y mediaciones formativas
        const casoModerado = sociogramaService.calcularIndiceCohesion({
          n: 20,
          aisladosCount: 2,
          coeficienteAgrupamientoPromedioPct: 30,
          totalConflictividad: 15,
          mediacionesCount: 2,
        })
        expect(casoModerado.indice_cohesion).toBeGreaterThanOrEqual(0)
        expect(casoModerado.indice_cohesion).toBeLessThanOrEqual(100)
        expect(typeof casoModerado.diagnostico_clima).toBe('string')

        // Caso 3: Curso en estado crítico de alta tensión
        const casoCritico = sociogramaService.calcularIndiceCohesion({
          n: 10,
          aisladosCount: 8,
          coeficienteAgrupamientoPromedioPct: 0,
          totalConflictividad: 80,
          mediacionesCount: 0,
        })
        expect(casoCritico.indice_cohesion).toBeLessThan(35)
      })

      it('obtenerSociogramaPorCurso debe incluir metricas de cohesion_aula, agrupamiento y centralidad normalizada', async () => {
        configurarMockSupabase({
          curso: mockCurso,
          estudiantes: mockEstudiantes,
        })

        const resultado = await sociogramaService.obtenerSociogramaPorCurso(tenantId, cursoId)

        expect(resultado.metricas).toHaveProperty('indice_cohesion')
        expect(resultado.metricas).toHaveProperty('coeficiente_agrupamiento_promedio')
        expect(resultado.metricas).toHaveProperty('densidad_red_pct')
        expect(resultado.metricas).toHaveProperty('diagnostico_clima')
        expect(resultado.metricas).toHaveProperty('tasa_integracion_pct')

        expect(resultado.metricas.indice_cohesion).toBeGreaterThanOrEqual(0)
        expect(resultado.metricas.indice_cohesion).toBeLessThanOrEqual(100)

        // Cada nodo debe tener sus indicadores normalizados
        resultado.nodes.forEach((nodo) => {
          expect(nodo).toHaveProperty('centralidad_grado_pct')
          expect(nodo).toHaveProperty('coeficiente_agrupamiento_pct')
          expect(nodo.centralidad_grado_pct).toBeGreaterThanOrEqual(0)
          expect(nodo.centralidad_grado_pct).toBeLessThanOrEqual(100)
          expect(nodo.coeficiente_agrupamiento_pct).toBeGreaterThanOrEqual(0)
          expect(nodo.coeficiente_agrupamiento_pct).toBeLessThanOrEqual(100)
        })
      })
    })

    describe('Criterio 2: Protección Ética — No Expone Datos Sensibles ni Etiquetas Estigmatizantes', () => {
      it('los nodos no deben contener etiquetas peyorativas ni estigmatizantes ("agresor", "matón", "problemático", "víctima")', async () => {
        const incGrave = { id: 'inc-1', folio: 'INC-1', gravedad: 'Grave', fecha_incidente: '2026-04-01' }

        configurarMockSupabase({
          curso: mockCurso,
          estudiantes: [est1, est2],
          incidentes: [incGrave],
          incidenteEstudiantes: [
            { incidente_id: 'inc-1', estudiante_id: est1.id, rol: 'involucrado' },
            { incidente_id: 'inc-1', estudiante_id: est2.id, rol: 'involucrado' },
          ],
        })

        const resultado = await sociogramaService.obtenerSociogramaPorCurso(tenantId, cursoId)

        const terminosProhibidos = ['agresor', 'maton', 'matón', 'problematico', 'problemático', 'toxico', 'tóxico', 'victima', 'víctima', 'conflictivo']

        resultado.nodes.forEach((nodo) => {
          // Verificar valores pedagógicos no estigmatizantes
          expect(nodo).toHaveProperty('nivel_acompanamiento')
          expect(nodo).toHaveProperty('clasificacion_formativa')

          const valoresTexto = JSON.stringify(nodo).toLowerCase()
          terminosProhibidos.forEach((termino) => {
            expect(valoresTexto).not.toContain(`"${termino}"`)
          })

          // No debe exponer datos de salud ni diagnóstico PIE
          expect(nodo).not.toHaveProperty('diagnostico_pie')
          expect(nodo).not.toHaveProperty('evaluacion_psicosocial')
        })
      })
    })
  })
})
