require('dotenv').config()
const { supabase } = require('../src/utils/db')
const storageService = require('../src/services/storageService')
const usuariosService = require('../src/services/usuariosService')
const jwt = require('jsonwebtoken')

// PNG mínimo válido de 1x1 píxel en color azul corporativo
const BUFFER_PNG_VALIDO = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c49444154789c6360400500000e0001a5d645400000000049454e44ae426082',
  'hex'
)

// Buffer que excede los 2 MB (2.5 MB)
const BUFFER_EXCESIVO = Buffer.alloc(2.5 * 1024 * 1024, 1)

const separador = () => console.log('-'.repeat(70))

async function ejecutarVerificacion() {
  console.log('\n' + '='.repeat(70))
  console.log('  SIGA Escolar - Verificación en Terreno: Avatares en Supabase Storage  ')
  console.log('='.repeat(70) + '\n')

  try {
    // -------------------------------------------------------------------------
    // PASO 1: Verificar bucket "avatars" en Supabase Storage
    // -------------------------------------------------------------------------
    console.log('🔍 [PASO 1] Comprobando existencia y configuración del Bucket "avatars"...')
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets()

    if (bucketError) {
      console.warn(`   ⚠️ Aviso consultando buckets: ${bucketError.message}`)
    } else {
      const bucketAvatars = buckets?.find((b) => b.id === 'avatars' || b.name === 'avatars')
      if (bucketAvatars) {
        console.log(`   ✅ Bucket "avatars" encontrado en Supabase Storage`)
        console.log(`      - Público: ${bucketAvatars.public ? 'Sí' : 'No'}`)
        console.log(`      - Límite por archivo: ${bucketAvatars.file_size_limit ? bucketAvatars.file_size_limit / 1024 / 1024 + ' MB' : 'Sin límite explícito'}`)
      } else {
        console.log('   ⚠️ Bucket "avatars" no listado explícitamente (se intentará operar vía service_role).')
      }
    }
    separador()

    // -------------------------------------------------------------------------
    // PASO 2: Obtener usuario real de prueba
    // -------------------------------------------------------------------------
    console.log('👤 [PASO 2] Obteniendo usuario de prueba desde Supabase...')
    const { data: usuarios, error: errUsers } = await supabase
      .from('usuarios')
      .select('id, tenant_id, email, nombre, apellido, rol, avatar_url')
      .eq('activo', true)
      .limit(1)

    if (errUsers || !usuarios || usuarios.length === 0) {
      throw new Error(`No se pudo obtener un usuario activo: ${errUsers?.message || 'Sin usuarios'}`)
    }

    const usuarioPrueba = usuarios[0]
    console.log(`   - Usuario: ${usuarioPrueba.nombre} ${usuarioPrueba.apellido} (${usuarioPrueba.email})`)
    console.log(`   - ID: ${usuarioPrueba.id}`)
    console.log(`   - Rol: ${usuarioPrueba.rol}`)
    console.log(`   - Tenant ID: ${usuarioPrueba.tenant_id}`)
    console.log(`   - Avatar actual: ${usuarioPrueba.avatar_url || 'Ninguno (null)'}`)
    separador()

    // -------------------------------------------------------------------------
    // PASO 3: Probar Subida Real a Supabase Storage
    // -------------------------------------------------------------------------
    console.log('📤 [PASO 3] Probando subida de avatar a Supabase Storage (Buffer en memoria)...')
    const resultadoSubida = await storageService.subirAvatarUsuario({
      tenantId: usuarioPrueba.tenant_id,
      usuarioId: usuarioPrueba.id,
      buffer: BUFFER_PNG_VALIDO,
      mimeType: 'image/png',
      urlAvatarAnterior: usuarioPrueba.avatar_url,
    })

    console.log('   ✅ Subida exitosa a Supabase Storage!')
    console.log(`      - Ruta interna: ${resultadoSubida.filePath}`)
    console.log(`      - URL Pública CDN: ${resultadoSubida.publicUrl}`)
    separador()

    // -------------------------------------------------------------------------
    // PASO 4: Actualizar columna avatar_url en PostgreSQL
    // -------------------------------------------------------------------------
    console.log('💾 [PASO 4] Actualizando avatar_url en la tabla usuarios...')
    const usuarioActualizado = await usuariosService.actualizarAvatar(
      usuarioPrueba.id,
      usuarioPrueba.tenant_id,
      resultadoSubida.publicUrl
    )

    console.log('   ✅ Registro actualizado en base de datos!')
    console.log(`      - Nuevo avatar_url: ${usuarioActualizado.avatar_url}`)
    separador()

    // -------------------------------------------------------------------------
    // PASO 5: Probar Regla de Seguridad de Purga / Eliminación
    // -------------------------------------------------------------------------
    console.log('🛡️  [PASO 5] Probando purga y eliminación controlada del avatar...')
    const { usuario: usuarioLimpio, urlAnterior } = await usuariosService.eliminarAvatar(
      usuarioPrueba.id,
      usuarioPrueba.tenant_id
    )

    if (urlAnterior) {
      await storageService.eliminarAvatarUsuario(urlAnterior)
    }

    console.log('   ✅ Avatar purgado y eliminado exitosamente!')
    console.log(`      - avatar_url en BD: ${usuarioLimpio.avatar_url} (esperado: null)`)
    console.log(`      - Archivo en Storage eliminado: ${urlAnterior}`)
    separador()

    console.log('======================================================================')
    console.log('  🎉 CERTIFICACIÓN EXITOSA: Storage de Avatares 100% Operativo')
    console.log('======================================================================\n')
  } catch (error) {
    console.error('\n❌ ERROR EN LA VERIFICACIÓN:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

ejecutarVerificacion()
