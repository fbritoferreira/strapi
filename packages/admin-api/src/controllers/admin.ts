import type { Context } from 'koa';

declare const strapi: any;

interface AdminController {
  find(ctx: Context): Promise<any>;
  findOne(ctx: Context): Promise<any>;
  create(ctx: Context): Promise<any>;
  update(ctx: Context): Promise<any>;
  delete(ctx: Context): Promise<any>;
  resetPassword(ctx: Context): Promise<any>;
}

/**
 * Admin API Controller
 * Provides CRUD operations for Strapi admin users
 */

const adminController: AdminController = {
  /**
   * List admin users with pagination and filtering
   */
  async find(ctx: Context) {
    try {
      const { query } = ctx;

      // Query admin users
      const users = await strapi.entityService.findMany('admin::user', {
        ...query,
        populate: ['roles'],
      });

      // Hide password from response
      const sanitized = users.map((user: any) => ({
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstname,
        lastName: user.lastname,
        isActive: user.isActive,
        blocked: user.blocked,
        role: user.roles?.[0]
          ? {
              id: user.roles[0].id,
              name: user.roles[0].name,
              code: user.roles[0].code,
            }
          : null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }));

      return sanitized;
    } catch (error: any) {
      ctx.throw(500, `Failed to fetch admin users: ${error.message}`);
    }
  },

  /**
   * Get a single admin user by ID
   */
  async findOne(ctx: Context) {
    try {
      const { id } = ctx.params;

      const user = await strapi.entityService.findOne('admin::user', id, {
        populate: ['roles'],
      });

      if (!user) {
        ctx.throw(404, 'Admin user not found');
      }

      // Hide password from response
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstname,
        lastName: user.lastname,
        isActive: user.isActive,
        blocked: user.blocked,
        role: user.roles?.[0]
          ? {
              id: user.roles[0].id,
              name: user.roles[0].name,
              code: user.roles[0].code,
            }
          : null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    } catch (error: any) {
      if (error.status === 404) throw error;
      ctx.throw(500, `Failed to fetch admin user: ${error.message}`);
    }
  },

  /**
   * Create a new admin user
   */
  async create(ctx: Context) {
    try {
      const body = (ctx.request as any).body as any;

      // Validate required fields
      if (!body.email || !body.username || !body.password) {
        ctx.throw(400, 'email, username, and password are required');
      }

      // Get the super-admin role (Strapi 5 codes are prefixed with `strapi-`)
      const roles = await strapi.db.query('admin::role').findMany({
        where: { code: 'strapi-super-admin' },
      });

      if (roles.length === 0) {
        ctx.throw(400, 'Super-admin role not found');
      }

      const role = roles[0];

      // Create through Strapi's own user service: it hashes the password and
      // writes via db.query. Going through entityService instead would hash a
      // second time (document-service transform re-hashes password attributes),
      // producing credentials that can never log in.
      const user = await strapi.admin.services.user.create({
        email: body.email,
        username: body.username,
        password: body.password,
        firstname: body.firstName || '',
        lastname: body.lastName || '',
        isActive: body.isActive !== undefined ? body.isActive : true,
        blocked: false,
        roles: [role.id],
      });

      // Return sanitized user (no password)
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstname,
        lastName: user.lastname,
        isActive: user.isActive,
        blocked: user.blocked,
        role: {
          id: role.id,
          name: role.name,
          code: role.code,
        },
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    } catch (error: any) {
      if (error.status) throw error;
      ctx.throw(500, `Failed to create admin user: ${error.message}`);
    }
  },

  /**
   * Update an existing admin user
   */
  async update(ctx: Context) {
    try {
      const { id } = ctx.params;
      const body = (ctx.request as any).body as any;

      // Check if user exists
      const existingUser = await strapi.entityService.findOne('admin::user', id);
      if (!existingUser) {
        ctx.throw(404, 'Admin user not found');
      }

      // Pick known fields only; the schema uses firstname/lastname while the
      // API documents firstName/lastName. entityService tolerated unknown keys,
      // db.query does not — and passing the raw body through would also allow
      // writing resetPasswordToken/registrationToken.
      const updateData: any = {};
      if (body.email !== undefined) updateData.email = body.email;
      if (body.username !== undefined) updateData.username = body.username;
      if (body.password) updateData.password = body.password;
      if (body.firstName !== undefined) updateData.firstname = body.firstName;
      if (body.lastName !== undefined) updateData.lastname = body.lastName;
      if (body.isActive !== undefined) updateData.isActive = body.isActive;
      if (body.blocked !== undefined) updateData.blocked = body.blocked;
      if (body.roles !== undefined) updateData.roles = body.roles;
      else if (body.role !== undefined) updateData.roles = [body.role];

      // Strapi's own service hashes a new password once and writes via db.query
      // (entityService would double-hash), plus guards the last super admin.
      const user = await strapi.admin.services.user.updateById(id, updateData);

      // Return sanitized user (no password)
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstname,
        lastName: user.lastname,
        isActive: user.isActive,
        blocked: user.blocked,
        role: user.roles?.[0]
          ? {
              id: user.roles[0].id,
              name: user.roles[0].name,
              code: user.roles[0].code,
            }
          : null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    } catch (error: any) {
      if (error.status || error.name === 'ValidationError') throw error;
      ctx.throw(500, `Failed to update admin user: ${error.message}`);
    }
  },

  /**
   * Delete an admin user
   */
  async delete(ctx: Context) {
    try {
      const { id } = ctx.params;

      // Check if user exists
      const existingUser = await strapi.entityService.findOne('admin::user', id, {
        populate: ['roles'],
      });
      if (!existingUser) {
        ctx.throw(404, 'Admin user not found');
      }

      // Prevent deleting super-admin
      if (existingUser.roles?.some((r: any) => r.code === 'strapi-super-admin')) {
        ctx.throw(400, 'Cannot delete super-admin user');
      }

      // Delete the user
      await strapi.entityService.delete('admin::user', id);

      return {
        success: true,
        message: 'Admin user deleted successfully',
      };
    } catch (error: any) {
      if (error.status === 404 || error.status === 400) throw error;
      ctx.throw(500, `Failed to delete admin user: ${error.message}`);
    }
  },

  /**
   * Reset password for an admin user
   */
  async resetPassword(ctx: Context): Promise<any> {
    try {
      const { id } = ctx.params;
      const { password } = (ctx.request as any).body as any;

      if (!password) {
        ctx.throw(400, 'Password is required');
      }

      // Check if user exists
      const existingUser = await strapi.entityService.findOne('admin::user', id);
      if (!existingUser) {
        ctx.throw(404, 'Admin user not found');
      }

      // Hash and update password via Strapi's own service: it writes through
      // db.query, which does not re-hash password attributes like entityService
      // does (double-hash -> the new password could never log in).
      await strapi.admin.services.user.updateById(id, { password });

      return {
        success: true,
        message: 'Password reset successfully',
      };
    } catch (error: any) {
      if (error.status || error.name === 'ValidationError') throw error;
      ctx.throw(500, `Failed to reset password: ${error.message}`);
    }
  },
};

export default adminController;
