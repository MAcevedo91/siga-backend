/**
 * Legacy socket.js - redirects to new sockets implementation
 * This file is kept for backwards compatibility
 *
 * IMPORTANT: Use src/sockets/index.js for the main Socket.io setup
 */

const { initSocketServer, getIO } = require('../sockets')

/**
 * @deprecated Use initSocketServer from src/sockets/index.js instead
 */
const initSocket = (httpServer) => {
  console.warn('DEPRECATION WARNING: initSocket from utils/socket.js is deprecated. Use initSocketServer from sockets/index.js')
  return initSocketServer(httpServer)
}

module.exports = {
  initSocket,
  getIO
}
