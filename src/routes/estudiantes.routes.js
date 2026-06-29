const { Router } = require('express')
const multer     = require('multer')
const requireRole = require('../middlewares/requireRole')
const {
  listarHandler,
  perfilHandler,
  crearHandler,
  actualizarHandler,
  importarHandler,
  pdfHandler,
} = require('../controllers/estudiantesController')

const router = Router()

// Configuración de multer — almacena en memoria, límite 10MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const tiposPermitidos = [
      'text/csv',
      'application/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]
    const extensionesPermitidas = ['.csv', '.xls', '.xlsx']
    const ext = '.' + file.originalname.split('.').pop().toLowerCase()

    if (tiposPermitidos.includes(file.mimetype) || extensionesPermitidas.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error('Formato de archivo no soportado. Use CSV o Excel (.xlsx)'))
    }
  },
})

// Manejo de error de multer (archivo muy grande o campo inesperado)
const uploadWithErrorHandling = (req, res, next) => {
  upload.single('archivo')(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        status: 'error',
        message: 'El archivo no puede superar los 10MB',
        statusCode: 400,
      })
    }
    if (err) {
      return res.status(400).json({
        status: 'error',
        message: err.message,
        statusCode: 400,
      })
    }
    next()
  })
}

// ============================================================
// RUTAS
// ============================================================

// Lectura — todos los roles autenticados
router.get('/', listarHandler)
router.get('/:id/perfil', perfilHandler)

// PDF — solo Administrador y Equipo de Formación
router.get('/:id/pdf',
  requireRole('Administrador', 'Equipo de Formación'),
  pdfHandler
)

// Escritura — solo Administrador y Coordinador
router.post('/',
  requireRole('Administrador', 'Equipo de Formación'),
  crearHandler
)

router.put('/:id',
  requireRole('Administrador', 'Equipo de Formación'),
  actualizarHandler
)

// Importación masiva — solo Administrador y Coordinador
router.post('/importar',
  requireRole('Administrador', 'Equipo de Formación'),
  uploadWithErrorHandling,
  importarHandler
)

module.exports = router
