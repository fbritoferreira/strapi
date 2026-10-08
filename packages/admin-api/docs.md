---
theme: strapi
layout: docs
title: Strapi Admin API
description: Plugin to manage Strapi admin users and tokens via REST API
---

# Strapi Admin API

Plugin to manage Strapi admin users and authentication tokens through REST API endpoints.

## Quick Start

### 1. Install the Plugin

```bash
npm install @fbritoferreira/strapi-admin-api
# or
pnpm add @fbritoferreira/strapi-admin-api
# or
yarn add @fbritoferreira/strapi-admin-api
```

### 2. Enable in Strapi

Update `config/plugins.ts`:

```typescript
export default ({ env }) => ({
  'admin-api': {
    enabled: true,
  },
});
```

### 3. Get Admin JWT Token

```bash
curl -X POST http://localhost:1337/admin/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your_password"
  }'
```

Copy the JWT from the response:
```json
{
  "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 4. Create Your First Admin User

```bash
curl -X POST http://localhost:1337/admin-api/users \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newadmin@example.com",
    "username": "newadmin",
    "password": "SecurePassword123!",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

## Features

### ✅ Admin User Management
- Create, read, update, and delete admin users
- Reset passwords
- Set user roles (including super-admin)
- Control user activation and blocking

### ✅ Token Management
- Create custom authentication tokens
- Revoke tokens immediately
- Extend token expiration
- List and manage all tokens

### ✅ Security
- All endpoints require admin JWT authentication
- Passwords never exposed in API responses
- Super-admin protection (cannot delete super-admin users)
- Role-based access control (RBAC) ready
- Built-in audit trail support

## API Endpoints

### Base URL
```
http://localhost:1337/admin-api
```

### Users API

#### List All Users
```bash
GET /admin-api/users
Authorization: Bearer YOUR_JWT_TOKEN
```

#### Get Single User
```bash
GET /admin-api/users/:id
Authorization: Bearer YOUR_JWT_TOKEN
```

#### Create User
```bash
POST /admin-api/users
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "username",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "isActive": true
}
```

#### Update User
```bash
PUT /admin-api/users/:id
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "firstName": "Jane",
  "isActive": false
}
```

#### Delete User
```bash
DELETE /admin-api/users/:id
Authorization: Bearer YOUR_JWT_TOKEN
```

#### Reset Password
```bash
POST /admin-api/users/:id/reset-password
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "password": "newSecurePassword"
}
```

### Tokens API

#### List Your Tokens
```bash
GET /admin-api/tokens
Authorization: Bearer YOUR_JWT_TOKEN
```

#### Create Token
```bash
POST /admin-api/tokens
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "label": "My API Token",
  "type": "api",
  "expiresAt": "2025-12-31T23:59:59.000Z"
}
```

**⚠️ Important:** Copy the token value immediately! It won't be shown again.

#### Revoke Token
```bash
POST /admin-api/tokens/:id/revoke
Authorization: Bearer YOUR_JWT_TOKEN
```

#### Refresh Token Expiration
```bash
POST /admin-api/tokens/:id/refresh
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "expiresAt": "2026-12-31T23:59:59.000Z"
}
```

For complete API reference, see [API Documentation](./api.md).
