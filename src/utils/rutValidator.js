/**
 * Utilidades para validación y normalización de RUT chileno.
 */

/**
 * Normaliza un RUT eliminando puntos y guión.
 * Ej: "12.345.678-9" → "123456789"
 * Ej: "12345678-9"   → "123456789"
 */
const normalizarRut = (rut) => {
  if (!rut) return ''
  return rut.toString().replace(/\./g, '').replace(/-/g, '').trim().toUpperCase()
}

/**
 * Calcula el dígito verificador de un RUT chileno.
 */
const calcularDv = (numero) => {
  let suma = 0
  let multiplo = 2

  for (let i = numero.length - 1; i >= 0; i--) {
    suma += parseInt(numero[i]) * multiplo
    multiplo = multiplo < 7 ? multiplo + 1 : 2
  }

  const resultado = 11 - (suma % 11)
  if (resultado === 11) return '0'
  if (resultado === 10) return 'K'
  return resultado.toString()
}

/**
 * Valida si un RUT chileno es válido.
 * Acepta RUT con o sin puntos y guión.
 * Retorna true si es válido, false si no.
 */
const validarRut = (rut) => {
  if (!rut) return false

  const rutNormalizado = normalizarRut(rut)
  if (rutNormalizado.length < 2) return false

  const numero = rutNormalizado.slice(0, -1)
  const dv     = rutNormalizado.slice(-1)

  if (!/^\d+$/.test(numero)) return false

  return calcularDv(numero) === dv
}

/**
 * Formatea un RUT normalizado para almacenarlo en BD.
 * Ej: "123456789" → "12345678-9"
 */
const formatearRut = (rut) => {
  const normalizado = normalizarRut(rut)
  const numero = normalizado.slice(0, -1)
  const dv     = normalizado.slice(-1)
  return `${numero}-${dv}`
}

module.exports = { normalizarRut, validarRut, formatearRut }
