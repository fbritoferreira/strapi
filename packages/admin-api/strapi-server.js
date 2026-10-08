export default () => {
  return {
    register({ strapi }) {
      console.log('🚀 Admin API Plugin registering...');

      const usersRoutes = [
        { method: 'GET', path: '/users', handler: 'admin-api.controller.find', config: { auth: { strategies: ['admin'] } } },
        { method: 'GET', path: '/users/:id', handler: 'admin-api.controller.findOne', config: { auth: { strategies: ['admin'] } } },
        { method: 'POST', path: '/users', handler: 'admin-api.controller.create', config: { auth: { strategies: ['admin'] } } },
        { method: 'PUT', path: '/users/:id', handler: 'admin-api.controller.update', config: { auth: { strategies: ['admin'] } } },
        { method: 'DELETE', path: '/users/:id', handler: 'admin-api.controller.delete', config: { auth: { strategies: ['admin'] } } },
        { method: 'POST', path: '/users/:id/reset-password', handler: 'admin-api.controller.resetPassword', config: { auth: { strategies: ['admin'] } } },
      ];

      strapi.router('content-api').routes(
        usersRoutes.map((route) => ({ ...route, path: `/admin-api${route.path}` }))
      );

      const tokensRoutes = [
        { method: 'GET', path: '/tokens', handler: 'admin-api.controller.find', config: { auth: { strategies: ['admin'] } } },
        { method: 'GET', path: '/tokens/:id', handler: 'admin-api.controller.findOne', config: { auth: { strategies: ['admin'] } } },
        { method: 'POST', path: '/tokens', handler: 'admin-api.controller.create', config: { auth: { strategies: ['admin'] } } },
        { method: 'PUT', path: '/tokens/:id', handler: 'admin-api.controller.update', config: { auth: { strategies: ['admin'] } } },
        { method: 'DELETE', path: '/tokens/:id', handler: 'admin-api.controller.delete', config: { auth: { strategies: ['admin'] } } },
        { method: 'POST', path: '/tokens/:id/revoke', handler: 'admin-api.controller.revoke', config: { auth: { strategies: ['admin'] } } },
        { method: 'POST', path: '/tokens/:id/refresh', handler: 'admin-api.controller.refresh', config: { auth: { strategies: ['admin'] } } },
      ];

      strapi.router('content-api').routes(
        tokensRoutes.map((route) => ({ ...route, path: `/admin-api${route.path}` }))
      );

      console.log('✅ Admin API routes registered: /admin-api/users and /admin-api/tokens');
    },
    config() {
      return { admin: { enabled: true } };
    },
  };
};