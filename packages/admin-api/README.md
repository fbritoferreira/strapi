# Strapi Admin API

Plugin to manage Strapi admin users and authentication tokens through REST API endpoints.

## Quick Start

```bash
# Install
npm install @fbritoferreira/strapi-admin-api

# Get admin JWT token
curl -X POST http://localhost:1337/admin/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "password"}' | jq -r '.jwt'
```

For full API documentation, see [admin-api documentation](https://strapi.fbritoferreira.com/packages/admin-api/) which includes:
- Complete API reference
- Authentication guide
- CRUD operations for users
- Token management
- RBAC configuration
- Security best practices
- Usage examples
