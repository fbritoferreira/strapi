---
theme: strapi
layout: docs
title: Strapi Admin API
description: Plugin to manage Strapi admin users and tokens via REST API
---

# Strapi Admin API

Plugin to manage Strapi admin users and authentication tokens through REST API endpoints.

## Installation

```bash
npm install @fbritoferreira/strapi-admin-api
# or
pnpm add @fbritoferreira/strapi-admin-api
# or
yarn add @fbritoferreira/strapi-admin-api
```

## Quick Start

### 1. Enable the Plugin

```typescript
// config/plugins.ts
export default ({ env }) => ({
  'admin-api': {
    enabled: true,
  },
});
```

### 2. Get Admin JWT Token

```bash
curl -X POST http://localhost:1337/admin/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your_password"
  }'
```

### 3. Create an Admin User

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

For full API documentation, see [API Reference](./api.md).
