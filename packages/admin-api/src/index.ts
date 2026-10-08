/**
 * Admin API Controller - provides CRUD operations for Strapi admin users
 */
export { default as adminController } from './controllers/admin.js';

/**
 * Admin API Token Controller - provides CRUD operations for admin authentication tokens
 */
export { default as tokenController } from './controllers/tokens.js';

/**
 * Admin API Plugin - registers custom routes with Strapi for user and token management
 */
export { default as server } from './server.js';
