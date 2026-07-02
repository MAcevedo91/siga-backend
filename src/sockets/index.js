const { Server } = require('socket.io')
const { authenticateSocket } = require('./authMiddleware')
const logger = require('../utils/logger')

let io = null

function initSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true
    }
  })

  // Authentication middleware
  io.use(authenticateSocket)

  // Connection handler
  io.on('connection', (socket) => {
    logger.info('Client connected', {
      socketId: socket.id,
      userId: socket.userId,
      tenantId: socket.tenantId
    })

    // Join tenant room
    socket.join(`tenant-${socket.tenantId}`)
    logger.debug(`Socket ${socket.id} joined tenant-${socket.tenantId}`)

    // Join user-specific room
    socket.join(`user-${socket.userId}`)
    logger.debug(`Socket ${socket.id} joined user-${socket.userId}`)

    // Join role room
    socket.join(`role-${socket.rol}`)
    logger.debug(`Socket ${socket.id} joined role-${socket.rol}`)

    socket.on('disconnect', (reason) => {
      logger.info('Client disconnected', {
        socketId: socket.id,
        userId: socket.userId,
        reason
      })
    })
  })

  logger.info('Socket.io server initialized on port 3001')

  return io
}

function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized')
  }
  return io
}

module.exports = { initSocketServer, getIO }
