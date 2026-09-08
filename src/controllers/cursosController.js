const cursosService = require('../services/cursosService')

/**
 * GET /api/v1/cursos
 * Lista todos los cursos del tenant
 */
const listarCursosHandler = async (req, res, next) => {
  try {
    const cursos = await cursosService.listarCursos(req.user.tenant_id, req.query)
    res.status(200).json({
      status: 'success',
      message: `${cursos.length} curso(s) encontrado(s)`,
      data: cursos,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * GET /api/v1/cursos/niveles
 * Retorna lista de niveles disponibles en el período activo (ej: ["1° Básico", "2° Básico", ...])
 */
const obtenerNivelesHandler = async (req, res, next) => {
  try {
    const niveles = await cursosService.obtenerNiveles(req.user.tenant_id)
    res.status(200).json({
      status: 'success',
      message: `${niveles.length} nivel(es) encontrado(s)`,
      data: niveles,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * GET /api/v1/cursos/letras?nivel=X
 * Retorna las letras disponibles para ese nivel (ej: [{ id, letra: "A", nombre: "1° Básico A" }, ...])
 */
const obtenerLetrasHandler = async (req, res, next) => {
  try {
    const { nivel } = req.query
    const letras = await cursosService.obtenerLetrasPorNivel(req.user.tenant_id, nivel)
    res.status(200).json({
      status: 'success',
      message: `${letras.length} curso(s)/letra(s) encontrado(s) para el nivel ${nivel}`,
      data: letras,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * GET /api/v1/cursos/:id/estudiantes
 * Retorna la nómina alfabética de alumnos matriculados en ese curso exacto (id, nombre, apellido, rut, es_pie)
 */
const obtenerEstudiantesCursoHandler = async (req, res, next) => {
  try {
    const { id } = req.params
    const estudiantes = await cursosService.obtenerEstudiantesPorCurso(req.user.tenant_id, id)
    res.status(200).json({
      status: 'success',
      message: `${estudiantes.length} estudiante(s) encontrado(s) en el curso`,
      data: estudiantes,
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  listarCursosHandler,
  obtenerNivelesHandler,
  obtenerLetrasHandler,
  obtenerEstudiantesCursoHandler,
}
