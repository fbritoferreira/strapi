import { afterEach, describe, expect, it, vi } from 'vitest';

import adminController from '../controllers/admin.js';

const role = { id: 1, name: 'Super Admin', code: 'strapi-super-admin' };

/** Minimal koa context stand-in; `throw` behaves like koa's (always throws). */
const makeCtx = (body: any = {}, params: any = {}): any => ({
  request: { body },
  params,
  query: {},
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
    db: { query: () => ({ findMany: async () => [role] }) },
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
      makeCtx({ password: 'Upd123!', firstName: 'Jane', role: 2 }, { id: '9' })
    );

    expect(updateById).toHaveBeenCalledWith('9', {
      password: 'Upd123!',
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
      makeCtx({ password: 'New123!' }, { id: '9' })
    );

    expect(updateById).toHaveBeenCalledWith('9', { password: 'New123!' });
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
