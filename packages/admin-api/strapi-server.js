export default () => {
  return {
    register({ strapi }) {
      console.log('🚀 Admin API Plugin registering...');

      const usersRoutes = [
        { method: 'GET', path: '/users', handler: 'admin-api::adminController::find', config: { auth: { scope: ['admin'] } } },
        { method: 'GET', path: '/users/:id', handler: 'admin-api::adminController::findOne', config: { auth: { scope: ['admin'] } } },
        { method: 'POST', path: '/users', handler: 'admin-api::adminController::create', config: { auth: { scope: ['admin'] } } },
        { method: 'PUT', path: '/users/:id', handler: 'admin-api::adminController::update', config: { auth: { scope: ['admin'] } } },
        { method: 'DELETE', path: '/users/:id', handler: 'admin-api::adminController::delete', config: { auth: { scope: ['admin'] } } },
        { method: 'POST', path: '/users/:id/reset-password', handler: 'admin-api::adminController::resetPassword', config: { auth: { scope: ['admin'] } } },
      ];

      strapi.server.routes(
        usersRoutes.map((route) => ({ ...route, path: `/admin-api${route.path}` }))
      );

      const tokensRoutes = [
        { method: 'GET', path: '/tokens', handler: 'admin-api::adminController::find', config: { auth: { scope: ['admin'] } } },
        { method: 'GET', path: '/tokens/:id', handler: 'admin-api::adminController::findOne', config: { auth: { scope: ['admin'] } } },
        { method: 'POST', path: '/tokens', handler: 'admin-api::adminController::create', config: { auth: { scope: ['admin'] } } },
        { method: 'PUT', path: '/tokens/:id', handler: 'admin-api::adminController::update', config: { auth: { scope: ['admin'] } } },
        { method: 'DELETE', path: '/tokens/:id', handler: 'admin-api::adminController::delete', config: { auth: { scope: ['admin'] } } },
        { method: 'POST', path: '/tokens/:id/revoke', handler: 'admin-api::adminController::revoke', config: { auth: { scope: ['admin'] } } },
        { method: 'POST', path: '/tokens/:id/refresh', handler: 'admin-api::adminController::refresh', config: { auth: { scope: ['admin'] } } },
      ];

      strapi.server.routes(
        tokensRoutes.map((route) => ({ ...route, path: `/admin-api${route.path}` }))
      );

      console.log('✅ Admin API routes registered: /admin-api/users and /admin-api/tokens');
    },
    config() {
      return { admin: { enabled: true } };
    },
  };
};