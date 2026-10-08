---
title: API Reference
description: Complete API reference for Strapi Admin API Plugin
---

# API Reference

Complete API reference for managing Strapi admin users and tokens.

## Authentication

All endpoints require an admin JWT token. Obtain it by logging into the Strapi Admin Panel or using:

```bash
curl -X POST http://localhost:1337/admin/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "password"}'
```

Copy the JWT from the response and include it in the Authorization header:

```http
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## Users API

### Base URL
```
/admin-api/users
```

#### List All Users
**GET** `/admin-api/users`

Lists all admin users with pagination and filtering.

**Query Parameters:**
- `start` (number, default: 0) - Pagination start
- `limit` (number, default: 25) - Items per page
- `sort` (string, default: `createdAt:desc`) - Sort field
- `populate` (string) - Populate related data

**Example:**
```bash
curl -X GET http://localhost:1337/admin-api/users \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
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

#### Get Single User
**GET** `/admin-api/users/:id`

**Example:**
```bash
curl -X GET http://localhost:1337/admin-api/users/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Create User
**POST** `/admin-api/users`

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "username": "newuser",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe",
  "isActive": true
}
```

**Example:**
```bash
curl -X POST http://localhost:1337/admin-api/users \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "username": "newuser",
    "password": "SecurePassword123!",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

#### Update User
**PUT** `/admin-api/users/:id`

**Request Body:**
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "isActive": false
}
```

#### Delete User
**DELETE** `/admin-api/users/:id`

**Note:** Super-admin users cannot be deleted.

**Example:**
```bash
curl -X DELETE http://localhost:1337/admin-api/users/2 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "Admin user deleted successfully"
}
```

#### Reset Password
**POST** `/admin-api/users/:id/reset-password`

**Request Body:**
```json
{
  "password": "newSecurePassword456"
}
```

---

## Tokens API

### Base URL
```
/admin-api/tokens
```

#### List Tokens
**GET** `/admin-api/tokens`

Lists all API tokens (Strapi admin API tokens are global, not per-user).

**Example:**
```bash
curl -X GET http://localhost:1337/admin-api/tokens \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Create Token
**POST** `/admin-api/tokens`

**Request Body:**
```json
{
  "name": "My API Token",
  "description": "Optional description",
  "type": "read-only",
  "lifespan": 2592000000
}
```

**Parameters:**
- `name` (string, required) - Unique token name (`label` accepted as alias)
- `description` (string, optional)
- `type` (string, optional) - `read-only` | `full-access` | `custom` (default: `read-only`)
- `lifespan` (number, optional) - Lifetime in ms; one of `null` (unlimited), 7d, 30d, 90d (default: `null`)
- `permissions` (string[], optional) - Required when `type` is `custom`

**Example:**
```bash
curl -X POST http://localhost:1337/admin-api/tokens \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My API Token"
  }'
```

**Response:**
```json
{
  "id": 1,
  "name": "My API Token",
  "description": "",
  "type": "read-only",
  "lifespan": null,
  "expiresAt": null,
  "lastUsedAt": null,
  "createdAt": "2026-01-31T00:00:00.000Z",
  "updatedAt": "2026-01-31T00:00:00.000Z",
  "accessKey": "9f8e7d...",
  "message": "Token created successfully"
}
```

**⚠️ Important:** Copy the `accessKey` field immediately! It won't be shown again.

#### Update Token
**PUT** `/admin-api/tokens/:id`

**Request Body:**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "lifespan": 604800000
}
```

**Note:** The access key cannot be changed. Delete and create a new token instead.

#### Delete Token
**DELETE** `/admin-api/tokens/:id`

**Example:**
```bash
curl -X DELETE http://localhost:1337/admin-api/tokens/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Revoke Token
**POST** `/admin-api/tokens/:id/revoke`

Deletes the token (matches Strapi's own revoke semantics).

**Example:**
```bash
curl -X POST http://localhost:1337/admin-api/tokens/1/revoke \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "Token revoked successfully"
}
```

#### Refresh Token Expiration
**POST** `/admin-api/tokens/:id/refresh`

Resets the token's expiration.

**Request Body (optional):**
```json
{
  "lifespan": 2592000000
}
```

- `lifespan` (number, optional) - One of `null` (unlimited), 7d, 30d, 90d (default: `null` = no expiration)
- `expiresAt` (string, optional) - Explicit ISO 8601 expiry overrides `lifespan`

**Example:**
```bash
curl -X POST http://localhost:1337/admin-api/tokens/1/refresh \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Security Best Practices

1. **Keep tokens secure** - Never commit them to version control
2. **Rotate regularly** - Use the refresh endpoint regularly
3. **Set reasonable expiration** - Especially for API tokens
4. **Use labels** - Identify tokens in different environments
5. **Revoke immediately** - If a token is compromised
6. **Use RBAC** - Restrict access to only necessary operations
7. **Audit regularly** - Check token usage logs

---

## Error Responses

All endpoints return standard HTTP status codes:

- `200` - Success
- `400` - Bad request
- `401` - Unauthorized (missing or invalid token)
- `404` - Not found
- `500` - Internal server error

Example error response:
```json
{
  "error": {
    "status": 401,
    "name": "UnauthorizedError",
    "message": "Authentication required"
  }
}
```

---

## License

MIT
