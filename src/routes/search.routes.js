const express = require('express')
const router = express.Router()
const searchController = require('../controllers/searchController')

// GET /api/v1/search/estudiantes?q=juan
router.get('/estudiantes', searchController.searchEstudiantes)

// GET /api/v1/search/incidentes?q=pelea
router.get('/incidentes', searchController.searchIncidentes)

module.exports = router
