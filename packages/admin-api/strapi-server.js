import adminController from './dist/controllers/admin.js';
import tokenController from './dist/controllers/tokens.js';

export default () => {
  return {
    controllers: {
      adminController,
      tokenController,
    },
    routes: [
      // Admin users routes
      { method: 'GET', path: '/users', handler: 'adminController.find', config: { auth: { scope: ['admin'] } } },
      { method: 'GET', path: '/users/:id', handler: 'adminController.findOne', config: { auth: { scope: ['admin'] } } },
      { method: 'POST', path: '/users', handler: 'adminController.create', config: { auth: { scope: ['admin'] } } },
      { method: 'PUT', path: '/users/:id', handler: 'adminController.update', config: { auth: { scope: ['admin'] } } },
      { method: 'DELETE', path: '/users/:id', handler: 'adminController.delete', config: { auth: { scope: ['admin'] } } },
      { method: 'POST', path: '/users/:id/reset-password', handler: 'adminController.resetPassword', config: { auth: { scope: ['admin'] } } },
      // Admin tokens routes
      { method: 'GET', path: '/tokens', handler: 'tokenController.find', config: { auth: { scope: ['admin'] } } },
      { method: 'GET', path: '/tokens/:id', handler: 'tokenController.findOne', config: { auth: { scope: ['admin'] } } },
      { method: 'POST', path: '/tokens', handler: 'tokenController.create', config: { auth: { scope: ['admin'] } } },
      { method: 'PUT', path: '/tokens/:id', handler: 'tokenController.update', config: { auth: { scope: ['admin'] } } },
      { method: 'DELETE', path: '/tokens/:id', handler: 'tokenController.delete', config: { auth: { scope: ['admin'] } } },
      { method: 'POST', path: '/tokens/:id/revoke', handler: 'tokenController.revoke', config: { auth: { scope: ['admin'] } } },
      { method: 'POST', path: '/tokens/:id/refresh', handler: 'tokenController.refresh', config: { auth: { scope: ['admin'] } } },
    ],
    register() {},
    config() {
      return { admin: { enabled: true } };
    },
  };
};