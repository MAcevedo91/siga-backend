const authService = require('../services/authService')

/**
 * POST /api/v1/auth/login
 */
const loginHandler = async (req, res, next) => {
  try {
    const { email, password } = req.body
    const result = await authService.login(email, password)

    res.status(200).json({
      status: 'success',
      message: 'Autenticación exitosa',
      data: result,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/auth/me
 * Requiere middleware authenticateToken antes de llegar aquí.
 */
const getMeHandler = async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user.user_id)

    res.status(200).json({
      status: 'success',
      message: 'Usuario autenticado',
      data: user,
    })
  } catch (err) {
    next(err)
  }
}

module.exports = { loginHandler, getMeHandler }
