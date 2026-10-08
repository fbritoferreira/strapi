# Changeset: fix/strapi-admin-api-compatibility

## Summary
Fixed Strapi 5 compatibility in the admin-api package.

## Files Changed

- `packages/admin-api/src/index.ts` - Updated import statement to properly import the server plugin

## Details

Updated `packages/admin-api/src/index.ts` to add the missing import for the server plugin:
```typescript
import plugin from './server.js';
```

This aligns with the Strapi 5 API where plugins are imported and exported as default.

## Base Branch
main
