require('dotenv').config()
const { enviarEmail } = require('./src/services/emailService')
require('./src/workers/emailWorker') // Start worker

async function test() {
  try {
    console.log('Adding email job to queue...')

    await enviarEmail({
      to: 'test@example.com',
      subject: 'Test Email',
      html: '<p>This is a test email from SIGA Escolar</p>'
    })

    console.log('Email job added to queue successfully')
    console.log('Worker will process the email...')

    // Wait for processing
    setTimeout(() => {
      console.log('Check logs above for processing result')
      process.exit(0)
    }, 5000)
  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

test()
