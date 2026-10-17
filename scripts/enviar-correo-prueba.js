require('dotenv').config()
const fs = require('fs')
const path = require('path')
const nodemailer = require('nodemailer')
const { renderInformeOficialApoderadoTemplate } = require('../src/utils/emailTemplates')

async function ejecutarPruebaCorreo() {
  console.log('\n======================================================================')
  console.log('  SIGA Escolar - Verificación y Despacho de Correo (Tarea 6.4.1)       ')
  console.log('======================================================================\n')

  const destinatario = 'mrcl.ao.sa@gmail.com'
  const colegioNombre = 'Escuela Coeducacional N° 1 El Salvador'
  const apoderadoNombre = 'Marcelo Acevedo (Apoderado Titular)'
  const estudianteNombre = 'Juan Pérez'
  const folio = 'INF-2026-0055AACB'
  const fechaIncidente = '29 de septiembre de 2026'
  const fechaAprobacion = '29 de septiembre de 2026'

  console.log(`📬 Destinatario objetivo: ${destinatario}`)
  console.log(`📋 Estudiante: ${estudianteNombre}`)
  console.log(`📑 Folio asignado: ${folio}`)
  console.log('----------------------------------------------------------------------\n')

  // 1. Compilar plantilla HTML institucional
  const htmlContenido = renderInformeOficialApoderadoTemplate({
    apoderadoNombre,
    estudianteNombre,
    colegioNombre,
    folio,
    fechaIncidente,
    fechaAprobacion,
  })

  // 2. Guardar vista previa local para inspección visual inmediata
  const rutaHtml = path.join(__dirname, '..', 'correo-apoderado-vista-previa.html')
  fs.writeFileSync(rutaHtml, htmlContenido, 'utf-8')
  console.log(`👁️  VISTA PREVIA LOCAL GENERADA:`)
  console.log(`   - Archivo HTML: ${rutaHtml}`)
  console.log(`   - Puedes abrirlo directamente con: xdg-open ${rutaHtml}\n`)

  // 3. Obtener el archivo PDF físico generado previamente
  const rutaPdf = path.join(__dirname, '..', 'reporte-oficial-prueba.pdf')
  let pdfBuffer = null
  if (fs.existsSync(rutaPdf)) {
    pdfBuffer = fs.readFileSync(rutaPdf)
    console.log(`📎 Adjunto PDF detectado: ${rutaPdf} (${(pdfBuffer.length / 1024).toFixed(1)} KB)`)
  } else {
    console.log(`⚠️  No se encontró ${rutaPdf}, se enviará sin adjunto.`)
  }
  console.log('----------------------------------------------------------------------\n')

  // 4. Evaluar estado de configuración SMTP para entrega a bandeja de entrada
  const smtpHost = process.env.SMTP_HOST
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  const smtpPort = parseInt(process.env.SMTP_PORT || '587')

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.log('⚠️  [ESTADO SMTP]: No se han configurado credenciales SMTP salientes en .env')
    console.log('   Para que el correo viaje a través de internet y llegue a tu bandeja de Gmail:')
    console.log('   Debes configurar en siga-backend/.env las credenciales del servidor de correo:')
    console.log('\n   Ejemplo con Gmail (requiere "Contraseña de aplicación" de 16 letras):')
    console.log('     SMTP_HOST=smtp.gmail.com')
    console.log('     SMTP_PORT=465')
    console.log('     SMTP_SECURE=true')
    console.log('     SMTP_USER=tu_cuenta@gmail.com')
    console.log('     SMTP_PASS=tu_clave_de_aplicacion_16_caracteres')
    console.log('     SMTP_FROM="SIGA Escolar <tu_cuenta@gmail.com>"')
    console.log('\n   Mientras tanto, puedes verificar el correo generado 100% idéntico abriendo:')
    console.log(`   xdg-open ${rutaHtml}\n`)
    process.exit(0)
  }

  // 5. Enviar a través de SMTP si está configurado
  console.log(`🚀 Conectando a servidor SMTP ${smtpHost}:${smtpPort}...`)
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: process.env.SMTP_SECURE === 'true' || smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  })

  const mailOptions = {
    from: process.env.SMTP_FROM || `"SIGA Escolar - Escuela El Salvador" <${smtpUser}>`,
    to: destinatario,
    subject: `[SIGA Escolar] Informe Oficial de Convivencia Escolar — ${estudianteNombre} (Folio: ${folio})`,
    html: htmlContenido,
    attachments: pdfBuffer
      ? [
          {
            filename: `Informe_Oficial_${folio}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ]
      : [],
  }

  try {
    const info = await transporter.sendMail(mailOptions)
    console.log(`✅ CORREO ENVIADO EXITOSAMENTE A TU BANDEJA:`)
    console.log(`   - Message ID: ${info.messageId}`)
    console.log(`   - Destinatario: ${destinatario}`)
    console.log(`   - Adjunto: Informe_Oficial_${folio}.pdf`)
    console.log('   ¡Revisa tu bandeja de entrada o spam en mrcl.ao.sa@gmail.com!')
  } catch (sendErr) {
    console.error(`❌ Error al despachar vía SMTP:`, sendErr.message)
  }

  process.exit(0)
}

ejecutarPruebaCorreo().catch((err) => {
  console.error('\n❌ Error en prueba de correo:', err)
  process.exit(1)
})
