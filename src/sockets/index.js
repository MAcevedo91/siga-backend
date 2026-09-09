const { Server } = require('socket.io')
const { createAdapter } = require('@socket.io/redis-adapter')
const { authenticateSocket } = require('./authMiddleware')
const logger = require('../utils/logger')

let io = null

async function initSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true
    }
  })

  // Setup Redis adapter for horizontal scaling
  try {
    const redis = require('redis')
    const pubClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    })
    const subClient = pubClient.duplicate()

    await pubClient.connect()
    await subClient.connect()

    io.adapter(createAdapter(pubClient, subClient))
    logger.info('Socket.io Redis adapter configured for horizontal scaling')
  } catch (error) {
    logger.error('Failed to setup Redis adapter for Socket.io', { error: error.message })
    logger.warn('Socket.io running without Redis adapter - not suitable for production scaling')
  }

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

    // Join conversation rooms for mensajería
    socket.on('join-conversations', (conversacionesIds) => {
      if (!Array.isArray(conversacionesIds)) {
        logger.warn('Invalid join-conversations data', { userId: socket.userId })
        return
      }

      conversacionesIds.forEach(convId => {
        socket.join(`conversation-${convId}`)
      })
      logger.info('User joined conversation rooms', {
        userId: socket.userId,
        count: conversacionesIds.length
      })
    })

    // Leave conversation room
    socket.on('leave-conversation', (conversacionId) => {
      socket.leave(`conversation-${conversacionId}`)
      logger.debug('User left conversation', {
        userId: socket.userId,
        conversacionId
      })
    })

    // Typing indicator for mensajería
    socket.on('usuario:escribiendo', ({ conversacionId }) => {
      if (!conversacionId) {
        logger.warn('Invalid typing event data', { userId: socket.userId })
        return
      }

      socket.to(`conversation-${conversacionId}`).emit('usuario:escribiendo', {
        conversacionId,
        usuarioId: socket.userId,
        timestamp: new Date()
      })

      logger.debug('Typing indicator sent', {
        userId: socket.userId,
        conversacionId
      })
    })

    // Stop typing indicator
    socket.on('usuario:dejo-de-escribir', ({ conversacionId }) => {
      if (!conversacionId) {
        return
      }

      socket.to(`conversation-${conversacionId}`).emit('usuario:dejo-de-escribir', {
        conversacionId,
        usuarioId: socket.userId
      })
    })

    // Disconnect handler
    socket.on('disconnect', (reason) => {
      logger.info('Client disconnected', {
        socketId: socket.id,
        userId: socket.userId,
        reason
      })
    })
  })

  logger.info('Socket.io server initialized with mensajería support')

  return io
}

function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized')
  }
  return io
}

module.exports = { initSocketServer, getIO }
