const { z } = require('zod')

// =============================================================================
// ENUMS Y CONSTANTES DEL MÓDULO DE MEDIACIÓN ESCOLAR
// =============================================================================

const TIPOS_ORIGEN = [
  'derivada_incidente',
  'preventiva_convivencia',
  'solicitud_estudiante',
  'solicitud_apoderado',
]

const ESTADOS_MEDIACION = [
  'borrador',
  'programada',
  'en_sesion',
  'acordada',
  'sin_acuerdo',
  'derivada_inspectoria',
]

const ROLES_PARTICIPANTE = [
  'parte_1',
  'parte_2',
  'afectado',
  'mediador_par',
  'observador',
]

const MEDIOS_AVISO = [
  'correo',
  'comunicacion_escrita',
  'llamada_telefonica',
]

// =============================================================================
// SUB-ESQUEMA: PARTICIPANTE EN MEDIACIÓN
// =============================================================================

const participanteSchema = z.object({
  estudiante_id: z
    .string({ required_error: 'El estudiante_id es requerido' })
    .uuid('estudiante_id debe ser un UUID válido'),
  rol_participante: z
    .enum(ROLES_PARTICIPANTE, {
      invalid_type_error: `Rol inválido. Opciones: ${ROLES_PARTICIPANTE.join(', ')}`,
    })
    .default('parte_1'),
})

// =============================================================================
// ESQUEMA: CREACIÓN DE MEDIACIÓN
// =============================================================================

const crearMediacionSchema = z.object({
  tipo_origen: z
    .enum(TIPOS_ORIGEN, {
      invalid_type_error: `Tipo de origen inválido. Opciones: ${TIPOS_ORIGEN.join(', ')}`,
    })
    .default('preventiva_convivencia'),
  incidente_id: z
    .string()
    .uuid('incidente_id debe ser un UUID válido')
    .optional()
    .nullable(),
  motivo: z
    .string({ required_error: 'El motivo de la mediación es requerido' })
    .min(10, 'El motivo debe tener al menos 10 caracteres'),
  fecha_programada: z
    .string({ required_error: 'La fecha programada es requerida' })
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'La fecha programada debe ser una fecha/hora válida (formato ISO)',
    }),
  lugar_sesion: z
    .string()
    .max(100, 'El lugar de sesión no puede superar los 100 caracteres')
    .optional()
    .default('Oficina de Convivencia Escolar'),
  observaciones_previas: z.string().optional().nullable(),
  participantes: z
    .array(participanteSchema, {
      required_error: 'Debe incluir al menos 2 estudiantes participantes distintos',
    })
    .min(2, 'Debe incluir al menos 2 estudiantes participantes distintos'),
}).refine(
  (data) => {
    const ids = data.participantes.map((p) => p.estudiante_id)
    return new Set(ids).size === ids.length
  },
  {
    message: 'No se permiten estudiantes duplicados en la misma mediación',
    path: ['participantes'],
  }
)

// =============================================================================
// ESQUEMA: FILTROS DE CONSULTA (LISTADO)
// =============================================================================

const filtrosMediacionesSchema = z.object({
  estado: z.enum(ESTADOS_MEDIACION).optional(),
  tipo_origen: z.enum(TIPOS_ORIGEN).optional(),
  fecha_desde: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha_desde debe tener formato YYYY-MM-DD')
    .optional(),
  fecha_hasta: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha_hasta debe tener formato YYYY-MM-DD')
    .optional(),
  curso_id: z.string().optional(),
  estudiante_id: z.string().uuid('estudiante_id debe ser UUID').optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
})

// =============================================================================
// ESQUEMA: NOTIFICACIÓN A APODERADOS
// =============================================================================

const notificarApoderadosSchema = z.object({
  medio_aviso: z
    .enum(MEDIOS_AVISO, {
      invalid_type_error: `Medio de aviso inválido. Opciones: ${MEDIOS_AVISO.join(', ')}`,
    })
    .default('correo'),
  mensaje_personalizado: z.string().max(500).optional().nullable(),
  estudiante_ids: z
    .array(z.string().uuid('Cada estudiante_id debe ser UUID'))
    .optional(),
})

// =============================================================================
// ENUMS Y ESQUEMAS: COMPROMISOS Y ACUERDOS FORMATIVOS (TASK 7.2.2.1)
// =============================================================================

const TIPOS_COMPROMISO = [
  'reparacion_relacional',
  'disculpa_comunitaria',
  'cuidado_espacios',
  'actitud_aula',
  'apoyo_academico',
  'otro',
]

