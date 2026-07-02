# API Versioning Guide

## Overview

SIGA Escolar API uses URL-based versioning for backward compatibility and clear API evolution.

## Current Versions

- **v1** (default): Stable, production-ready API
- **v2** (future): Reserved for breaking changes and new features

## URL Structure

### Versioned Endpoints
```
/api/v1/estudiantes
/api/v1/incidentes
/api/v1/protocolos
/api/v1/usuarios
/api/v1/notificaciones
/api/v1/analytics
/api/v1/search
/api/v1/dashboard
/api/v1/auth
/api/v1/health
```

### Future v2 Endpoints
```
/api/v2/estudiantes  (planned)
/api/v2/health       (available now for testing)
```

## Backward Compatibility

Legacy URLs without explicit version default to v1 for smooth migration:

```bash
# Legacy format (still works)
/api/estudiantes → /api/v1/estudiantes

# Recommended format (explicit version)
/api/v1/estudiantes
```

**Important:** All new integrations should use explicit versioning (`/api/v1/...`) to avoid ambiguity.

## Migration Strategy

### Phase 1: Current (v1 Stabilization)
1. ✅ All existing endpoints are now under `/api/v1`
2. ✅ Legacy `/api/*` routes redirect to `/api/v1/*`
3. 🔄 Frontend should update to use `/api/v1` explicitly
4. 🔄 Mobile apps should update to use `/api/v1` explicitly

### Phase 2: v2 Introduction (Future)
1. V2 endpoints will be added incrementally
2. Both v1 and v2 will run simultaneously
3. V1 will be maintained for at least **6 months** after v2 launch
4. Deprecation warnings will be added to v1 responses before sunset

### Phase 3: v1 Deprecation (Future)
1. Add `X-API-Deprecation` header to v1 responses
2. Update documentation with migration guide
3. Notify all API consumers via email/notifications
4. Monitor v1 usage metrics

### Phase 4: v1 Sunset (Future)
1. Remove v1 endpoints after grace period
2. Return 410 Gone status for v1 requests
3. Provide migration resources in error messages

## Version Lifecycle

```
┌─────────┐      ┌────────────┐      ┌────────┐
│ Active  │ ---> │ Deprecated │ ---> │ Sunset │
└─────────┘      └────────────┘      └────────┘
  6+ months         3-6 months         Removed
```

### Active
- Fully supported and maintained
- Receives bug fixes and security patches
- New features may be added (non-breaking only)
- Recommended for all new integrations

### Deprecated
- Still functional but discouraged
- Only critical bug fixes
- Returns deprecation headers
- Migration guide provided

### Sunset
- Endpoints removed from API
- Returns 410 Gone status
- Error messages include migration resources

## Breaking Changes Policy

### Requires New Major Version (v1 → v2)
- ❌ Response structure changes
- ❌ Required field additions to request body
- ❌ Field type changes (string → number)
- ❌ Endpoint removal or rename
- ❌ Authentication mechanism changes
- ❌ Error response format changes

### Allowed in Existing Version
- ✅ New optional fields in request
- ✅ New fields in response (additive)
- ✅ New endpoints
- ✅ Performance improvements
- ✅ Bug fixes
- ✅ Enhanced validation (if backward compatible)

## API Version Detection

### Middleware Implementation
The `apiVersion` middleware extracts version from URL:

```javascript
// Request to /api/v1/estudiantes
req.apiVersion = 'v1'

// Request to /api/v2/estudiantes
req.apiVersion = 'v2'

// Request to /api/estudiantes (legacy)
req.apiVersion = 'v1' // Default
```

### Client-Side Header (Optional)
Clients can send API version preference via header:

```http
X-API-Version: v1
```

This is informational only; URL-based version takes precedence.

## Frontend Integration

### Environment Configuration
```bash
# .env
VITE_API_URL=http://localhost:3000/api/v1
```

### Axios Configuration
```javascript
// src/services/api.js
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
  headers: {
    'Content-Type': 'application/json'
  }
})

// Add API version header for tracking
api.interceptors.request.use(config => {
  config.headers['X-API-Version'] = 'v1'
  return config
})

export default api
```

## Testing Versioned Endpoints

### Health Check
```bash
# V1 (explicit)
curl http://localhost:3000/api/v1/health

# V2 (future)
curl http://localhost:3000/api/v2/health

# Legacy (defaults to v1)
curl http://localhost:3000/api/health
```

### Authenticated Endpoints
```bash
# V1 endpoint
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/v1/estudiantes

# Legacy endpoint (redirects to v1)
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/estudiantes
```

## Monitoring and Metrics

### Key Metrics to Track
- Request count per API version
- Error rates per version
- Response times per version
- Client adoption of new versions
- Usage of deprecated endpoints

### Logging
All requests include version information in logs:
```json
{
  "method": "GET",
  "path": "/api/v1/estudiantes",
  "apiVersion": "v1",
  "statusCode": 200
}
```

## Best Practices

### For API Consumers
1. **Always use explicit versioning** (`/api/v1/...`) in production
2. **Monitor deprecation headers** in responses
3. **Test against new versions** before migration
4. **Update all clients** simultaneously when possible
5. **Handle version errors gracefully** (410 Gone, etc.)

### For API Developers
1. **Never break v1 contracts** - create v2 instead
2. **Document all changes** in changelogs
3. **Provide migration guides** for breaking changes
4. **Maintain backward compatibility** for reasonable period
5. **Test both versions** in CI/CD pipeline

## Example: Migrating from v1 to v2 (Future)

### v1 Response (Current)
```json
{
  "status": "success",
  "data": {
    "id": 1,
    "nombre": "Juan",
    "apellido": "Pérez"
  }
}
```

### v2 Response (Hypothetical Breaking Change)
```json
{
  "success": true,
  "result": {
    "id": 1,
    "fullName": "Juan Pérez",
    "metadata": {
      "createdAt": "2025-01-01T00:00:00Z"
    }
  }
}
```

### Migration Code
```javascript
// Before (v1)
const response = await api.get('/api/v1/estudiantes/1')
const { data } = response.data

// After (v2)
const response = await api.get('/api/v2/estudiantes/1')
const { result } = response.data
```

## Support and Resources

- **Documentation**: `/docs/API_VERSIONING.md`
- **Changelog**: `/CHANGELOG.md`
- **Migration Guides**: `/docs/migrations/`
- **Support**: Contact API team for assistance

## Version History

| Version | Release Date | Status | Sunset Date |
|---------|-------------|--------|-------------|
| v1      | 2025-07-01  | Active | TBD         |
| v2      | TBD         | Planned| N/A         |

---

*Last updated: 2025-07-01*
