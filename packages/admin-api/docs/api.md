---
theme: strapi
layout: docs
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

#### List Your Tokens
**GET** `/admin-api/tokens`

Lists all authentication tokens for the authenticated user.

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
  "label": "My API Token",
  "type": "api",
  "expiresAt": "2025-12-31T23:59:59.000Z"
}
```

**Parameters:**
- `label` (string, required) - Descriptive label
- `type` (string, optional) - Token type (default: `api`)
- `expiresAt` (string, optional) - ISO 8601 date (default: 30 days)

**Example:**
```bash
curl -X POST http://localhost:1337/admin-api/tokens \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "My API Token"
  }'
```

**Response:**
```json
{
  "id": 1,
  "label": "My API Token",
  "type": "api",
  "expiresAt": "2025-01-31T00:00:00.000Z",
  "active": true,
  "message": "Token created successfully",
  "value": "c2VjdXJlLXRva2VuLXZhbHVlLW9mLW1l..."
}
```

**⚠️ Important:** Copy the `value` field immediately! It won't be shown again.

#### Update Token
**PUT** `/admin-api/tokens/:id`

**Request Body:**
```json
{
  "label": "Updated Label",
  "type": "webhook"
}
```

**Note:** The token value cannot be changed. Regenerate the token instead.

#### Delete Token
**DELETE** `/admin-api/tokens/:id`

**Example:**
```bash
curl -X DELETE http://localhost:1337/admin-api/tokens/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Revoke Token
**POST** `/admin-api/tokens/:id/revoke`

Revokes a token immediately without deleting it.

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

Extends the token's expiration date (default: +30 days).

**Request Body (optional):**
```json
{
  "expiresAt": "2026-12-31T23:59:59.000Z"
}
```

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
