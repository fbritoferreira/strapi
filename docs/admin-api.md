---
theme: strapi
layout: docs
title: Strapi Admin API
description: Plugin to manage Strapi admin users and tokens via REST API
---

# Strapi Admin API Plugin

Plugin to manage Strapi admin users and authentication tokens through REST API endpoints.

## Overview

The Strapi Admin API plugin provides a secure, programmatic way to manage admin users and their authentication tokens in Strapi applications.

### Features

- ✅ Full CRUD operations for admin users
- ✅ Token management (create, read, update, delete, revoke, refresh)
- ✅ Built-in authentication using admin JWT tokens
- ✅ Role-based access control (RBAC)
- ✅ Password hashing with secure random generation
- ✅ Token expiration management
- ✅ Super-admin protection
- ✅ Audit trail integration

### Why This Plugin?

This plugin fills a gap in the Strapi ecosystem:
- No official GA plugin exists for admin user management via API
- Previous solutions only worked for initialization or were deprecated
- Admin users are managed separately from content users in Strapi
- This plugin provides a standardized, secure API surface

## Installation

```bash
npm install @fbritoferreira/strapi-admin-api
# or
pnpm add @fbritoferreira/strapi-admin-api
# or
yarn add @fbritoferreira/strapi-admin-api
```

## Configuration

Enable the plugin in `config/plugins.ts`:

```typescript
// config/plugins.ts
export default ({ env }) => ({
  'admin-api': {
    enabled: true,
    config: {
      // Plugin-specific configuration
      // See Advanced Configuration below
    },
  },
});
```

## Authentication

All endpoints require an admin JWT token. Obtain it by:

1. Logging into the Strapi Admin Panel at `/admin`
2. Using the JWT from your session
3. Or using the Admin Panel API's `/auth/admin/login` endpoint

### Example: Get Admin JWT

```bash
curl -X POST http://localhost:1337/admin/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your_password"
  }' | jq -r '.jwt'
```

Store the JWT and use it in subsequent requests:

```bash
curl http://localhost:1337/admin-api/users \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## API Reference

### Base URL

```
http://localhost:1337/admin-api
```

### Common Headers

```http
Content-Type: application/json
Authorization: Bearer YOUR_ADMIN_JWT_TOKEN
```

---

## Users API

### List All Admin Users

**GET** `/admin-api/users`

Lists all admin users with optional pagination and filtering.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `populate` | string | Populate related data (default: `[]`) |
| `sort` | string | Sort field (default: `createdAt:desc`) |
| `start` | number | Pagination start index |
| `limit` | number | Pagination limit |

#### Example

```bash
curl -X GET http://localhost:1337/admin-api/users \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Response

```json
{
  "data": [
    {
      "id": 1,
      "email": "admin@example.com",
      "username": "admin",
      "firstName": "Admin",
      "lastName": "User",
      "isActive": true,
      "blocked": false,
      "role": {
        "id": 1,
        "name": "Super Admin",
        "code": "super-admin"
      },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "total": 1,
      "page": 1,
      "pageSize": 25
    }
  }
}
```

### Get Single Admin User

**GET** `/admin-api/users/:id`

Returns a single admin user by ID.

#### Example

