const { Router } = require('express')
const { loginHandler, getMeHandler } = require('../controllers/authController')
const authenticateToken = require('../middlewares/authenticateToken')

const router = Router()

// POST /api/v1/auth/login — público
router.post('/login', loginHandler)

// GET /api/v1/auth/me — privado (requiere token válido)
router.get('/me', authenticateToken, getMeHandler)

module.exports = router
