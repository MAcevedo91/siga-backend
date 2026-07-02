let io = null

/**
 * Inicializa el servidor Socket.io
 */
const initSocket = (httpServer) => {
  if (io) {
    return io
  }

  const { Server } = require('socket.io')

  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      methods: ['GET', 'POST']
    }
  })

  return io
}

/**
 * Obtiene la instancia de Socket.io
 */
const getIO = () => {
  if (!io) {
    throw new Error('Socket.io no ha sido inicializado')
  }
  return io
}

module.exports = {
  initSocket,
  getIO
}
