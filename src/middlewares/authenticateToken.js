const jwt = require('jsonwebtoken')

/**
 * Middleware: verifica el JWT en el header Authorization.
 * Si es válido, adjunta el payload decodificado en req.user.
 * Si no, retorna 401.
 */
const authenticateToken = (req, res, next) => {
  // El header debe venir como: Authorization: Bearer <token>
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({
      status: 'error',
      message: 'No autorizado. Token ausente.',
      statusCode: 401,
    })
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.user = {
      ...payload,
      id: payload.user_id || payload.id,
      user_id: payload.user_id || payload.id,
    }
    next()
  } catch (err) {
    const message = err.name === 'TokenExpiredError'
      ? 'Sesión expirada. Por favor inicia sesión nuevamente.'
      : 'No autorizado. Token inválido.'

    return res.status(401).json({
      status: 'error',
      message,
      statusCode: 401,
    })
  }
}

module.exports = authenticateToken
