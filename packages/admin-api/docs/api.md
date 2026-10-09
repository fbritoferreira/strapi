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

### Permissions

Every route checks the caller's admin permissions, the same ones Strapi uses for its own Users and API Tokens settings pages. Super admins hold all of them; other roles need them granted under **Settings → Roles**.

| Route | Required permission |
| --- | --- |
| `GET /admin-api/users`, `GET /admin-api/users/:id` | `admin::users.read` |
| `POST /admin-api/users` | `admin::users.create` |
| `PUT /admin-api/users/:id`, `POST /admin-api/users/:id/reset-password` | `admin::users.update` |
| `DELETE /admin-api/users/:id` | `admin::users.delete` |
| `GET /admin-api/tokens`, `GET /admin-api/tokens/:id` | `admin::api-tokens.read` |
| `POST /admin-api/tokens` | `admin::api-tokens.create` |
| `PUT /admin-api/tokens/:id`, `POST /admin-api/tokens/:id/refresh` | `admin::api-tokens.update` |
| `DELETE /admin-api/tokens/:id`, `POST /admin-api/tokens/:id/revoke` | `admin::api-tokens.delete` |

Callers without the permission get `403 Forbidden`.

### Passwords

`password` on create, update and reset-password must follow Strapi's admin password rule: at least 8 characters, at most 72 bytes, with at least one lowercase letter, one uppercase letter and one digit. Anything else returns `400`.

---

## Users API

### Base URL
```
/admin-api/users
```

#### List All Users
**GET** `/admin-api/users`

Lists admin users. Returns a plain JSON array (no `data`/`meta` envelope).

**Query Parameters:**
- `start`, `limit` or `page`, `pageSize` - Pagination
- `sort` (string or string[], e.g. `email:asc`) - Sort; no default order is applied
- `filters` - Strapi filters on `id`, `email`, `firstname`, `lastname`, `username`, `isActive`, `blocked`, `createdAt`, `updatedAt` (combinable with `$and`/`$or`/`$not`)

Any other parameter, and any filter or sort on another field, is ignored. Roles are always populated.

**Example:**
```bash
curl -X GET http://localhost:1337/admin-api/users \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
[
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
      "code": "strapi-super-admin"
    },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
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
  "isActive": true,
  "roles": [2]
}
```

`roles` (array of admin role ids) or `role` (a single id) is required; `400` if missing or if a role does not exist. Built-in role codes are `strapi-super-admin`, `strapi-editor` and `strapi-author`.

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
    "lastName": "Doe",
    "role": 2
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
  "password": "NewSecurePassword456"
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

`lifespan` must be `null` or 7, 30 or 90 days in ms (`604800000`, `2592000000`, `7776000000`); anything else returns `400`. Changing it resets `expiresAt` from now.

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

- `lifespan` (number, optional) - One of `null` (unlimited), 7d, 30d, 90d in ms (default: `null` = no expiration); other values return `400`
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
- `403` - Forbidden (missing the admin permission for the route)
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
