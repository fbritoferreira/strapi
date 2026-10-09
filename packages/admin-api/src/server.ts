import adminController, { type AdminController } from './controllers/admin.js';
import tokenController, { type TokenController } from './controllers/tokens.js';

/** One route of the plugin, in Strapi's route config shape. */
export interface AdminRoute {
  /** HTTP method. */
  method: string;
  /** Path under `/admin-api`. */
  path: string;
  /** `controller.method` that handles it. */
  handler: string;
  /** Admin authentication and the Strapi admin permission the caller needs. */
  config: {
    auth: { scope: string[] };
    policies: Array<string | { name: string; config: { actions: string[] } }>;
  };
}

/** What `strapi-server.js` returns: the plugin's controllers, routes and lifecycle. */
export interface AdminApiPlugin {
  /** The user and token controllers. */
  controllers: { adminController: AdminController; tokenController: TokenController };
  /** The 13 `/admin-api/users` and `/admin-api/tokens` routes. */
  routes: AdminRoute[];
  /** Strapi register lifecycle; does nothing. */
  register(): void;
  /** Plugin config. */
  config(): { admin: { enabled: boolean } };
}

/**
 * Admin-type route that requires an authenticated admin holding `action`,
 * mirroring how Strapi guards its own /admin/users and /admin/api-tokens routes.
 */
const route = (method: string, path: string, handler: string, action: string): AdminRoute => ({
  method,
  path,
  handler,
  config: {
    auth: { scope: ['admin'] },
    policies: [
      'admin::isAuthenticatedAdmin',
      { name: 'admin::hasPermissions', config: { actions: [action] } },
    ],
  },
});

/**
 * Admin API plugin (strapi-server entry): controllers plus /admin-api/users
 * and /admin-api/tokens routes.
 */
const createPlugin = (): AdminApiPlugin => ({
  controllers: {
    adminController,
    tokenController,
  },
  routes: [
    // Admin users routes
    route('GET', '/users', 'adminController.find', 'admin::users.read'),
    route('GET', '/users/:id', 'adminController.findOne', 'admin::users.read'),
    route('POST', '/users', 'adminController.create', 'admin::users.create'),
    route('PUT', '/users/:id', 'adminController.update', 'admin::users.update'),
    route('DELETE', '/users/:id', 'adminController.delete', 'admin::users.delete'),
    route('POST', '/users/:id/reset-password', 'adminController.resetPassword', 'admin::users.update'),
    // Admin tokens routes
    route('GET', '/tokens', 'tokenController.find', 'admin::api-tokens.read'),
    route('GET', '/tokens/:id', 'tokenController.findOne', 'admin::api-tokens.read'),
    route('POST', '/tokens', 'tokenController.create', 'admin::api-tokens.create'),
    route('PUT', '/tokens/:id', 'tokenController.update', 'admin::api-tokens.update'),
    route('DELETE', '/tokens/:id', 'tokenController.delete', 'admin::api-tokens.delete'),
    route('POST', '/tokens/:id/revoke', 'tokenController.revoke', 'admin::api-tokens.delete'),
    route('POST', '/tokens/:id/refresh', 'tokenController.refresh', 'admin::api-tokens.update'),
  ],
  register() {},
  config() {
    return { admin: { enabled: true } };
  },
});

export default createPlugin;
