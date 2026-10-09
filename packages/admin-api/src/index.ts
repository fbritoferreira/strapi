/**
 * Strapi 5 plugin that exposes REST endpoints for admin users and admin API
 * tokens, guarded by Strapi's own admin permissions.
 *
 * Install it from npm, enable it, and call the routes with an admin JWT:
 *
 * ```ts
 * // config/plugins.ts
 * export default () => ({
 *   'admin-api': { enabled: true },
 * });
 * ```
 *
 * ```bash
 * curl http://localhost:1337/admin-api/users -H "Authorization: Bearer $ADMIN_JWT"
 * ```
 *
 * @module
 */
/**
 * Admin API Controller - provides CRUD operations for Strapi admin users
 */
export { default as adminController } from './controllers/admin.js';

/**
 * Admin API Token Controller - provides CRUD operations for admin authentication tokens
 */
export { default as tokenController } from './controllers/tokens.js';

import plugin from './server.js';

/** The plugin factory, the same one `strapi-server.js` exports. */
export { default as server } from './server.js';

/** The plugin factory, the same one `strapi-server.js` exports. */
export default plugin;

export type { AdminController } from './controllers/admin.js';
export type { TokenController } from './controllers/tokens.js';
export type { AdminApiPlugin, AdminRoute } from './server.js';
