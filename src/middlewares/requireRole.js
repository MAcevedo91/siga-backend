/**
 * Middleware: verifica que el rol del usuario autenticado
 * esté en la lista de roles permitidos para la ruta.
 *
 * Uso: router.get('/ruta', authenticateToken, requireRole('Administrador', 'Coordinador'), handler)
 *
 * IMPORTANTE: debe usarse siempre DESPUÉS de authenticateToken,
 * ya que depende de req.user para leer el rol.
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'No autorizado. Token ausente.',
        statusCode: 401,
      })
    }

    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permisos para realizar esta acción.',
        statusCode: 403,
      })
    }

    next()
  }
}

module.exports = requireRole
