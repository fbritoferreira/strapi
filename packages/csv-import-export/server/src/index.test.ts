import { describe, expect, it } from 'vitest';

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
