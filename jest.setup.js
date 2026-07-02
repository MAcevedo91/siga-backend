// Set required environment variables for tests
process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_KEY = 'test-service-key'
process.env.NODE_ENV = 'test'

// Mock isomorphic-dompurify to avoid ESM issues in Jest
// Simple sanitization that removes script tags and dangerous attributes
jest.mock('isomorphic-dompurify', () => ({
  sanitize: jest.fn((input) => {
    if (typeof input !== 'string') return input
    // Remove script tags and their content
    let cleaned = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove on* event handlers
    cleaned = cleaned.replace(/\son\w+="[^"]*"/gi, '')
    cleaned = cleaned.replace(/\son\w+='[^']*'/gi, '')
    return cleaned
  })
}))
