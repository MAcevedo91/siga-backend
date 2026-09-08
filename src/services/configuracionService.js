const { supabase } = require('../utils/db')
const logger = require('../utils/logger')
const { registrarAuditoria } = require('./auditoriaService')

const DEFAULT_CONFIG = {
  umbral_riesgo: 6,
  ventana_dias_riesgo: 30,
  ventana_dias_reincidencia: 45,
  ventana_dias_escalada: 15,
}

/**
 * Obtiene la configuración actual del tenant y la matriz de reglas de protocolos.
 * Si el tenant no tiene registro de configuración, retorna los valores por defecto (fallback seguro).
 *
 * @param {string} tenantId - UUID del establecimiento educativo
 * @returns {Promise<Object>} Objeto con parámetros generales y reglas normativas
 */
async function obtenerConfiguracion(tenantId) {
  // 1. Obtener parámetros analíticos del tenant
  const { data: config, error: errorConfig } = await supabase
    .from('configuracion_tenant')
    .select('id, tenant_id, umbral_riesgo, ventana_dias_riesgo, ventana_dias_reincidencia, ventana_dias_escalada, updated_at')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (errorConfig) {
    logger.warn('Error al leer configuracion_tenant, usando fallback por defecto', {
      tenantId,
      error: errorConfig.message,
    })
  }

  const configFinal = config || {
    tenant_id: tenantId,
    ...DEFAULT_CONFIG,
    updated_at: null,
  }

  // 2. Obtener matriz de reglas de protocolo
  const { data: reglas, error: errorReglas } = await supabase
    .from('reglas_protocolo')
    .select(`
      id, orden, accion, plazo_dias, prorrogable, activo, tipo_protocolo_id,
      tipo_protocolo:tipos_protocolo ( id, nombre )
    `)
    .eq('tenant_id', tenantId)
    .order('tipo_protocolo_id', { ascending: true })
    .order('orden', { ascending: true })

  if (errorReglas) {
    logger.error('Error al obtener reglas de protocolo del tenant', {
      tenantId,
      error: errorReglas.message,
    })
    const err = new Error(`Error al obtener reglas de protocolo: ${errorReglas.message}`)
    err.statusCode = 500
    throw err
  }

  return {
    parametros: {
      umbral_riesgo: configFinal.umbral_riesgo,
      ventana_dias_riesgo: configFinal.ventana_dias_riesgo,
      ventana_dias_reincidencia: configFinal.ventana_dias_reincidencia,
      ventana_dias_escalada: configFinal.ventana_dias_escalada,
      updated_at: configFinal.updated_at,
    },
    reglas: reglas || [],
  }
}

/**
 * Actualiza los parámetros analíticos generales del tenant en configuracion_tenant.
 *
 * @param {string} tenantId - UUID del establecimiento
 * @param {string} userId - UUID del usuario que realiza la modificación
 * @param {Object} data - Datos a actualizar
 * @param {string} [ip] - IP del cliente para auditoría
 * @returns {Promise<Object>} Configuración actualizada
 */
async function actualizarConfiguracion(tenantId, userId, data, ip) {
  const {
    umbral_riesgo,
    ventana_dias_riesgo,
    ventana_dias_reincidencia,
    ventana_dias_escalada,
  } = data

  // Validaciones de integridad numérica
  const campos = { umbral_riesgo, ventana_dias_riesgo, ventana_dias_reincidencia, ventana_dias_escalada }
  for (const [campo, valor] of Object.entries(campos)) {
    if (valor !== undefined) {
      if (!Number.isInteger(valor) || valor <= 0) {
        const err = new Error(`El campo "${campo}" debe ser un número entero mayor a 0`)
        err.statusCode = 400
        throw err
      }
    }
  }

  // 1. Obtener estado previo para auditoría
  const { data: configActual } = await supabase
    .from('configuracion_tenant')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  const payload = {
    tenant_id: tenantId,
    umbral_riesgo: umbral_riesgo ?? configActual?.umbral_riesgo ?? DEFAULT_CONFIG.umbral_riesgo,
    ventana_dias_riesgo: ventana_dias_riesgo ?? configActual?.ventana_dias_riesgo ?? DEFAULT_CONFIG.ventana_dias_riesgo,
    ventana_dias_reincidencia: ventana_dias_reincidencia ?? configActual?.ventana_dias_reincidencia ?? DEFAULT_CONFIG.ventana_dias_reincidencia,
    ventana_dias_escalada: ventana_dias_escalada ?? configActual?.ventana_dias_escalada ?? DEFAULT_CONFIG.ventana_dias_escalada,
    updated_at: new Date().toISOString(),
  }

  // 2. Upsert en base de datos
  const { data: configActualizada, error } = await supabase
    .from('configuracion_tenant')
    .upsert(payload, { onConflict: 'tenant_id' })
    .select()
    .single()

  if (error) {
    logger.error('Error al actualizar configuracion_tenant', {
      tenantId,
      error: error.message,
    })
    const err = new Error(`Error al guardar configuración: ${error.message}`)
    err.statusCode = 500
    throw err
  }

  // 3. Bitácora de Auditoría
  await registrarAuditoria({
    tenantId,
    userId,
    accion: configActual ? 'UPDATE' : 'CREATE',
    tabla: 'configuracion_tenant',
    registroId: configActualizada.id,
    datosBefore: configActual || null,
    datosAfter: configActualizada,
    ip: ip || null,
  }).catch(err => {
    logger.error('Error al registrar auditoría en configuracion_tenant', {
      error: err.message,
    })
  })

  return configActualizada
}

