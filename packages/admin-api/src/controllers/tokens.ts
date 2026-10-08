import { randomBytes } from 'node:crypto';
import type { Context } from 'koa';

declare const strapi: any;

/**
 * Admin API Token Controller
 * Provides CRUD operations for admin authentication tokens
 */

// ponytail: strapi.entityService doesn't support `where` on findOne;
// strapi.db.query is the correct escape hatch for owner-scoped lookups.
const tokenController = {
  /**
   * List all tokens for the authenticated user
   */
  async find(ctx: Context): Promise<any> {
    try {
      const user = ctx.state.user;
      if (!user) {
        ctx.throw(401, 'Authentication required');
      }

      const tokens = await strapi.db.query('admin::token').findMany({
        where: { user: user.id },
        orderBy: { createdAt: 'desc' },
      });

      return (tokens as any[]).map((token) => ({
        id: token.id,
        label: token.label,
        type: token.type,
        expiresAt: token.expiresAt,
        createdAt: token.createdAt,
        updatedAt: token.updatedAt,
        active: token.active !== false,
      }));
    } catch (error: any) {
      ctx.throw(500, `Failed to fetch tokens: ${error.message}`);
    }
  },

  /**
   * Get a single token by ID
   */
  async findOne(ctx: Context): Promise<any> {
    try {
      const { id } = ctx.params;
      const { user } = ctx.state;

      if (!user) {
        ctx.throw(401, 'Authentication required');
      }

      const token = await strapi.db.query('admin::token').findOne({
        where: { id: Number(id), user: user.id },
      });

      if (!token) {
        ctx.throw(404, 'Token not found');
      }

      return {
        id: token.id,
        label: token.label,
        type: token.type,
        expiresAt: token.expiresAt,
        createdAt: token.createdAt,
        updatedAt: token.updatedAt,
        active: token.active !== false,
      };
    } catch (error: any) {
      if (error.status === 401 || error.status === 404) throw error;
      ctx.throw(500, `Failed to fetch token: ${error.message}`);
    }
  },

  /**
   * Create a new admin token
   */
  async create(ctx: Context): Promise<any> {
    try {
      const body = (ctx.request as any).body as {
        label?: string;
        type?: string;
        expiresAt?: string;
      };
      const { user } = ctx.state;

      if (!user) {
        ctx.throw(401, 'Authentication required');
      }

      if (!body.label) {
        ctx.throw(400, 'label is required');
      }

      const tokenValue = randomBytes(64).toString('base64');

      const expiresAt = body.expiresAt
        ? new Date(body.expiresAt)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const token = await strapi.db.query('admin::token').create({
        data: {
          user: user.id,
          label: body.label,
          type: body.type || 'api',
          value: tokenValue,
          expiresAt,
          active: true,
        },
      });

      return {
        id: token.id,
        label: token.label,
        type: token.type,
        expiresAt: token.expiresAt,
        createdAt: token.createdAt,
        message: 'Token created successfully',
        value: tokenValue,
      };
    } catch (error: any) {
      ctx.throw(500, `Failed to create token: ${error.message}`);
    }
  },

  /**
   * Update an existing token
   */
  async update(ctx: Context): Promise<any> {
    try {
      const { id } = ctx.params;
      const body = (ctx.request as any).body as any;
      const { user } = ctx.state;

      if (!user) {
        ctx.throw(401, 'Authentication required');
      }

      const existingToken = await strapi.db.query('admin::token').findOne({
        where: { id: Number(id), user: user.id },
      });

      if (!existingToken) {
        ctx.throw(404, 'Token not found');
      }

      const updateData: any = { ...(body as object) };
      delete updateData.value;
      delete updateData.user;

      const token = await strapi.db.query('admin::token').update({
        where: { id: Number(id) },
        data: updateData,
      });

      return {
        id: token.id,
        label: token.label,
        type: token.type,
        expiresAt: token.expiresAt,
        active: token.active !== false,
      };
    } catch (error: any) {
      if (error.status === 401 || error.status === 404) throw error;
      ctx.throw(500, `Failed to update token: ${error.message}`);
    }
  },

  /**
   * Delete a token
   */
  async delete(ctx: Context): Promise<any> {
    try {
      const { id } = ctx.params;
      const { user } = ctx.state;

      if (!user) {
        ctx.throw(401, 'Authentication required');
      }

      const existingToken = await strapi.db.query('admin::token').findOne({
        where: { id: Number(id), user: user.id },
      });

      if (!existingToken) {
        ctx.throw(404, 'Token not found');
      }

      await strapi.db.query('admin::token').delete({
        where: { id: Number(id) },
      });

      return {
        success: true,
        message: 'Token deleted successfully',
      };
    } catch (error: any) {
      if (error.status === 401 || error.status === 404) throw error;
      ctx.throw(500, `Failed to delete token: ${error.message}`);
    }
  },

  /**
   * Revoke/expire a token immediately
   */
  async revoke(ctx: Context): Promise<any> {
    try {
      const { id } = ctx.params;
      const { user } = ctx.state;

      if (!user) {
        ctx.throw(401, 'Authentication required');
      }

      const existingToken = await strapi.db.query('admin::token').findOne({
        where: { id: Number(id), user: user.id },
      });

      if (!existingToken) {
        ctx.throw(404, 'Token not found');
      }

      await strapi.db.query('admin::token').update({
        where: { id: Number(id) },
        data: { active: false },
      });

      return {
        success: true,
        message: 'Token revoked successfully',
      };
    } catch (error: any) {
      if (error.status === 401 || error.status === 404) throw error;
      ctx.throw(500, `Failed to revoke token: ${error.message}`);
    }
  },

  /**
   * Refresh a token (extend expiration)
   */
  async refresh(ctx: Context): Promise<any> {
    try {
      const { id } = ctx.params;
      const body = (ctx.request as any).body as { expiresAt?: string };
      const { user } = ctx.state;

      if (!user) {
        ctx.throw(401, 'Authentication required');
      }

      const existingToken = await strapi.db.query('admin::token').findOne({
        where: { id: Number(id), user: user.id },
      });

      if (!existingToken) {
        ctx.throw(404, 'Token not found');
      }

      const expiresAt = body.expiresAt
        ? new Date(body.expiresAt)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const token = await strapi.db.query('admin::token').update({
        where: { id: Number(id) },
        data: { expiresAt },
      });

      return {
        id: token.id,
        expiresAt: token.expiresAt,
        message: 'Token expiration refreshed successfully',
      };
    } catch (error: any) {
      if (error.status === 401 || error.status === 404) throw error;
      ctx.throw(500, `Failed to refresh token: ${error.message}`);
    }
  },
};

export default tokenController;
