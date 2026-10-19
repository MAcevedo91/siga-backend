const requireRole = require('../../middlewares/requireRole')

describe('requireRole Middleware', () => {
  it('should return 401 if req.user is missing', () => {
    const req = {}
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    }
    const next = jest.fn()

    const middleware = requireRole('Administrador', 'Docente')
    middleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 401,
      message: 'No autorizado. Token ausente.'
    }))
    expect(next).not.toHaveBeenCalled()
  })

  it('should return 403 if user role is not in allowed roles', () => {
    const req = { user: { rol: 'Estudiante' } }
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    }
    const next = jest.fn()

    const middleware = requireRole('Administrador', 'Docente')
    middleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 403,
      message: 'No tienes permisos para realizar esta acción.'
    }))
    expect(next).not.toHaveBeenCalled()
  })

  it('should call next if Docente is allowed and user is Docente', () => {
    const req = { user: { rol: 'Docente' } }
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    }
    const next = jest.fn()

    const middleware = requireRole('Administrador', 'Equipo de Formación', 'Inspector', 'Docente')
    middleware(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('should allow new Convivencia Escolar roles when Equipo de Formación is required', () => {
    const rolesConvivencia = [
      'Coordinador de Convivencia Escolar',
      'Orientador',
      'Psicólogo',
      'Asistente Social',
    ]

    const middleware = requireRole('Administrador', 'Equipo de Formación')

    rolesConvivencia.forEach((rol) => {
      const req = { user: { rol } }
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }
      const next = jest.fn()

      middleware(req, res, next)
      expect(next).toHaveBeenCalled()
      expect(res.status).not.toHaveBeenCalled()
    })
  })

  it('should allow Directiva when Directivo is required and vice versa', () => {
    const middleware = requireRole('Directivo')
    const req = { user: { rol: 'Directiva' } }
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }
    const next = jest.fn()

    middleware(req, res, next)
    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })
})
