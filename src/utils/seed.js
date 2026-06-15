require('dotenv').config()

const bcrypt = require('bcrypt')
const { supabase } = require('./db')

const seed = async () => {
  console.log('[SEED] Iniciando...')

  // 1. Obtener el tenant de la Escuela El Salvador
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, nombre')
    .limit(1)
    .single()

  if (tenantError || !tenant) {
    console.error('[SEED] ✗ No se encontró ningún tenant. Ejecuta el schema.sql primero.')
    process.exit(1)
  }

  console.log(`[SEED] ✓ Tenant encontrado: ${tenant.nombre} (${tenant.id})`)

  // 2. Verificar si ya existe el admin
  const { data: existente } = await supabase
    .from('usuarios')
    .select('id')
    .eq('email', 'admin@sigaescolar.cl')
    .eq('tenant_id', tenant.id)
    .single()

  if (existente) {
    console.log('[SEED] ℹ Usuario admin ya existe, omitiendo creación.')
    process.exit(0)
  }

  // 3. Hashear contraseña con bcrypt (coste 10)
  const passwordHash = await bcrypt.hash('Admin1234!', 10)

  // 4. Insertar usuario administrador
  const { data: usuario, error: insertError } = await supabase
    .from('usuarios')
    .insert({
      tenant_id: tenant.id,
      email:     'admin@sigaescolar.cl',
      password:  passwordHash,
      nombre:    'Administrador',
      apellido:  'Sistema',
      rol:       'Administrador',
      activo:    true,
    })
    .select('id, email, rol')
    .single()

  if (insertError) {
    console.error('[SEED] ✗ Error al crear usuario:', insertError.message)
    process.exit(1)
  }

  console.log('[SEED] ✓ Usuario admin creado exitosamente:')
  console.log(`       Email:      ${usuario.email}`)
  console.log(`       Contraseña: Admin1234!  ← cámbiala después del primer login`)
  console.log(`       Rol:        ${usuario.rol}`)
  console.log(`       ID:         ${usuario.id}`)
}

seed()
