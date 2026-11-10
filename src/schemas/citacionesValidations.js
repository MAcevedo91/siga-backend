const { z } = require('zod')

// =============================================================================
// ESQUEMAS ZOD: MÓDULO DE CITACIONES FORMATIVAS (TASK 10.1.2 / SPRINT 10)
// =============================================================================

const MOTIVOS_VALIDOS = [
  'refuerzo_academico',
  'habitos_asistencia',
  'reconocimiento_felicitacion',
  'acuerdos_convivencia',
  'seguimiento_formativo',
]

const MODALIDADES_VALIDAS = ['presencial', 'virtual']

const ACCIONES_RESPUESTA_VALIDAS = ['confirmar', 'reprogramar', 'justificar']

const ESTADOS_VALIDOS = [
  'programada',
  'confirmada',
  'reprogramacion_solicitada',
  'justificada',
  'realizada',
  'no_asiste',
  'cancelada',
]

/**
 * Esquema para programar una nueva citación formativa (Privado - Docente / Directivo)
 */
const crearCitacionSchema = z.object({
  estudiante_id: z
    .string({ required_error: 'El estudiante es requerido' })
    .uuid('estudiante_id debe ser un UUID válido'),
  apoderado_id: z
    .string({ required_error: 'El apoderado es requerido' })
    .uuid('apoderado_id debe ser un UUID válido'),
  motivo_categoria: z.enum(MOTIVOS_VALIDOS, {
    errorMap: () => ({
      message: `Categoría de motivo inválida. Opciones: ${MOTIVOS_VALIDOS.join(', ')}`,
    }),
  }),
  motivo_detalle: z
    .string({ required_error: 'El detalle del motivo pedagógico es requerido' })
    .trim()
    .min(10, 'El detalle del motivo debe tener al menos 10 caracteres')
    .max(2000, 'El detalle del motivo no puede superar los 2000 caracteres'),
  fecha_hora_programada: z
    .string({ required_error: 'La fecha y hora de la citación es requerida' })
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'fecha_hora_programada debe tener un formato de fecha ISO válido',
    }),
  lugar_entrevista: z
    .string()
    .trim()
    .max(150, 'El lugar no puede superar los 150 caracteres')
    .optional()
    .default('Sala de Entrevistas / Convivencia Escolar'),
  modalidad: z
    .enum(MODALIDADES_VALIDAS, {
      errorMap: () => ({
        message: `Modalidad inválida. Opciones: ${MODALIDADES_VALIDAS.join(', ')}`,
      }),
    })
    .default('presencial'),
  enlace_virtual: z
    .string()
    .trim()
    .url('El enlace virtual debe ser una URL válida')
    .optional()
    .nullable(),
})

/**
 * Esquema para responder a una citación desde la interfaz pública móvil (1-clic Apoderado)
 */
const responderCitacionPublicaSchema = z
  .object({
    token: z
      .string({ required_error: 'El token de confirmación es requerido' })
      .uuid('El token debe ser un UUID válido'),
    accion: z.enum(ACCIONES_RESPUESTA_VALIDAS, {
      errorMap: () => ({
        message: `Acción inválida. Opciones: ${ACCIONES_RESPUESTA_VALIDAS.join(', ')}`,
      }),
    }),
    comentario: z
      .string()
      .trim()
      .max(1000, 'El comentario no puede exceder los 1000 caracteres')
      .optional()
      .nullable(),
    nueva_fecha_solicitada: z
      .string()
      .optional()
      .nullable()
      .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: 'nueva_fecha_solicitada debe tener un formato de fecha ISO válido',
      }),
  })
  .superRefine((data, ctx) => {
    if (data.accion === 'reprogramar' && !data.nueva_fecha_solicitada && !data.comentario) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['comentario'],
        message: 'Debe ingresar una propuesta de nueva fecha o un comentario explicando la solicitud de reprogramación',
      })
    }
    if (data.accion === 'justificar' && (!data.comentario || data.comentario.trim().length < 5)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['comentario'],
        message: 'Debe ingresar el motivo de justificación de la inasistencia (mínimo 5 caracteres)',
      })
    }
  })

/**
 * Esquema para validar el token UUID en parámetros de ruta
 */
const tokenParamSchema = z.object({
  token: z.string().uuid('El token debe ser un UUID válido'),
})

/**
 * Esquema para registrar acuerdos mutuos y cerrar la entrevista (TASK 10.2.3)
 */
const registrarAcuerdosSchema = z.object({
  compromisos_colegio: z
    .array(
      z.string().trim().min(3, 'Cada compromiso del colegio debe tener al menos 3 caracteres')
    )
    .min(1, 'Debe registrar al menos un compromiso por parte del colegio'),
  compromisos_apoderado: z
    .array(
      z.string().trim().min(3, 'Cada compromiso del apoderado debe tener al menos 3 caracteres')
    )
    .min(1, 'Debe registrar al menos un compromiso por parte del apoderado'),
  fecha_proximo_seguimiento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha_proximo_seguimiento debe tener formato YYYY-MM-DD')
    .optional()
    .nullable(),
  firma_docente: z.string().optional().nullable(),
  firma_apoderado: z.string().optional().nullable(),
})

/**
 * Esquema para validar los filtros de métricas analíticas (TASK 10.3.1)
 */
const metricasFiltrosSchema = z.object({
  fecha_desde: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'fecha_desde debe ser una fecha válida (ISO 8601 o YYYY-MM-DD)',
    }),
  fecha_hasta: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'fecha_hasta debe ser una fecha válida (ISO 8601 o YYYY-MM-DD)',
    }),
  docente_id: z.string().uuid('docente_id debe ser un UUID válido').optional(),
})

/**
 * Esquema para validar el UUID del estudiante en parámetros de ruta (TASK 10.3.1)
 */
const estudianteIdParamSchema = z.object({
  estudianteId: z.string().uuid('estudianteId debe ser un UUID válido'),
})

module.exports = {
  MOTIVOS_VALIDOS,
  MODALIDADES_VALIDAS,
  ACCIONES_RESPUESTA_VALIDAS,
  ESTADOS_VALIDOS,
  crearCitacionSchema,
  responderCitacionPublicaSchema,
  tokenParamSchema,
  registrarAcuerdosSchema,
  metricasFiltrosSchema,
  estudianteIdParamSchema,
}
