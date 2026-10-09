import { describe, expect, it, vi } from 'vitest';

import plugin from './index';

describe('server entry', () => {
  it('exposes every Strapi plugin lifecycle and registry key', () => {
    expect(Object.keys(plugin).sort()).toEqual(
      [
        'bootstrap',
        'config',
        'contentTypes',
        'controllers',
        'destroy',
        'middlewares',
        'policies',
        'register',
        'routes',
        'services',
      ].sort()
    );
  });
});

describe('server entry wiring', () => {
  it('registers eight admin routes, each with a csv controller handler that exists', () => {
    const { routes } = (plugin.routes as any).admin;
    expect(routes).toHaveLength(8);
    const controller = (plugin.controllers as any).csv({ strapi: { plugin: () => ({ config: () => undefined }) } });
    for (const route of routes) {
      const [name, method] = route.handler.split('.');
      expect(name).toBe('csv');
      expect(typeof controller[method]).toBe('function');
      expect(route.config.policies[0]).toBe('admin::isAuthenticatedAdmin');
    }
  });

  it('registers the import and export permissions on bootstrap', async () => {
    const registerMany = vi.fn();
    await plugin.bootstrap({ strapi: { service: () => ({ actionProvider: { registerMany } }) } });
    expect(registerMany.mock.calls[0][0].map((a: any) => a.uid)).toEqual(['import', 'export']);
  });

  it('rejects invalid plugin config', () => {
    expect(() => plugin.config.validator({ escapeFormulas: 'yes', maxFileSizeMb: 10 })).toThrow('escapeFormulas');
    expect(() => plugin.config.validator({ escapeFormulas: true, maxFileSizeMb: 0 })).toThrow('maxFileSizeMb');
  });
});
