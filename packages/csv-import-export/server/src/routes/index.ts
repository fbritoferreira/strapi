import { ACTIONS } from '../bootstrap';

/**
 * Admin route behind an authenticated admin, plus a plugin permission when
 * `action` is given. Content-manager permissions on the target collection are
 * checked again in the controller, per uid.
 */
const route = (method: string, path: string, handler: string, action?: string) => ({
  method,
  path,
  handler: `csv.${handler}`,
  config: {
    policies: [
      'admin::isAuthenticatedAdmin',
      ...(action ? [{ name: 'admin::hasPermissions', config: { actions: [action] } }] : []),
    ],
  },
});

export default {
  admin: {
    type: 'admin',
    routes: [
      route('GET', '/content-types', 'contentTypes'),
      route('GET', '/content-types/:uid/schema', 'schema'),
      route('POST', '/jobs', 'createJob', ACTIONS.import),
      route('POST', '/import/:uid', 'import', ACTIONS.import),
      route('POST', '/jobs/:id/finish', 'finishJob', ACTIONS.import),
      route('POST', '/export/:uid', 'export', ACTIONS.export),
      route('GET', '/jobs', 'jobs'),
      route('GET', '/jobs/:id', 'job'),
    ],
  },
};
