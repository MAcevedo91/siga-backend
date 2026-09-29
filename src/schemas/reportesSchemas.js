const { z } = require('zod')

// =============================================================================
// ESQUEMAS DE VALIDACIÓN ZOD (CIRCULAR N° 482 - SUPERINTENDENCIA DE EDUCACIÓN)
// =============================================================================

const seccionesReporteSchema = z.object({
  contexto: z
    .string({ required_error: 'El contexto es requerido' })
    .min(10, 'El contexto debe tener al menos 10 caracteres'),
  hechos_objetivos: z
    .string({ required_error: 'El relato de hechos objetivos es requerido' })
    .min(20, 'El relato objetivo debe tener al menos 20 caracteres'),
  medidas_adoptadas: z
    .string({ required_error: 'Las medidas adoptadas son requeridas' })
    .min(10, 'Las medidas adoptadas deben tener al menos 10 caracteres'),
  acuerdos_compromisos: z
    .string({ required_error: 'Los acuerdos y compromisos son requeridos' })
    .min(10, 'Los acuerdos y compromisos deben tener al menos 10 caracteres'),
  plan_seguimiento: z
    .string({ required_error: 'El plan de seguimiento es requerido' })
    .min(10, 'El plan de seguimiento debe tener al menos 10 caracteres'),
})

const crearReporteSchema = z.object({
  incidente_id: z.string().uuid('incidente_id debe ser un UUID válido'),
  estudiante_id: z.string().uuid('estudiante_id debe ser un UUID válido'),
  contenido_borrador: seccionesReporteSchema,
})

const editarReporteSchema = z.object({
  contenido_editado: seccionesReporteSchema,
})

module.exports = {
  seccionesReporteSchema,
  crearReporteSchema,
  editarReporteSchema,
}
