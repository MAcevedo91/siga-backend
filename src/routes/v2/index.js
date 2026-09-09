const express = require('express')
const router = express.Router()

// =============================================================================
// V2 ROUTES (FUTURE)
// =============================================================================
// Breaking changes, new response formats, and major API changes will go here
// Examples:
// - New authentication mechanism
// - Different response structure
// - Breaking field name changes

// Health check endpoint for v2
router.get('/health', (req, res) => {
  res.json({
    version: 'v2',
    status: 'ok',
    message: 'V2 API is available but not yet implemented',
    timestamp: new Date().toISOString()
  })
})

module.exports = router
