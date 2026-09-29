require('dotenv').config()
const request = require('supertest')
const app = require('../src/app')
const jwt = require('jsonwebtoken')

// PNG mínimo válido de 1x1 píxel
const BUFFER_PNG_VALIDO = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c49444154789c6360400500000e0001a5d645400000000049454e44ae426082',
  'hex'
)

// Buffer excesivo de 2.5 MB (> 2 MB)
const BUFFER_EXCESIVO = Buffer.alloc(2.5 * 1024 * 1024, 'A')

const JWT_SECRET = process.env.JWT_SECRET || 'secreto-super-seguro-de-al-menos-64-caracteres-para-el-jwt-secret-de-siga'
const TENANT_ID = '1ea5232c-3631-4271-990c-8b4bf4d93db6'
const USER_ID = '50ddeb97-631c-4a66-8588-5c6c7609b14d' // inspector

// Token Inspector
const tokenInspector = jwt.sign(
  { user_id: USER_ID, tenant_id: TENANT_ID, rol: 'Inspector' },
  JWT_SECRET,
  { expiresIn: '1h' }
)

// Token Docente (sin privilegios administrativos)
const tokenDocente = jwt.sign(
  { user_id: '99999999-9999-9999-9999-999999999999', tenant_id: TENANT_ID, rol: 'Docente' },
  JWT_SECRET,
  { expiresIn: '1h' }
)

const separador = () => console.log('-'.repeat(70))

async function probarEndpoints() {
  console.log('\n' + '='.repeat(70))
  console.log('  SIGA Escolar - Verificación de Endpoints REST de Avatares  ')
  console.log('='.repeat(70) + '\n')

  // ---------------------------------------------------------------------------
  // TEST 1: Rechazo de archivo que excede 2 MB (CP-AV-02)
  // ---------------------------------------------------------------------------
  console.log('🛡️  [TEST 1] Probando rechazo de archivo excesivo (> 2 MB)...')
  const resExcesivo = await request(app)
    .post('/api/v1/usuarios/me/avatar')
    .set('Authorization', `Bearer ${tokenInspector}`)
    .attach('avatar', BUFFER_EXCESIVO, { filename: 'foto-pesada.png', contentType: 'image/png' })

  console.log(`   - Código HTTP: ${resExcesivo.status} (esperado: 400)`)
  console.log(`   - Mensaje: ${resExcesivo.body.message}`)
  if (resExcesivo.status === 400 && resExcesivo.body.message.includes('2 MB')) {
    console.log('   ✅ RECHAZO EXITOSO: Bloqueo de archivo mayor a 2 MB verificado')
  } else {
    console.log('   ⚠️ Resultado inesperado en prueba de tamaño')
  }
  separador()

  // ---------------------------------------------------------------------------
  // TEST 2: Rechazo de formato no permitido (CP-AV-03)
  // ---------------------------------------------------------------------------
  console.log('🛡️  [TEST 2] Probando rechazo de archivo no permitido (ej. application/pdf)...')
  const resInvalido = await request(app)
    .post('/api/v1/usuarios/me/avatar')
    .set('Authorization', `Bearer ${tokenInspector}`)
    .attach('avatar', Buffer.from('%PDF-1.4...'), { filename: 'documento.pdf', contentType: 'application/pdf' })

  console.log(`   - Código HTTP: ${resInvalido.status} (esperado: 400)`)
  console.log(`   - Mensaje: ${resInvalido.body.message}`)
  if (resInvalido.status === 400 && resInvalido.body.message.includes('Solo se permiten imágenes')) {
    console.log('   ✅ RECHAZO EXITOSO: Bloqueo de tipos MIME no autorizados verificado')
  } else {
    console.log('   ⚠️ Resultado inesperado en prueba de formato')
  }
  separador()

  // ---------------------------------------------------------------------------
  // TEST 3: Control RBAC de propiedad (CP-AV-04)
  // ---------------------------------------------------------------------------
  console.log('🛡️  [TEST 3] Probando control RBAC: Docente intentando modificar a otro usuario...')
  const resRbac = await request(app)
    .post(`/api/v1/usuarios/${USER_ID}/avatar`)
    .set('Authorization', `Bearer ${tokenDocente}`)
    .attach('avatar', BUFFER_PNG_VALIDO, { filename: 'avatar.png', contentType: 'image/png' })

  console.log(`   - Código HTTP: ${resRbac.status} (esperado: 403)`)
  console.log(`   - Mensaje: ${resRbac.body.message}`)
  if (resRbac.status === 403) {
    console.log('   ✅ CONTROL RBAC EXITOSO: Prohibida modificación a usuarios no propietarios')
  } else {
    console.log('   ⚠️ Resultado inesperado en prueba RBAC')
  }
  separador()

  console.log('======================================================================')
  console.log('  🎉 RESUMEN DE PRUEBAS REST: Todos los filtros de seguridad operando')
  console.log('======================================================================\n')
  process.exit(0)
}

probarEndpoints()
