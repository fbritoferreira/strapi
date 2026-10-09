import type { Context } from 'koa';

declare const strapi: any;

/**
 * Admin API Token Controller
 * Provides CRUD operations for Strapi admin API tokens (admin::api-token),
 * backed by Strapi's official api-token service.
 */

export interface TokenController {
  find(ctx: Context): Promise<unknown>;
  findOne(ctx: Context): Promise<unknown>;
  create(ctx: Context): Promise<unknown>;
  update(ctx: Context): Promise<unknown>;
  delete(ctx: Context): Promise<unknown>;
  revoke(ctx: Context): Promise<unknown>;
  refresh(ctx: Context): Promise<unknown>;
}

const apiTokenService = () => strapi.admin.services['api-token'];

// Strip secrets (accessKey/encryptedKey) from responses.
const sanitize = (token: any) => ({
  id: token.id,
  name: token.name,
  description: token.description,
  type: token.type,
  lifespan: token.lifespan,
  expiresAt: token.expiresAt,
  lastUsedAt: token.lastUsedAt,
  permissions: token.permissions,
  createdAt: token.createdAt,
  updatedAt: token.updatedAt,
});

// Strapi's allowed API token lifespans (API_TOKEN_LIFESPANS): unlimited, 7, 30, 90 days.
const DAY_MS = 24 * 60 * 60 * 1000;
const LIFESPANS = [null, 7 * DAY_MS, 30 * DAY_MS, 90 * DAY_MS];

const assertLifespan = (ctx: Context, lifespan: unknown) => {
  if (!LIFESPANS.includes(lifespan as number | null)) {
    ctx.throw(400, `lifespan must be one of: ${LIFESPANS.join(', ')}`);
  }
};

// Strapi 5.x api-token service.update() only writes name/description/type, so
// expiration fields are persisted directly.
const persistExpiration = async (id: unknown, lifespan: number | null, expiresAt: Date | null) => {
  await strapi.db.query('admin::api-token').update({ where: { id }, data: { lifespan, expiresAt } });
  return { lifespan, expiresAt };
};

// Koa HttpErrors carry a status; Strapi's ValidationError has none but its
// error middleware turns it into a 400, so both must escape the 500 wrapper.
const isClientError = (error: any) => Boolean(error.status) || error.name === 'ValidationError';

