import bootstrap from './bootstrap';
import config from './config';
import contentTypes from './content-types';
import controllers from './controllers';
import routes from './routes';

/** Server entry for the CSV import/export plugin. */
export default {
  register() {},
  bootstrap,
  destroy() {},
  config,
  contentTypes,
  controllers,
  routes,
  services: {},
  policies: {},
  middlewares: {},
};
