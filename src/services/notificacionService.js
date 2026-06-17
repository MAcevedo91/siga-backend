const { supabase } = require('../utils/db')

/**
 * Crea alertas internas para todos los Administradores y Coordinadores
 * del tenant cuando se registra un incidente Grave o Gravísimo (RF-07).
 * Fire-and-forget — no bloquea la respuesta al cliente.
 */
const crearAlerta = async (incidente, tenantId) => {
  try {
    // Obtener nombre del primer estudiante involucrado para el mensaje
    const nombreEstudiante = incidente.estudiante_nombre || 'Estudiante'

    // Buscar destinatarios: Administrador y Equipo de Formación (Coordinador)
    const { data: destinatarios, error } = await supabase
      .from('usuarios')
      .select('id, email, nombre, apellido')
      .eq('tenant_id', tenantId)
      .eq('activo', true)
      .in('rol', ['Administrador', 'Equipo de Formación'])

    if (error || !destinatarios?.length) return

    const mensaje = `Incidente ${incidente.gravedad} registrado el ${incidente.fecha} — Estudiante: ${nombreEstudiante}`

    // Insertar una notificación por cada destinatario
    const notificaciones = destinatarios.map(usuario => ({
      tenant_id:    tenantId,
      incidente_id: incidente.id,
      destinatario: `${usuario.nombre} ${usuario.apellido} <${usuario.email}>`,
      canal:        'interno',
      mensaje,
      enviada:      false,
    }))

    await supabase.from('notificaciones').insert(notificaciones)

    console.log(`[NOTIF] ${notificaciones.length} alerta(s) creada(s) para incidente ${incidente.id}`)
  } catch (err) {
    console.error('[NOTIF] Error al crear alertas:', err.message)
  }
}

module.exports = { crearAlerta }