const tokenController: TokenController = {
  /**
   * List all API tokens
   */
  async find(ctx: Context): Promise<unknown> {
    try {
      if (!ctx.state.user) {
        ctx.throw(401, 'Authentication required');
      }

      const tokens = await apiTokenService().list(ctx.state.user);
      return (tokens ?? []).map(sanitize);
    } catch (error: any) {
      if (error.status === 401) throw error;
      ctx.throw(500, `Failed to fetch tokens: ${error.message}`);
    }
  },

  /**
   * Get a single API token by ID
   */
  async findOne(ctx: Context): Promise<unknown> {
    try {
      const { id } = ctx.params;
      if (!ctx.state.user) {
        ctx.throw(401, 'Authentication required');
      }

      const token = await apiTokenService().getById(id);
      if (!token) {
        ctx.throw(404, 'Token not found');
      }

      return sanitize(token);
    } catch (error: any) {
      if (error.status === 401 || error.status === 404) throw error;
      ctx.throw(500, `Failed to fetch token: ${error.message}`);
    }
  },

  /**
   * Create a new API token
   */
  async create(ctx: Context): Promise<unknown> {
    try {
      const body = (ctx.request as any).body as any;
      if (!ctx.state.user) {
        ctx.throw(401, 'Authentication required');
      }

      // Accept `label` as an alias for `name`
      const name = body.name ?? body.label;
      if (!name) {
        ctx.throw(400, 'name is required');
      }

      const type = ['read-only', 'full-access', 'custom'].includes(body.type)
        ? body.type
        : 'read-only';

      const service = apiTokenService();
      if (await service.exists({ name })) {
        ctx.throw(400, 'Name already taken');
      }

      const token = await service.create(
        {
          name,
          description: body.description ?? '',
          type,
          lifespan: body.lifespan ?? null,
          ...(type === 'custom' ? { permissions: body.permissions ?? [] } : {}),
        },
        ctx.state.user
      );

      // accessKey is only available on creation
      return {
        ...sanitize(token),
        accessKey: token.accessKey,
        message: 'Token created successfully',
      };
    } catch (error: any) {
      if (isClientError(error)) throw error;
      ctx.throw(500, `Failed to create token: ${error.message}`);
    }
  },

  /**
   * Update an existing token
   */
  async update(ctx: Context): Promise<unknown> {
    try {
      const { id } = ctx.params;
      const body = (ctx.request as any).body as any;
      if (!ctx.state.user) {
        ctx.throw(401, 'Authentication required');
      }

      const service = apiTokenService();
      const existingToken = await service.getById(id);
      if (!existingToken) {
        ctx.throw(404, 'Token not found');
      }

      if (body.lifespan !== undefined) assertLifespan(ctx, body.lifespan);

      const updateData: any = {};
      for (const key of ['name', 'description', 'type', 'permissions']) {
        if (body[key] !== undefined) updateData[key] = body[key];
      }

      const token = Object.keys(updateData).length
        ? await service.update(id, updateData)
        : existingToken;
      // Service only recomputes expiration on create, do it here for lifespan changes
      if (body.lifespan !== undefined) {
        const expiration = await persistExpiration(
          id,
          body.lifespan,
          body.lifespan ? new Date(Date.now() + body.lifespan) : null
        );
        return sanitize({ ...token, ...expiration });
      }
      return sanitize(token);
    } catch (error: any) {
      if (isClientError(error)) throw error;
      ctx.throw(500, `Failed to update token: ${error.message}`);
    }
  },

  /**
   * Delete a token
   */
  async delete(ctx: Context): Promise<unknown> {
    try {
      const { id } = ctx.params;
      if (!ctx.state.user) {
        ctx.throw(401, 'Authentication required');
      }

      const service = apiTokenService();
      if (!(await service.getById(id))) {
        ctx.throw(404, 'Token not found');
      }

      await service.revoke(id);

      return {
        success: true,
        message: 'Token deleted successfully',
      };
    } catch (error: any) {
      if (isClientError(error)) throw error;
      ctx.throw(500, `Failed to delete token: ${error.message}`);
    }
  },

  /**
   * Revoke a token (delete it, matching Strapi's own revoke semantics)
   */
  async revoke(ctx: Context): Promise<unknown> {
    try {
      const { id } = ctx.params;
      if (!ctx.state.user) {
        ctx.throw(401, 'Authentication required');
      }

      const service = apiTokenService();
      if (!(await service.getById(id))) {
        ctx.throw(404, 'Token not found');
      }

      await service.revoke(id);

      return {
        success: true,
        message: 'Token revoked successfully',
      };
    } catch (error: any) {
      if (isClientError(error)) throw error;
      ctx.throw(500, `Failed to revoke token: ${error.message}`);
    }
  },

  /**
   * Refresh a token's expiration (lifespan: null | 7d | 30d | 90d)
   */
  async refresh(ctx: Context): Promise<unknown> {
    try {
      const { id } = ctx.params;
      const body = ((ctx.request as any).body ?? {}) as any;
      if (!ctx.state.user) {
        ctx.throw(401, 'Authentication required');
      }

      const token = await apiTokenService().getById(id);
      if (!token) {
        ctx.throw(404, 'Token not found');
      }

      const lifespan = body.lifespan ?? null;
      assertLifespan(ctx, lifespan);
      const expiresAt = body.expiresAt
        ? new Date(body.expiresAt)
        : lifespan
          ? new Date(Date.now() + lifespan)
          : null;
      if (expiresAt && Number.isNaN(expiresAt.getTime())) {
        ctx.throw(400, 'expiresAt must be a valid date');
      }

      const expiration = await persistExpiration(id, lifespan, expiresAt);

      return {
        ...sanitize({ ...token, ...expiration }),
        message: 'Token expiration refreshed successfully',
      };
    } catch (error: any) {
      if (isClientError(error)) throw error;
      ctx.throw(500, `Failed to refresh token: ${error.message}`);
    }
  },
};

export default tokenController;
