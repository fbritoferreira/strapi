/**
 * Admin API Controller - provides CRUD operations for Strapi admin users
 */
export { default as adminController } from './controllers/admin.js';

/**
 * Admin API Token Controller - provides CRUD operations for admin authentication tokens
 */
export { default as tokenController } from './controllers/tokens.js';

/**
 * Admin API Plugin - the same factory strapi-server.js exports
 */
import plugin from './server.js';
export { default as server } from './server.js';
export default plugin;
