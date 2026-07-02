const { authenticateSocket } = require('../../../src/sockets/authMiddleware')
const { verifyToken } = require('../../../src/middlewares/auth')

jest.mock('../../../src/middlewares/auth')

describe('Socket Auth Middleware', () => {
  let socket
  let next

  beforeEach(() => {
    socket = {
      handshake: {
        auth: {}
      }
    }
    next = jest.fn()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('debe rechazar si no hay token', () => {
    authenticateSocket(socket, next)

    expect(next).toHaveBeenCalledWith(expect.any(Error))
    expect(next.mock.calls[0][0].message).toBe('Token no proporcionado')
  })

  it('debe rechazar si token es inválido', () => {
    socket.handshake.auth.token = 'token_invalido'
    verifyToken.mockReturnValue(null)

    authenticateSocket(socket, next)

    expect(next).toHaveBeenCalledWith(expect.any(Error))
    expect(next.mock.calls[0][0].message).toBe('Token inválido')
  })

  it('debe autenticar y agregar datos a socket', () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      rol: 'Administrador',
      tenant_id: 'tenant-123'
    }

    socket.handshake.auth.token = 'token_valido'
    verifyToken.mockReturnValue(mockUser)

    authenticateSocket(socket, next)

    expect(socket.userId).toBe(1)
    expect(socket.userEmail).toBe('test@example.com')
    expect(socket.rol).toBe('Administrador')
    expect(socket.tenantId).toBe('tenant-123')
    expect(next).toHaveBeenCalledWith()
  })
})