const compromisoItemSchema = z.object({
  id: z.string().uuid('id del compromiso debe ser UUID válido').optional().nullable(),
  estudiante_id: z.string().uuid('estudiante_id debe ser UUID válido').optional().nullable(),
  tipo_compromiso: z.enum(TIPOS_COMPROMISO, {
    message: `Tipo de compromiso inválido. Opciones: ${TIPOS_COMPROMISO.join(', ')}`,
  }),
  descripcion: z
    .string({ required_error: 'La descripción del compromiso es requerida' })
    .min(5, 'La descripción del compromiso debe tener al menos 5 caracteres')
    .max(1000, 'La descripción no puede superar los 1000 caracteres'),
  fecha_limite: z
    .string({ required_error: 'La fecha límite es requerida' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha_limite debe tener formato YYYY-MM-DD'),
  cumplido: z.boolean().optional().default(false),
  fecha_cumplimiento: z.string().optional().nullable(),
  observaciones_seguimiento: z.string().max(1000).optional().nullable(),
})

const guardarCompromisosBaseSchema = z.object({
  compromisos: z
    .array(compromisoItemSchema, {
      required_error: 'Debe incluir al menos un compromiso',
    })
    .min(1, 'Debe incluir al menos un compromiso'),
  fecha_seguimiento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha_seguimiento debe tener formato YYYY-MM-DD')
    .optional()
    .nullable(),
  observaciones_cierre: z.string().max(2000).optional().nullable(),
  estado: z.enum(ESTADOS_MEDIACION).optional(),
})

/**
 * Genera un validador Zod contextualizado con la fecha de la mediación.
 * Garantiza el Criterio de Aceptación: fecha_limite no puede ser anterior a la fecha de la mediación.
 *
 * @param {string|Date} [fechaMediacion] - Fecha programada de la mediación
 * @returns {z.ZodTypeAny}
 */
const crearGuardarCompromisosSchema = (fechaMediacion) => {
  return guardarCompromisosBaseSchema.superRefine((data, ctx) => {
    if (fechaMediacion) {
      const fechaRef = typeof fechaMediacion === 'string'
        ? fechaMediacion.split('T')[0]
        : new Date(fechaMediacion).toISOString().split('T')[0]

      data.compromisos.forEach((comp, idx) => {
        if (comp.fecha_limite && comp.fecha_limite < fechaRef) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `La fecha límite (${comp.fecha_limite}) no puede ser anterior a la fecha de la mediación (${fechaRef})`,
            path: ['compromisos', idx, 'fecha_limite'],
          })
        }
      })
    }
  })
}

// =============================================================================
// ESQUEMAS: EVALUACIÓN DE COMPROMISOS Y CIERRE INMUTABLE (TASK 7.2.4.1)
// =============================================================================

const ESTADOS_EVALUACION = ['cumplido', 'parcial', 'incumplido']
const ESTADOS_CIERRE = ['acordada', 'sin_acuerdo', 'derivada_inspectoria']

const evaluacionItemSchema = z.object({
  compromiso_id: z.string().uuid('compromiso_id debe ser un UUID válido'),
  estado: z.enum(ESTADOS_EVALUACION, {
    message: `Estado de evaluación inválido. Opciones: ${ESTADOS_EVALUACION.join(', ')}`,
  }),
  observaciones_seguimiento: z.string().max(1000, 'Las observaciones no pueden superar los 1000 caracteres').optional().nullable(),
})

const evaluarCompromisosSchema = z.object({
  evaluaciones: z
    .array(evaluacionItemSchema)
    .min(1, 'Debe incluir al menos una evaluación de compromiso formativo'),
})

const cerrarMediacionSchema = z.object({
  estado: z.enum(ESTADOS_CIERRE, {
    message: `Estado de cierre inválido. Opciones: ${ESTADOS_CIERRE.join(', ')}`,
  }),
  conclusiones_cierre: z
    .string({ required_error: 'Las conclusiones de cierre son requeridas' })
    .trim()
    .min(10, 'Las conclusiones de cierre deben tener al menos 10 caracteres')
    .max(3000, 'Las conclusiones de cierre no pueden superar los 3000 caracteres'),
  protocolo_rice: z
    .object({
      tipo_protocolo_id: z.number().int().positive('tipo_protocolo_id debe ser un entero positivo'),
      estudiante_id: z.string().uuid('estudiante_id del protocolo debe ser UUID válido').optional().nullable(),
      observaciones: z.string().max(2000).optional().nullable(),
    })
    .optional()
    .nullable(),
})

module.exports = {
  TIPOS_ORIGEN,
  ESTADOS_MEDIACION,
  ROLES_PARTICIPANTE,
  MEDIOS_AVISO,
  TIPOS_COMPROMISO,
  ESTADOS_EVALUACION,
  ESTADOS_CIERRE,
  participanteSchema,
  crearMediacionSchema,
  filtrosMediacionesSchema,
  notificarApoderadosSchema,
  compromisoItemSchema,
  guardarCompromisosBaseSchema,
  crearGuardarCompromisosSchema,
  evaluacionItemSchema,
  evaluarCompromisosSchema,
  cerrarMediacionSchema,
}
