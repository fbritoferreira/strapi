import { afterEach, describe, expect, it, vi } from 'vitest';

import adminController from '../controllers/admin.js';
import tokenController from '../controllers/tokens.js';
import pluginFromIndex from '../index.js';
import createPlugin from '../server.js';

const role = { id: 1, name: 'Super Admin', code: 'strapi-super-admin' };

/** Minimal koa context stand-in; `throw` behaves like koa's (always throws). */
const makeCtx = (body: any = {}, params: any = {}, query: any = {}): any => ({
  request: { body },
  params,
  query,
  state: { user: { id: 1 } },
  throw: (status: number, message: string) => {
    const err: any = new Error(message);
    err.status = status;
    throw err;
  },
});

/**
 * The controller must write admin::user records through Strapi's own user
 * service (`strapi.admin.services.user`), which hashes the password once and
 * persists via db.query. Going through entityService re-hashes password
 * attributes in the document-service transform, producing credentials that
 * can never log in — so entityService.create/update are stubbed to fail loudly.
 */
const stubStrapi = () => {
  const userCreate = vi.fn(async (attrs: any) => ({
    id: 9,
    email: 'a@example.com',
    username: 'a',
    firstname: 'a',
    lastname: 'a',
    isActive: true,
    blocked: false,
    createdAt: 't',
    updatedAt: 't',
    ...attrs,
  }));
  const updateById = vi.fn(async (id: any, attrs: any) => ({
    id: Number(id),
    email: 'a@example.com',
    username: 'a',
    firstname: 'a',
    lastname: 'a',
    isActive: true,
    blocked: false,
    roles: [role],
    createdAt: 't',
    updatedAt: 't',
    ...attrs,
  }));
  const entityCreate = vi.fn(() => {
    throw new Error('entityService.create must not write admin::user');
  });
  const entityUpdate = vi.fn(() => {
    throw new Error('entityService.update must not write admin::user');
  });

  vi.stubGlobal('strapi', {
    db: { query: () => ({ findMany: async ({ where }: any) => where?.id?.$in ? [role] : [] }) },
    admin: { services: { user: { create: userCreate, updateById } } },
    entityService: {
      findOne: vi.fn(async () => ({ id: 9, email: 'a@example.com' })),
      findMany: async () => [],
      create: entityCreate,
      update: entityUpdate,
      delete: vi.fn(),
    },
  });

  return { userCreate, updateById, entityCreate, entityUpdate };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('create', () => {
  it('passes the plain password to Strapi user service (hashed once, not pre-hashed)', async () => {
    const { userCreate, entityCreate } = stubStrapi();

    const res = await adminController.create(
      makeCtx({
        email: 'a@example.com',
        username: 'a',
        password: 'Plain123!',
        firstName: 'John',
        lastName: 'Doe',
        role: role.id,
      })
    );

    expect(userCreate).toHaveBeenCalledTimes(1);
    const attrs = userCreate.mock.calls[0]![0];
    expect(attrs.password).toBe('Plain123!');
    expect(attrs.firstname).toBe('John');
    expect(attrs.lastname).toBe('Doe');
    expect(attrs.roles).toEqual([role.id]);
    expect(entityCreate).not.toHaveBeenCalled();
    expect(res.firstName).toBe('John');
    expect(res.lastName).toBe('Doe');
    expect(res).not.toHaveProperty('password');
  });

  it('rejects a missing password with 400, not 500', async () => {
    stubStrapi();
    await expect(
      adminController.create(makeCtx({ email: 'a@example.com', username: 'a' }))
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('update', () => {
  it('writes through updateById with plain password and mapped field names', async () => {
    const { updateById, entityUpdate } = stubStrapi();

    const res = await adminController.update(
      makeCtx({ password: 'Upd12345!', firstName: 'Jane', role: 2 }, { id: '9' })
    );

    expect(updateById).toHaveBeenCalledWith('9', {
      password: 'Upd12345!',
      firstname: 'Jane',
      roles: [2],
    });
    expect(entityUpdate).not.toHaveBeenCalled();
    expect(res.firstName).toBe('Jane');
    expect(res).not.toHaveProperty('password');
  });

  it('returns 404 for an unknown user', async () => {
    stubStrapi();
    vi.stubGlobal('strapi', {
      ...((globalThis as any).strapi ?? {}),
      entityService: { findOne: vi.fn(async () => null) },
    });
    await expect(adminController.update(makeCtx({}, { id: '404' }))).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe('resetPassword', () => {
  it('resets through updateById with the plain password', async () => {
    const { updateById, entityUpdate } = stubStrapi();

    const res = await adminController.resetPassword(
      makeCtx({ password: 'New12345!' }, { id: '9' })
    );

    expect(updateById).toHaveBeenCalledWith('9', { password: 'New12345!' });
    expect(entityUpdate).not.toHaveBeenCalled();
    expect(res).toEqual({ success: true, message: 'Password reset successfully' });
  });

  it('requires a password (400)', async () => {
    stubStrapi();
    await expect(adminController.resetPassword(makeCtx({}, { id: '9' }))).rejects.toMatchObject({
      status: 400,
    });
  });
});

describe('create roles', () => {
  it('assigns the requested roles instead of always super-admin', async () => {
    const { userCreate } = stubStrapi();
    await adminController.create(
      makeCtx({ email: 'a@example.com', username: 'a', password: 'Plain123!', roles: [3] })
    );
    expect(userCreate.mock.calls[0]![0].roles).toEqual([3]);
  });

  it('rejects a create without role/roles with 400', async () => {
    const { userCreate } = stubStrapi();
    await expect(
      adminController.create(makeCtx({ email: 'a@example.com', username: 'a', password: 'Plain123!' }))
    ).rejects.toMatchObject({ status: 400 });
    expect(userCreate).not.toHaveBeenCalled();
  });
});

describe('password policy', () => {
  it.each(['short1A', 'nouppercase1', 'NOLOWERCASE1', 'NoDigitsHere', 'Aa1' + 'x'.repeat(70)])(
    'rejects weak password %s with 400 on create, update and reset',
    async (password) => {
      const { userCreate, updateById } = stubStrapi();
      await expect(
        adminController.create(makeCtx({ email: 'a@example.com', username: 'a', password, role: 1 }))
      ).rejects.toMatchObject({ status: 400 });
      await expect(adminController.update(makeCtx({ password }, { id: '9' }))).rejects.toMatchObject({
        status: 400,
      });
      await expect(
        adminController.resetPassword(makeCtx({ password }, { id: '9' }))
      ).rejects.toMatchObject({ status: 400 });
      expect(userCreate).not.toHaveBeenCalled();
      expect(updateById).not.toHaveBeenCalled();
    }
  );
});

describe('find query whitelist', () => {
  it('drops filters/sort on secret fields and unknown params', async () => {
    stubStrapi();
    const findMany = vi.fn(async () => []);
    (globalThis as any).strapi.entityService.findMany = findMany;

    await adminController.find(
      makeCtx({}, {}, {
        filters: {
          email: { $contains: 'a' },
          password: { $startsWith: '$2a' },
          resetPasswordToken: { $eq: 'x' },
          $or: [{ firstname: 'a' }, { resetPasswordToken: { $null: false } }],
        },
        sort: ['email:asc', 'password:desc'],
        fields: ['password'],
        populate: '*',
        start: '0',
        limit: '10',
      })
    );

    expect(findMany).toHaveBeenCalledWith('admin::user', {
      filters: { email: { $contains: 'a' }, $or: [{ firstname: 'a' }, {}] },
      sort: ['email:asc'],
      start: '0',
      limit: '10',
      populate: ['roles'],
    });
  });
});

describe('routes', () => {
  const expected: Record<string, string> = {
    'GET /users': 'admin::users.read',
    'GET /users/:id': 'admin::users.read',
    'POST /users': 'admin::users.create',
    'PUT /users/:id': 'admin::users.update',
    'DELETE /users/:id': 'admin::users.delete',
    'POST /users/:id/reset-password': 'admin::users.update',
    'GET /tokens': 'admin::api-tokens.read',
    'GET /tokens/:id': 'admin::api-tokens.read',
    'POST /tokens': 'admin::api-tokens.create',
    'PUT /tokens/:id': 'admin::api-tokens.update',
    'DELETE /tokens/:id': 'admin::api-tokens.delete',
    'POST /tokens/:id/revoke': 'admin::api-tokens.delete',
    'POST /tokens/:id/refresh': 'admin::api-tokens.update',
  };

  it('every route requires an authenticated admin with the matching permission', () => {
    const { routes } = createPlugin();
    expect(routes).toHaveLength(Object.keys(expected).length);
    for (const route of routes) {
      expect(route.config.policies).toEqual([
        'admin::isAuthenticatedAdmin',
        { name: 'admin::hasPermissions', config: { actions: [expected[`${route.method} ${route.path}`]] } },
      ]);
    }
  });

  it('package main default export is the same working plugin', () => {
    expect(pluginFromIndex).toBe(createPlugin);
    expect(Object.keys(pluginFromIndex().controllers).sort()).toEqual([
      'adminController',
      'tokenController',
    ]);
  });
});

describe('tokens', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const token = { id: 5, name: 't', type: 'read-only', lifespan: null, expiresAt: null };

  const stubTokens = (overrides: any = {}) => {
    const service = {
      list: vi.fn(async () => [token]),
      getById: vi.fn(async () => token),
      exists: vi.fn(async () => false),
      create: vi.fn(async (attrs: any) => ({ ...token, ...attrs, accessKey: 'k' })),
      update: vi.fn(async (_id: any, attrs: any) => ({ ...token, ...attrs })),
      revoke: vi.fn(async () => token),
      ...overrides,
    };
    const dbUpdate = vi.fn(async ({ data }: any) => ({ ...token, ...data }));
    vi.stubGlobal('strapi', {
      admin: { services: { 'api-token': service } },
      db: { query: () => ({ update: dbUpdate }) },
    });
    return { service, dbUpdate };
  };

  it('passes the calling user to list and create (Strapi 5.53 signatures)', async () => {
    const { service } = stubTokens();
    const ctx = makeCtx({ name: 'n' });
    await tokenController.find(ctx);
    await tokenController.create(ctx);
    expect(service.list).toHaveBeenCalledWith(ctx.state.user);
    expect(service.create.mock.calls[0]![1]).toBe(ctx.state.user);
  });

  it('persists lifespan/expiresAt on update via db.query (service drops them)', async () => {
    const { service, dbUpdate } = stubTokens();
    const res: any = await tokenController.update(
      makeCtx({ name: 'x', lifespan: 7 * DAY }, { id: '5' })
    );
    expect(service.update.mock.calls[0]![1]).toEqual({ name: 'x' });
    expect(dbUpdate).toHaveBeenCalledWith({
      where: { id: '5' },
      data: { lifespan: 7 * DAY, expiresAt: expect.any(Date) },
    });
    expect(res.lifespan).toBe(7 * DAY);
  });

  it('persists lifespan/expiresAt on refresh via db.query', async () => {
    const { dbUpdate } = stubTokens();
    const res: any = await tokenController.refresh(makeCtx({ lifespan: 30 * DAY }, { id: '5' }));
    expect(dbUpdate).toHaveBeenCalledWith({
      where: { id: '5' },
      data: { lifespan: 30 * DAY, expiresAt: expect.any(Date) },
    });
    expect(res.lifespan).toBe(30 * DAY);
  });

  it('rejects an unsupported lifespan with 400', async () => {
    const { dbUpdate } = stubTokens();
    await expect(
      tokenController.update(makeCtx({ lifespan: 1234 }, { id: '5' }))
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      tokenController.refresh(makeCtx({ lifespan: 1234 }, { id: '5' }))
    ).rejects.toMatchObject({ status: 400 });
    expect(dbUpdate).not.toHaveBeenCalled();
  });

  it.each(['create', 'update', 'delete', 'revoke', 'refresh'] as const)(
    '%s rethrows Strapi ValidationError instead of wrapping it as 500',
    async (method) => {
      const validationError = Object.assign(new Error('bad'), { name: 'ValidationError' });
      const fail = vi.fn(async () => {
        throw validationError;
      });
      stubTokens({ create: fail, update: fail, revoke: fail, getById: vi.fn(async () => token) });
      (globalThis as any).strapi.db.query = () => ({ update: fail });
      await expect(
        tokenController[method](makeCtx({ name: 'n', lifespan: 7 * DAY }, { id: '5' }))
      ).rejects.toBe(validationError);
    }
  );
});
