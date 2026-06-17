const bcrypt = require('bcrypt')
const { supabase } = require('../utils/db')

const ROLES_VALIDOS = ['Administrador', 'Directivo', 'Inspector', 'Docente', 'Equipo de Formación']

/**
 * Campos seguros a retornar — nunca incluir password
 */
const CAMPOS_PUBLICOS = 'id, tenant_id, email, nombre, apellido, rol, activo, fecha_creacion'

/**
 * Lista todos los usuarios activos e inactivos del tenant.
 */
const listarUsuarios = async (tenantId) => {
  const { data, error } = await supabase
    .from('usuarios')
    .select(CAMPOS_PUBLICOS)
    .eq('tenant_id', tenantId)
    .order('apellido', { ascending: true })

  if (error) throw error
  return data
}

/**
 * Obtiene un usuario por ID dentro del tenant.
 */
const obtenerUsuario = async (id, tenantId) => {
  const { data, error } = await supabase
    .from('usuarios')
    .select(CAMPOS_PUBLICOS)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (error || !data) {
    const err = new Error('Usuario no encontrado')
    err.statusCode = 404
    throw err
  }

  return data
}

/**
 * Verifica si un email ya está registrado en el tenant.
 * Opcionalmente excluye un ID para validaciones en edición.
 */
const emailExiste = async (email, tenantId, excludeId = null) => {
  let query = supabase
    .from('usuarios')
    .select('id')
    .eq('email', email.toLowerCase())
    .eq('tenant_id', tenantId)

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data } = await query
  return data && data.length > 0
}

/**
 * Crea un nuevo usuario con contraseña hasheada.
 */
const crearUsuario = async (tenantId, datos) => {
  const { email, password, nombre, apellido, rol } = datos

  // Validar rol
  if (!ROLES_VALIDOS.includes(rol)) {
    const err = new Error(`Rol inválido. Roles permitidos: ${ROLES_VALIDOS.join(', ')}`)
    err.statusCode = 400
    throw err
  }

  // Validar email único en el tenant
  if (await emailExiste(email, tenantId)) {
    const err = new Error('El email ya está registrado en este establecimiento')
    err.statusCode = 409
    throw err
  }

  // Hashear contraseña con bcrypt coste 10
  const passwordHash = await bcrypt.hash(password, 10)

  const { data, error } = await supabase
    .from('usuarios')
    .insert({
      tenant_id: tenantId,
      email:     email.toLowerCase(),
      password:  passwordHash,
      nombre,
      apellido,
      rol,
      activo:    true,
    })
    .select(CAMPOS_PUBLICOS)
    .single()

  if (error) throw error
  return data
}

/**
 * Actualiza los datos de un usuario.
 * No permite actualizar la contraseña por este endpoint.
 */
const actualizarUsuario = async (id, tenantId, datos) => {
  const { email, nombre, apellido, rol } = datos

  // Verificar que el usuario existe
  await obtenerUsuario(id, tenantId)

  // Validar rol si viene en el body
  if (rol && !ROLES_VALIDOS.includes(rol)) {
    const err = new Error(`Rol inválido. Roles permitidos: ${ROLES_VALIDOS.join(', ')}`)
    err.statusCode = 400
    throw err
  }

  // Validar email único excluyendo el propio usuario
  if (email && await emailExiste(email, tenantId, id)) {
    const err = new Error('El email ya está registrado en este establecimiento')
    err.statusCode = 409
    throw err
  }

  const update = {}
  if (nombre)   update.nombre   = nombre
  if (apellido) update.apellido = apellido
  if (rol)      update.rol      = rol
  if (email)    update.email    = email.toLowerCase()

  const { data, error } = await supabase
    .from('usuarios')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select(CAMPOS_PUBLICOS)
    .single()

  if (error) throw error
  return data
}

/**
 * Desactiva un usuario (baja lógica).
 * Valida que no sea el último administrador activo del tenant.
 */
const desactivarUsuario = async (id, tenantId) => {
  // Verificar que el usuario existe y está activo
  const usuario = await obtenerUsuario(id, tenantId)

  if (!usuario.activo) {
    const err = new Error('El usuario ya está desactivado')
    err.statusCode = 400
    throw err
  }

  // Si es Administrador, verificar que no sea el último activo
  if (usuario.rol === 'Administrador') {
    const { data: admins } = await supabase
      .from('usuarios')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('rol', 'Administrador')
      .eq('activo', true)

    if (admins && admins.length <= 1) {
      const err = new Error('No se puede desactivar el único administrador activo del establecimiento')
      err.statusCode = 400
      throw err
    }
  }

  const { data, error } = await supabase
    .from('usuarios')
    .update({ activo: false })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select(CAMPOS_PUBLICOS)
    .single()

  if (error) throw error
  return data
}

module.exports = {
  listarUsuarios,
  obtenerUsuario,
  crearUsuario,
  actualizarUsuario,
  desactivarUsuario,
}