/**
 * Modifica el plazo normativo en días de una regla de protocolo específica.
 *
 * @param {string} tenantId - UUID del establecimiento
 * @param {string} reglaId - UUID de la regla en reglas_protocolo
 * @param {string} userId - UUID del usuario que realiza la modificación
 * @param {Object} data - Datos a actualizar ({ plazo_dias, accion, prorrogable, activo })
 * @param {string} [ip] - IP del cliente
 * @returns {Promise<Object>} Regla actualizada
 */
async function actualizarPlazoRegla(tenantId, reglaId, userId, data, ip) {
  const { plazo_dias, accion, prorrogable, activo } = data

  if (plazo_dias !== undefined) {
    if (!Number.isInteger(plazo_dias) || plazo_dias <= 0) {
      const err = new Error('El plazo en días debe ser un número entero mayor a 0')
      err.statusCode = 400
      throw err
    }
  }

  // 1. Obtener regla actual y validar tenant
  const { data: reglaActual, error: errorRegla } = await supabase
    .from('reglas_protocolo')
    .select('*')
    .eq('id', reglaId)
    .eq('tenant_id', tenantId)
    .single()

  if (errorRegla || !reglaActual) {
    const err = new Error('Regla de protocolo no encontrada o no pertenece a este establecimiento')
    err.statusCode = 404
    throw err
  }

  // 2. Preparar campos de actualización
  const updateData = {}
  if (plazo_dias !== undefined) updateData.plazo_dias = plazo_dias
  if (accion !== undefined && typeof accion === 'string' && accion.trim().length > 0) {
    updateData.accion = accion.trim()
  }
  if (typeof prorrogable === 'boolean') updateData.prorrogable = prorrogable
  if (typeof activo === 'boolean') updateData.activo = activo

  const { data: reglaActualizada, error: updateError } = await supabase
    .from('reglas_protocolo')
    .update(updateData)
    .eq('id', reglaId)
    .eq('tenant_id', tenantId)
    .select(`
      id, orden, accion, plazo_dias, prorrogable, activo, tipo_protocolo_id,
      tipo_protocolo:tipos_protocolo ( id, nombre )
    `)
    .single()

  if (updateError) {
    logger.error('Error al actualizar regla_protocolo', {
      reglaId,
      error: updateError.message,
    })
    const err = new Error(`Error al actualizar la regla: ${updateError.message}`)
    err.statusCode = 500
    throw err
  }

  // 3. Registrar auditoría
  await registrarAuditoria({
    tenantId,
    userId,
    accion: 'UPDATE',
    tabla: 'reglas_protocolo',
    registroId: reglaId,
    datosBefore: reglaActual,
    datosAfter: reglaActualizada,
    ip: ip || null,
  }).catch(err => {
    logger.error('Error al registrar auditoría en reglas_protocolo', {
      reglaId,
      error: err.message,
    })
  })

  return reglaActualizada
}

module.exports = {
  DEFAULT_CONFIG,
  obtenerConfiguracion,
  actualizarConfiguracion,
  actualizarPlazoRegla,
}
