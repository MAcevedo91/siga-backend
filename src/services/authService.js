const bcrypt   = require('bcrypt')
const jwt      = require('jsonwebtoken')
const { supabase } = require('../utils/db')

const MAX_INTENTOS   = 5
const BLOQUEO_MINUTOS = 15

/**
 * Busca un usuario activo por email dentro de un tenant.
 * Retorna null si no existe.
 */
const findUserByEmail = async (email) => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, tenant_id, email, password, nombre, apellido, rol, activo, intentos_fallidos, bloqueado_hasta')
    .eq('email', email)
    .eq('activo', true)
    .single()

  if (error || !data) return null
  return data
}

/**
 * Verifica si la cuenta está bloqueada en este momento.
 */
const isBloqueado = (usuario) => {
  if (!usuario.bloqueado_hasta) return false
  return new Date(usuario.bloqueado_hasta) > new Date()
}

/**
 * Incrementa intentos fallidos.
 * Si llega a MAX_INTENTOS, bloquea la cuenta por BLOQUEO_MINUTOS.
 */
const registrarIntentoFallido = async (usuario) => {
  const nuevosIntentos = usuario.intentos_fallidos + 1
  const update = { intentos_fallidos: nuevosIntentos }

  if (nuevosIntentos >= MAX_INTENTOS) {
    const bloqueadoHasta = new Date()
    bloqueadoHasta.setMinutes(bloqueadoHasta.getMinutes() + BLOQUEO_MINUTOS)
    update.bloqueado_hasta = bloqueadoHasta.toISOString()
  }

  await supabase
    .from('usuarios')
    .update(update)
    .eq('id', usuario.id)
}

/**
 * Resetea los intentos fallidos y el bloqueo tras login exitoso.
 */
const resetearIntentos = async (usuarioId) => {
  await supabase
    .from('usuarios')
    .update({ intentos_fallidos: 0, bloqueado_hasta: null })
    .eq('id', usuarioId)
}

/**
 * Genera un JWT con el payload del usuario.
 * Expira en 8 horas.
 */
const generarToken = (usuario) => {
  const payload = {
    user_id:   usuario.id,
    tenant_id: usuario.tenant_id,
    rol:       usuario.rol,
    email:     usuario.email,
  }

  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' })
}

/**
 * Lógica principal de login.
 * Retorna { token, user } en éxito o lanza un error con statusCode.
 */
const login = async (email, password) => {
  // 1. Validar que vengan los campos
  if (!email || !password) {
    const err = new Error('Email y contraseña son requeridos')
    err.statusCode = 400
    throw err
  }

  // 2. Buscar usuario
  const usuario = await findUserByEmail(email)

  if (!usuario) {
    // No revelar si el email existe o no (seguridad)
    const err = new Error('Credenciales incorrectas')
    err.statusCode = 401
    throw err
  }

  // 3. Verificar bloqueo
  if (isBloqueado(usuario)) {
    const err = new Error('Cuenta bloqueada temporalmente. Intenta nuevamente en 15 minutos.')
    err.statusCode = 403
    throw err
  }

  // 4. Verificar contraseña
  const passwordValida = await bcrypt.compare(password, usuario.password)

  if (!passwordValida) {
    await registrarIntentoFallido(usuario)
    const err = new Error('Credenciales incorrectas')
    err.statusCode = 401
    throw err
  }

  // 5. Login exitoso → resetear intentos y generar token
  await resetearIntentos(usuario.id)
  const token = generarToken(usuario)

  return {
    token,
    user: {
      id:       usuario.id,
      nombre:   usuario.nombre,
      apellido: usuario.apellido,
      email:    usuario.email,
      rol:      usuario.rol,
    },
  }
}

/**
 * Retorna los datos del usuario autenticado por su ID.
 */
const getMe = async (userId) => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, tenant_id, nombre, apellido, email, rol')
    .eq('id', userId)
    .eq('activo', true)
    .single()

  if (error || !data) {
    const err = new Error('Usuario no encontrado')
    err.statusCode = 404
    throw err
  }

  return data
}

module.exports = { login, getMe }
