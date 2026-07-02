const { supabase } = require('../utils/db')

/**
 * Calculate diff between two objects
 * Returns object with changed fields only
 * @param {Object} before - Estado anterior del registro
 * @param {Object} after - Estado posterior del registro
 * @returns {Object} Objeto con solo los campos que cambiaron
 */
function calculateDiff(before, after) {
  const changes = {}

  const allKeys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {})
  ])

  for (const key of allKeys) {
    if (JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key])) {
      changes[key] = {
        before: before?.[key],
        after: after?.[key]
      }
    }
  }

  return changes
}

/**
 * Registra una acción en la tabla de auditoría con diff
 * @param {Object} params - Parámetros de auditoría
 * @param {string} params.tenantId - ID del tenant
 * @param {string} params.userId - ID del usuario que realiza la acción
 * @param {string} params.accion - Tipo de acción: 'CREATE', 'UPDATE', 'DELETE'
 * @param {string} params.tabla - Nombre de la tabla afectada
 * @param {string} params.registroId - ID del registro afectado
 * @param {Object} params.datosBefore - Estado antes del cambio
 * @param {Object} params.datosAfter - Estado después del cambio
 * @param {string} [params.ip] - Dirección IP del cliente (opcional)
 * @returns {Promise<Object>} Registro de auditoría creado
 */
async function registrarAuditoria({
  tenantId,
  userId,
  accion,
  tabla,
  registroId,
  datosBefore,
  datosAfter,
  ip
}) {
  const cambios = calculateDiff(datosBefore, datosAfter)

  const { data, error } = await supabase
    .from('auditoria')
    .insert({
      tenant_id: tenantId,
      usuario_id: userId,
      accion, // 'CREATE', 'UPDATE', 'DELETE'
      tabla_afectada: tabla,
      registro_id: registroId,
      datos_antes: datosBefore,
      datos_despues: datosAfter,
      cambios,
      ip,
      fecha_hora: new Date().toISOString()
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

/**
 * Obtiene el timeline de auditoría para un registro específico
 * @param {Object} params - Parámetros de búsqueda
 * @param {string} params.tenantId - ID del tenant
 * @param {string} params.tabla - Nombre de la tabla
 * @param {string} params.registroId - ID del registro
 * @returns {Promise<Array>} Array de registros de auditoría ordenados por fecha
 */
async function getAuditoriaTimeline({ tenantId, tabla, registroId }) {
  const { data, error } = await supabase
    .from('auditoria')
    .select(`
      *,
      usuarios (
        nombre,
        apellido,
        email
      )
    `)
    .eq('tenant_id', tenantId)
    .eq('tabla_afectada', tabla)
    .eq('registro_id', registroId)
    .order('fecha_hora', { ascending: false })

  if (error) throw new Error(error.message)
  return data
}

/**
 * Obtiene registros de auditoría con filtros opcionales
 * @param {Object} params - Parámetros de búsqueda
 * @param {string} params.tenantId - ID del tenant
 * @param {string} [params.tabla] - Filtrar por tabla (opcional)
 * @param {string} [params.userId] - Filtrar por usuario (opcional)
 * @param {string} [params.accion] - Filtrar por acción (opcional)
 * @param {Date} [params.fechaDesde] - Fecha desde (opcional)
 * @param {Date} [params.fechaHasta] - Fecha hasta (opcional)
 * @param {number} [params.limit] - Límite de registros (default: 100)
 * @returns {Promise<Array>} Array de registros de auditoría
 */
async function getAuditoriaLogs({
  tenantId,
  tabla,
  userId,
  accion,
  fechaDesde,
  fechaHasta,
  limit = 100
}) {
  let query = supabase
    .from('auditoria')
    .select(`
      *,
      usuarios (
        nombre,
        apellido,
        email
      )
    `)
    .eq('tenant_id', tenantId)
    .order('fecha_hora', { ascending: false })
    .limit(limit)

  if (tabla) query = query.eq('tabla_afectada', tabla)
  if (userId) query = query.eq('usuario_id', userId)
  if (accion) query = query.eq('accion', accion)
  if (fechaDesde) query = query.gte('fecha_hora', fechaDesde.toISOString())
  if (fechaHasta) query = query.lte('fecha_hora', fechaHasta.toISOString())

  const { data, error } = await query

  if (error) throw new Error(error.message)
  return data
}

module.exports = {
  registrarAuditoria,
  getAuditoriaTimeline,
  getAuditoriaLogs,
  calculateDiff
}
