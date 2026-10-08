/**
 * Admin API Plugin Server
 * Provides CRUD operations for Strapi admin users and tokens via REST API
 */

export default {
  /**
   * Register plugin and its routes
   */
  register({ strapi }: any) {
    console.log('🚀 Admin API Plugin registering...');

    // Register users routes
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

    // Register tokens routes
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

    // Register all routes
    // Note: This uses the content-api router. For admin-only routes,
    // you should use the admin router. The /admin-api prefix distinguishes them.
    strapi.router('content-api').routes([
      ...usersRoutes.map((route) => ({
        ...route,
        path: `/admin-api${route.path}`,
      })),
      ...tokensRoutes.map((route) => ({
        ...route,
        path: `/admin-api${route.path}`,
      })),
    ]);

    console.log('✅ Admin API routes registered: /admin-api/users and /admin-api/tokens');
  },

  /**
   * Bootstrap plugin
   */
  bootstrap({ strapi }: any) {
    console.log('🚀 Admin API Plugin initialized');
  },

  /**
   * Configuration
   */
  config() {
    return {
      admin: {
        enabled: true,
      },
    };
  },

  /**
   * Destroy plugin
   */
  destroy({ strapi }: any) {
    console.log('🛑 Admin API Plugin destroying...');
  },
};
