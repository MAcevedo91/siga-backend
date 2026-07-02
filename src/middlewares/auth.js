const jwt = require('jsonwebtoken')

/**
 * Verifies a JWT token and returns the decoded payload.
 * Used by both HTTP middleware and Socket.io middleware.
 *
 * @param {string} token - JWT token to verify
 * @returns {Object|null} - Decoded payload { id, email, rol, tenant_id } or null if invalid
 */
function verifyToken(token) {
  if (!token) {
    return null
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)

    // Map user_id to id for consistency
    return {
      id: payload.user_id || payload.id,
      email: payload.email,
      rol: payload.rol,
      tenant_id: payload.tenant_id
    }
  } catch (error) {
    return null
  }
}

module.exports = { verifyToken }
