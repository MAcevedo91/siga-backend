/**
 * Middleware: verifica que el rol del usuario autenticado
 * esté en la lista de roles permitidos para la ruta.
 *
 * Uso: router.get('/ruta', authenticateToken, requireRole('Administrador', 'Coordinador'), handler)
 *
 * IMPORTANTE: debe usarse siempre DESPUÉS de authenticateToken,
 * ya que depende de req.user para leer el rol.
 */
const ALIAS_ROLES = {
  'Equipo de Formación': [
    'Equipo de Formación',
    'Coordinador de Convivencia Escolar',
    'Orientador',
    'Psicólogo',
    'Asistente Social',
  ],
  'Directivo': ['Directivo', 'Directiva'],
  'Directiva': ['Directivo', 'Directiva'],
}

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'No autorizado. Token ausente.',
        statusCode: 401,
      })
    }

    // Expandir roles permitidos con sus alias y subtipos de convivencia escolar
    const rolesPermitidos = new Set()
    roles.forEach((rol) => {
      rolesPermitidos.add(rol)
      if (ALIAS_ROLES[rol]) {
        ALIAS_ROLES[rol].forEach((subRol) => rolesPermitidos.add(subRol))
      }
    })

    if (!rolesPermitidos.has(req.user.rol)) {
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
