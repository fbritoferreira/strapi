interface PluginDefinition {
  register(ctx: { strapi: unknown }): void;
  config(): { admin: { enabled: boolean } };
}

/**
 * Admin API Plugin definition
 * Provides a plugin for Strapi that registers custom routes for admin users and tokens
 * This enables the Strapi admin API to manage users and their authentication tokens
 */
const plugin: PluginDefinition = {
  /**
   * Registers the admin-api plugin routes with Strapi
   * Sets up /admin-api/users and /admin-api/tokens endpoints
   * @param ctx The Strapi plugin context containing the strapi instance
   */
  register({ strapi }: { strapi: any }) {
    console.log('🚀 Admin API Plugin registering...');

    // Define custom admin routes
    const usersRoutes = [
      {
        method: 'GET',
        path: '/users',
        handler: 'admin-api.controller.find',
        config: {
          auth: {
            strategies: ['admin'],
          },
        },
      },
      {
        method: 'GET',
        path: '/users/:id',
        handler: 'admin-api.controller.findOne',
        config: {
          auth: {
            strategies: ['admin'],
          },
        },
      },
      {
        method: 'POST',
        path: '/users',
        handler: 'admin-api.controller.create',
        config: {
          auth: {
            strategies: ['admin'],
          },
        },
      },
      {
        method: 'PUT',
        path: '/users/:id',
        handler: 'admin-api.controller.update',
        config: {
          auth: {
            strategies: ['admin'],
          },
        },
      },
      {
        method: 'DELETE',
        path: '/users/:id',
        handler: 'admin-api.controller.delete',
        config: {
          auth: {
            strategies: ['admin'],
          },
        },
      },
      {
        method: 'POST',
        path: '/users/:id/reset-password',
        handler: 'admin-api.controller.resetPassword',
        config: {
          auth: {
            strategies: ['admin'],
          },
        },
      },
    ];

    // Register users routes
    strapi.router('content-api').routes(
      usersRoutes.map((route) => ({
        ...route,
        path: `/admin-api${route.path}`,
      }))
    );

    // Define tokens routes
    const tokensRoutes = [
      {
        method: 'GET',
        path: '/tokens',
        handler: 'admin-api.controller.find',
        config: {
          auth: {
            strategies: ['admin'],
          },
        },
      },
      {
        method: 'GET',
        path: '/tokens/:id',
        handler: 'admin-api.controller.findOne',
        config: {
          auth: {
            strategies: ['admin'],
          },
        },
      },
      {
        method: 'POST',
        path: '/tokens',
        handler: 'admin-api.controller.create',
        config: {
          auth: {
            strategies: ['admin'],
          },
        },
      },
      {
        method: 'PUT',
        path: '/tokens/:id',
        handler: 'admin-api.controller.update',
        config: {
          auth: {
            strategies: ['admin'],
          },
        },
      },
      {
        method: 'DELETE',
        path: '/tokens/:id',
        handler: 'admin-api.controller.delete',
        config: {
          auth: {
            strategies: ['admin'],
          },
        },
      },
      {
        method: 'POST',
        path: '/tokens/:id/revoke',
        handler: 'admin-api.controller.revoke',
        config: {
          auth: {
            strategies: ['admin'],
          },
        },
      },
      {
        method: 'POST',
        path: '/tokens/:id/refresh',
        handler: 'admin-api.controller.refresh',
        config: {
          auth: {
            strategies: ['admin'],
          },
        },
      },
    ];

    // Register tokens routes
    strapi.router('content-api').routes(
      tokensRoutes.map((route) => ({
        ...route,
        path: `/admin-api${route.path}`,
      }))
    );

    console.log('✅ Admin API routes registered: /admin-api/users and /admin-api/tokens');
  },

  /**
   * Returns the plugin configuration
   * Indicates whether the admin API is enabled
   * @returns Object with admin configuration
   */
  config() {
    return {
      admin: {
        enabled: true,
      },
    };
  },
};

export default plugin;
