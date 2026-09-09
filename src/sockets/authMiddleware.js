const { verifyToken } = require('../middlewares/auth')
const logger = require('../utils/logger')

function authenticateSocket(socket, next) {
  const token = socket.handshake.auth.token

  if (!token) {
    logger.warn('Socket connection rejected: no token provided')
    return next(new Error('Token no proporcionado'))
  }

  try {
    const user = verifyToken(token)

    if (!user) {
      logger.warn('Socket connection rejected: invalid token')
      return next(new Error('Token inválido'))
    }

    // Attach user data to socket
    socket.userId = user.id
    socket.userEmail = user.email
    socket.rol = user.rol
    socket.tenantId = user.tenant_id

    logger.debug('Socket authenticated', {
      userId: user.id,
      tenantId: user.tenant_id,
      socketId: socket.id
    })

    next()
  } catch (error) {
    logger.error('Socket auth error', { error: error.message })
    next(new Error('Error de autenticación'))
  }
}

module.exports = { authenticateSocket }
