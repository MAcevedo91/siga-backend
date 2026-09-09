/**
 * API Versioning Middleware
 *
 * Extracts API version from URL path (/api/v1, /api/v2)
 * Defaults to v1 if no version specified
 */
function apiVersion(req, res, next) {
  const versionMatch = req.path.match(/^\/api\/(v\d+)/)

  if (versionMatch) {
    req.apiVersion = versionMatch[1] // 'v1', 'v2', etc.
  } else {
    req.apiVersion = 'v1' // Default to v1
  }

  next()
}

module.exports = apiVersion