```bash
curl -X GET http://localhost:1337/admin-api/users/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Response

```json
{
  "id": 1,
  "email": "admin@example.com",
  "username": "admin",
  "firstName": "Admin",
  "lastName": "User",
  "isActive": true,
  "blocked": false,
  "role": {
    "id": 1,
    "name": "Super Admin",
    "code": "super-admin"
  },
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### Create Admin User

**POST** `/admin-api/users`

Creates a new admin user.

#### Request Body

```json
{
  "email": "newadmin@example.com",
  "username": "newadmin",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe",
  "isActive": true,
  "role": {
    "id": 2,
    "name": "Editor",
    "code": "editor"
  }
}
```

#### Example

```bash
curl -X POST http://localhost:1337/admin-api/users \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newadmin@example.com",
    "username": "newadmin",
    "password": "securePassword123",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

#### Response

```json
{
  "id": 2,
  "email": "newadmin@example.com",
  "username": "newadmin",
  "firstName": "John",
  "lastName": "Doe",
  "isActive": true,
  "blocked": false,
  "role": {
    "id": 2,
    "name": "Super Admin",
    "code": "super-admin"
  },
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Note:** The `password` field in the response is omitted for security.

### Update Admin User

**PUT** `/admin-api/users/:id`

Updates an existing admin user.

#### Request Body

```json
{
  "email": "updated@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "isActive": false
}
```

#### Example

```bash
curl -X PUT http://localhost:1337/admin-api/users/2 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "lastName": "Smith",
    "isActive": false
  }'
```

#### Response

```json
{
  "id": 2,
  "email": "updated@example.com",
  "username": "newadmin",
  "firstName": "Jane",
  "lastName": "Smith",
  "isActive": false,
  "blocked": false,
  "role": {
    "id": 2,
    "name": "Super Admin",
    "code": "super-admin"
  },
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-02T00:00:00.000Z"
}
```

### Delete Admin User

**DELETE** `/admin-api/users/:id`

Deletes an admin user. **Super-admin users cannot be deleted.**

#### Example

```bash
curl -X DELETE http://localhost:1337/admin-api/users/3 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Response

```json
{
  "success": true,
  "message": "Admin user deleted successfully"
}
```

### Reset Password

**POST** `/admin-api/users/:id/reset-password`

Resets the password for an admin user.

#### Request Body

```json
{
  "password": "newSecurePassword456"
}
```

#### Example

```bash
curl -X POST http://localhost:1337/admin-api/users/2/reset-password \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "password": "newSecurePassword456"
  }'
```

#### Response

```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

---

## Tokens API

### List Your Tokens

**GET** `/admin-api/tokens`

Lists all authentication tokens for the authenticated user.

#### Example

```bash
curl -X GET http://localhost:1337/admin-api/tokens \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Response

```json
{
  "data": [
    {
      "id": 1,
      "label": "Production Token",
      "type": "api",
      "expiresAt": "2024-12-31T23:59:59.000Z",
      "active": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "total": 1,
      "page": 1,
      "pageSize": 25
    }
  }
}
```

### Get Single Token

**GET** `/admin-api/tokens/:id`

Returns details for a specific token.

#### Example

```bash
curl -X GET http://localhost:1337/admin-api/tokens/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Response

```json
{
  "id": 1,
  "label": "Production Token",
  "type": "api",
  "expiresAt": "2024-12-31T23:59:59.000Z",
  "active": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Note:** The actual token value is only returned during creation.

### Create Token

**POST** `/admin-api/tokens`

Creates a new authentication token.

#### Request Body

```json
{
  "label": "My App Token",
  "type": "api",
  "expiresAt": "2024-12-31T23:59:59.000Z"
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `label` | string | Yes | Descriptive label for the token |
| `type` | string | No | Token type (default: `api`) |
| `expiresAt` | string | No | ISO 8601 date for expiration (default: 30 days) |

#### Example

```bash
curl -X POST http://localhost:1337/admin-api/tokens \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "My App Token",
    "type": "api"
  }'
```

#### Response

```json
{
  "id": 2,
  "label": "My App Token",
  "type": "api",
  "expiresAt": "2024-02-01T00:00:00.000Z",
  "active": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "message": "Token created successfully",
  "value": "c2VjdXJlLXRva2VuLXZhbHVlLW9mLW1l..."
}
```

**⚠️ Important:** Copy the `value` field immediately! It won't be shown again after creation.

### Update Token

**PUT** `/admin-api/tokens/:id`

Updates token properties. The actual token value cannot be changed; it must be regenerated.

#### Request Body

```json
{
  "label": "Updated Token Label",
  "type": "webhook",
  "active": true
}
```

#### Example

```bash
curl -X PUT http://localhost:1337/admin-api/tokens/2 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Updated Token Label"
  }'
```

#### Response

```json
{
  "id": 2,
  "label": "Updated Token Label",
  "type": "api",
  "expiresAt": "2024-02-01T00:00:00.000Z",
  "active": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-02T00:00:00.000Z"
}
```

### Delete Token

**DELETE** `/admin-api/tokens/:id`

Permanently deletes a token.

#### Example

```bash
curl -X DELETE http://localhost:1337/admin-api/tokens/2 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Response

```json
{
  "success": true,
  "message": "Token deleted successfully"
}
```

### Revoke Token

**POST** `/admin-api/tokens/:id/revoke`

Revokes a token immediately without deleting it. The token becomes inactive.

#### Example

```bash
curl -X POST http://localhost:1337/admin-api/tokens/2/revoke \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Response

```json
{
  "success": true,
  "message": "Token revoked successfully"
}
```

### Refresh Token Expiration

**POST** `/admin-api/tokens/:id/refresh`

Extends the token's expiration date. By default, the expiration is extended by 30 days.

#### Request Body (Optional)

```json
{
  "expiresAt": "2025-12-31T23:59:59.000Z"
}
```

#### Example

```bash
curl -X POST http://localhost:1337/admin-api/tokens/2/refresh \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Response

```json
{
  "id": 2,
  "expiresAt": "2025-01-02T00:00:00.000Z",
  "message": "Token expiration refreshed successfully"
}
```

---

## Advanced Configuration

### RBAC and Permission Management

The plugin respects Strapi's native RBAC system. You can control access at several levels:

#### 1. Admin Panel Permissions

Navigate to **Settings > Roles & Permissions** to customize what actions authenticated users can perform:

- **Who can create users?** Assign "Edit users" permission to specific roles
- **Who can manage tokens?** Create custom role with token management permissions
- **Audit trails** are automatically logged for all admin API operations

#### 2. Plugin-Level Policies

Create custom policies for granular control:

```typescript
// config/policies/admin-api/custom-policy.ts
module.exports = ({ policyContext, config, { strapi } }) => {
  const { user } = policyContext.state;

  // Allow only super-admin to create users
  if (user.role.code === 'super-admin') {
    return true;
  }

  // Allow editors to only update their own profile
  if (user.role.code === 'editor' && policyContext.request.params.id === user.id) {
    return true;
  }

  return false;
};
```

Register the policy in your plugin config:

```typescript
// config/plugins.ts
export default ({ env }) => ({
  'admin-api': {
    enabled: true,
    config: {
      policies: {
        'admin-api/only-admin': 'config/policies/admin-api/only-admin.ts',
        'admin-api/manage-own-profile': 'config/policies/admin-api/manage-own-profile.ts',
      },
    },
  },
});
```

Apply policies to routes:

```typescript
{
  method: 'POST',
  path: '/users',
  handler: 'admin-api.controller.create',
  config: {
    auth: {
      strategies: ['admin'],
    },
    policies: ['admin-api/only-admin'], // Only super-admin can create users
  },
}
```

### Security Best Practices

1. **Never expose token values** after creation - they're one-time only
2. **Rotate tokens regularly** - use the refresh endpoint
3. **Use labels** to identify tokens in different environments
4. **Set reasonable expiration dates** - especially for API tokens
5. **Audit your token usage** - Strapi logs all token operations
6. **Revoke tokens immediately** if they're compromised
7. **Use RBAC** to limit access to only necessary operations

---

## Common Use Cases

### 1. Automated Onboarding

Automatically create new team members:

```typescript
// Example using Strapi Client
const strapi = require('@strapi/sdk-js');

async function onboardNewMember(email, roleCode) {
  const strapiAPI = strapi({
    url: process.env.STRAPI_URL,
    apiToken: process.env.ADMIN_API_TOKEN,
  });

  const role = await strapiAPI.find('admin-roles', {
    filters: { code: { eq: roleCode } },
  });

  if (!role.data.length) {
    throw new Error('Role not found');
  }

  return await strapiAPI.create('admin-users', {
    data: {
      email,
      username: email.split('@')[0],
      password: generatePassword(),
      role: {
        connect: [role.data[0].id]
      }
    }
  });
}
```

### 2. Token Rotation on Login

Automatically rotate active tokens when a user logs in:

```typescript
// Example middleware
app.use('/admin-api/tokens/rotate', async (req, res, next) => {
  const { jwt } = req.body;

  // Verify current JWT and create new token
  const newToken = await strapi.admin.services.token.rotate(jwt);

  res.json({
    success: true,
    token: newToken.value,
  });
});
```

### 3. Token Audit Dashboard

Build a dashboard to monitor token usage:

```typescript
app.get('/admin-api/tokens/audit', async (req, res) => {
  const allTokens = await strapi.entityService.findMany('admin::token');

  const auditReport = {
    total: allTokens.length,
    active: allTokens.filter(t => t.active).length,
    expiringSoon: allTokens.filter(t => {
      if (!t.expiresAt) return false;
      const daysUntilExpiry = Math.ceil(
        (new Date(t.expiresAt) - new Date()) / (1000 * 60 * 60 * 24)
      );
      return daysUntilExpiry <= 7;
    }).length,
    byUser: groupBy(allTokens, 'user'),
  };

  res.json(auditReport);
});
```

---

## Troubleshooting

### "Authentication required" errors

Ensure you're using a valid admin JWT token. Check:
- The token hasn't expired
- The token is being sent in the Authorization header
- The token is for a valid admin user

### "Token not found" errors

- The token might be for a different user
- The token might have been revoked or deleted
- Check that you're using the correct token ID

### "Cannot delete super-admin user"

This is a security feature. Only other super-admins can delete super-admin accounts.

### "Failed to create token"

Common causes:
- Token label is missing
- User doesn't have permission to create tokens
- Database connection issues

---

## License

MIT

## Support

For issues, questions, or contributions, visit the [GitHub repository](https://github.com/fbritoferreira/strapi).
