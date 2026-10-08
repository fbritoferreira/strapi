import type { Context } from '@strapi/strapi';

/**
 * Admin API Token Controller
 * Provides CRUD operations for admin authentication tokens
 */

export default {
  /**
   * List all tokens for the authenticated user
   */
  async find(ctx: Context) {
    try {
      const { query } = ctx;

      // Get the authenticated user from the context
      const user = ctx.state.user;
      if (!user) {
        ctx.throw(401, 'Authentication required');
      }

      // Query tokens for this user
      const tokens = await strapi.entityService.findMany('admin::token', {
        ...query,
        where: { user: user.id },
      });

      return tokens.map((token: any) => ({
        id: token.id,
        label: token.label,
        type: token.type,
        value: token.value,
        expiresAt: token.expiresAt,
        createdAt: token.createdAt,
        updatedAt: token.updatedAt,
        active: token.active !== false, // default to true if not specified
      }));
    } catch (error: any) {
      ctx.throw(500, `Failed to fetch tokens: ${error.message}`);
    }
  },

  /**
   * Get a single token by ID
   */
  async findOne(ctx: Context) {
    try {
      const { id } = ctx.params;
      const { user } = ctx.state;

      if (!user) {
        ctx.throw(401, 'Authentication required');
      }

      const token = await strapi.entityService.findOne('admin::token', id, {
        where: { user: user.id },
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
  async create(ctx: Context) {
    try {
      const { body } = ctx;
      const { user } = ctx.state;

      if (!user) {
        ctx.throw(401, 'Authentication required');
      }

      // Validate required fields
      if (!body.label) {
        ctx.throw(400, 'label is required');
      }

      // Generate a secure random token
      const tokenValue = crypto.randomBytes(64).toString('base64');

      // Determine expiration (default: 30 days if not specified)
      let expiresAt: Date | null = null;
      if (body.expiresAt) {
        expiresAt = new Date(body.expiresAt);
      } else {
        expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      }

      // Create the token
      const token = await strapi.entityService.create('admin::token', {
        data: {
          user: user.id,
          label: body.label,
          type: body.type || 'api', // default: api token
          value: tokenValue,
          expiresAt,
          active: true,
        },
      });

      // Don't return the actual token value, just confirmation
      return {
        id: token.id,
        label: token.label,
        type: token.type,
        expiresAt: token.expiresAt,
        createdAt: token.createdAt,
        message: 'Token created successfully',
        // Note: In production, you might want to send this via email instead
        value: tokenValue, // Only temporarily returned for creation
      };
    } catch (error: any) {
      ctx.throw(500, `Failed to create token: ${error.message}`);
    }
  },

  /**
   * Update an existing token
   */
  async update(ctx: Context) {
    try {
      const { id } = ctx.params;
      const { body } = ctx;
      const { user } = ctx.state;

      if (!user) {
        ctx.throw(401, 'Authentication required');
      }

      // Check if token exists and belongs to this user
      const existingToken = await strapi.entityService.findOne('admin::token', id, {
        where: { user: user.id },
      });

      if (!existingToken) {
        ctx.throw(404, 'Token not found');
      }

      // Prepare update data
      const updateData: any = { ...body };

      // Don't allow changing the value (requires regeneration instead)
      delete updateData.value;

      // Update the token
      const token = await strapi.entityService.update('admin::token', id, {
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
  async delete(ctx: Context) {
    try {
      const { id } = ctx.params;
      const { user } = ctx.state;

      if (!user) {
        ctx.throw(401, 'Authentication required');
      }

      // Check if token exists and belongs to this user
      const existingToken = await strapi.entityService.findOne('admin::token', id, {
        where: { user: user.id },
      });

      if (!existingToken) {
        ctx.throw(404, 'Token not found');
      }

      // Delete the token
      await strapi.entityService.delete('admin::token', id);

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
  async revoke(ctx: Context) {
    try {
      const { id } = ctx.params;
      const { user } = ctx.state;

      if (!user) {
        ctx.throw(401, 'Authentication required');
      }

      // Check if token exists and belongs to this user
      const existingToken = await strapi.entityService.findOne('admin::token', id, {
        where: { user: user.id },
      });

      if (!existingToken) {
        ctx.throw(404, 'Token not found');
      }

      // Revoke the token by setting active to false
      await strapi.entityService.update('admin::token', id, {
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
  async refresh(ctx: Context) {
    try {
      const { id } = ctx.params;
      const body = ctx.request.body as { expiresAt?: string };
      const { user } = ctx.state;

      if (!user) {
        ctx.throw(401, 'Authentication required');
      }

      // Check if token exists and belongs to this user
      const existingToken = await strapi.entityService.findOne('admin::token', id, {
        where: { user: user.id },
      });

      if (!existingToken) {
        ctx.throw(404, 'Token not found');
      }

      // Set new expiration (default: 30 days if not specified)
      let expiresAt: Date;
      if (body.expiresAt) {
        expiresAt = new Date(body.expiresAt);
      } else {
        expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      }

      // Update expiration
      const token = await strapi.entityService.update('admin::token', id, {
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
