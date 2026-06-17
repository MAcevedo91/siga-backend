const xlsx        = require('xlsx')
const { parse }   = require('csv-parse/sync')
const estudiantesService = require('../services/estudiantesService')

/**
 * GET /api/v1/estudiantes
 * Acepta query params: nombre, rut, curso_id, activo
 */
const listarHandler = async (req, res, next) => {
  try {
    const estudiantes = await estudiantesService.listarEstudiantes(
      req.user.tenant_id,
      req.query
    )
    res.status(200).json({
      status: 'success',
      message: `${estudiantes.length} estudiante(s) encontrado(s)`,
      data: estudiantes,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/estudiantes/:id/perfil
 */
const perfilHandler = async (req, res, next) => {
  try {
    const perfil = await estudiantesService.obtenerPerfil(
      req.params.id,
      req.user.tenant_id
    )
    res.status(200).json({
      status: 'success',
      message: 'Perfil del estudiante',
      data: perfil,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/estudiantes
 */
const crearHandler = async (req, res, next) => {
  try {
    const estudiante = await estudiantesService.crearEstudiante(
      req.user.tenant_id,
      req.body
    )
    res.status(201).json({
      status: 'success',
      message: 'Estudiante creado exitosamente',
      data: estudiante,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * PUT /api/v1/estudiantes/:id
 */
const actualizarHandler = async (req, res, next) => {
  try {
    const estudiante = await estudiantesService.actualizarEstudiante(
      req.params.id,
      req.user.tenant_id,
      req.body
    )
    res.status(200).json({
      status: 'success',
      message: 'Estudiante actualizado exitosamente',
      data: estudiante,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/estudiantes/importar
 * Acepta multipart/form-data con campo "archivo" (.csv o .xlsx)
 */
const importarHandler = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'Debe adjuntar un archivo CSV o Excel',
        statusCode: 400,
      })
    }

    const { mimetype, buffer, originalname } = req.file
    let filas = []

    // Parsear según tipo de archivo
    if (
      mimetype === 'text/csv' ||
      mimetype === 'application/csv' ||
      originalname.endsWith('.csv')
    ) {
      // Parsear CSV
      filas = parse(buffer, {
        columns:          true,  // Primera fila como headers
        skip_empty_lines: true,
        trim:             true,
      })
    } else if (
      mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimetype === 'application/vnd.ms-excel' ||
      originalname.endsWith('.xlsx') ||
      originalname.endsWith('.xls')
    ) {
      // Parsear Excel
      const workbook  = xlsx.read(buffer, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0]
      filas = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' })
    } else {
      return res.status(400).json({
        status: 'error',
        message: 'Formato de archivo no soportado. Use CSV o Excel (.xlsx)',
        statusCode: 400,
      })
    }

    if (filas.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'El archivo está vacío o no tiene datos válidos',
        statusCode: 400,
      })
    }

    const resultado = await estudiantesService.importarEstudiantes(filas, req.user.tenant_id)

    res.status(200).json({
      status: 'success',
      message: `Importación completada. ${resultado.importados} nuevos, ${resultado.actualizados} actualizados, ${resultado.errores.length} errores.`,
      data: resultado,
    })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  listarHandler,
  perfilHandler,
  crearHandler,
  actualizarHandler,
  importarHandler,
}
