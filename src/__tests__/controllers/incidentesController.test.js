const incidentesController = require('../../controllers/incidentesController')
const incidentesService = require('../../services/incidentesService')

jest.mock('../../services/incidentesService')

describe('incidentesController', () => {
  let req, res, next

  beforeEach(() => {
    req = {
      params: { id: 'inc-123', estudianteId: 'est-456' },
      body: {},
      user: { user_id: 'user-789', tenant_id: 'tenant-abc', rol: 'Coordinador de Convivencia Escolar' }
    }
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    }
    next = jest.fn()
    jest.clearAllMocks()
  })

  describe('cambiarEstadoHandler', () => {
    it('debe rechazar con 400 si falta el campo estado', async () => {
      req.body = {}

      await incidentesController.cambiarEstadoHandler(req, res, next)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          message: 'El campo "estado" es requerido'
        })
      )
    })

    it('debe actualizar estado con observaciones individuales y responder 200', async () => {
      req.body = {
        estado: 'Derivado',
        justificacion: 'Derivado a dupla psicosocial',
        observacionesEstudiantes: [
          { estudiante_id: 'est-456', observacion: 'Derivado a psicólogo por contención' }
        ]
      }

      const mockResultado = { id: 'inc-123', estado: 'Derivado' }
      incidentesService.cambiarEstado.mockResolvedValue(mockResultado)

      await incidentesController.cambiarEstadoHandler(req, res, next)

      expect(incidentesService.cambiarEstado).toHaveBeenCalledWith(
        'inc-123',
        'tenant-abc',
        'Derivado',
        'user-789',
        {
          justificacion: 'Derivado a dupla psicosocial',
          observacionesEstudiantes: [
            { estudiante_id: 'est-456', observacion: 'Derivado a psicólogo por contención' }
          ]
        }
      )
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: mockResultado
        })
      )
    })

    it('debe delegar errores al middleware next', async () => {
      req.body = { estado: 'Derivado' }
      const errorSimulado = new Error('Database error')
      incidentesService.cambiarEstado.mockRejectedValue(errorSimulado)

      await incidentesController.cambiarEstadoHandler(req, res, next)

      expect(next).toHaveBeenCalledWith(errorSimulado)
    })
  })

  describe('actualizarObservacionEstudianteHandler', () => {
    it('debe actualizar la observacion individual del estudiante y responder 200', async () => {
      req.body = { observacion: 'Se deriva a entrevista con apoderado y orientador' }
      const mockUpdated = {
        incidente_id: 'inc-123',
        estudiante_id: 'est-456',
        observacion: 'Se deriva a entrevista con apoderado y orientador'
      }
      incidentesService.actualizarObservacionEstudiante.mockResolvedValue(mockUpdated)

      await incidentesController.actualizarObservacionEstudianteHandler(req, res, next)

      expect(incidentesService.actualizarObservacionEstudiante).toHaveBeenCalledWith(
        'inc-123',
        'est-456',
        'tenant-abc',
        'Se deriva a entrevista con apoderado y orientador',
        'user-789'
      )
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: mockUpdated
        })
      )
    })

    it('debe pasar el error a next si el servicio falla', async () => {
      req.body = { observacion: 'Observacion test' }
      const error = new Error('Estudiante no encontrado')
      incidentesService.actualizarObservacionEstudiante.mockRejectedValue(error)

      await incidentesController.actualizarObservacionEstudianteHandler(req, res, next)

      expect(next).toHaveBeenCalledWith(error)
    })
  })
})
