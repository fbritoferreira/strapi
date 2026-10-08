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
        populate: ['role'],
      });

      // Hide password from response
      const sanitized = users.map((user: any) => ({
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
        blocked: user.blocked,
        role: user.role?.id
          ? {
              id: user.role.id,
              name: user.role.name,
              code: user.role.code,
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
        populate: ['role'],
      });

      if (!user) {
        ctx.throw(404, 'Admin user not found');
      }

      // Hide password from response
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
        blocked: user.blocked,
        role: user.role?.id
          ? {
              id: user.role.id,
              name: user.role.name,
              code: user.role.code,
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

      // Hash the password
      const hashedPassword = await strapi.admin.services.auth.hashPassword(
        body.password
      );

      // Get the super-admin role
      const roles = await strapi.db.query('admin::role').findMany({
        where: { code: 'super-admin' },
      });

      if (roles.length === 0) {
        ctx.throw(400, 'Super-admin role not found');
      }

      const role = roles[0];

      // Create the admin user
      const user = await strapi.entityService.create('admin::user', {
        data: {
          email: body.email,
          username: body.username,
          password: hashedPassword,
          firstName: body.firstName || '',
          lastName: body.lastName || '',
          isActive: body.isActive !== undefined ? body.isActive : true,
          blocked: false,
          role: role.id,
        },
      });

      // Return sanitized user (no password)
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
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

      // Prepare update data
      const updateData: any = { ...body };

      // Hash password if provided
      if (body.password) {
        updateData.password = await strapi.admin.services.auth.hashPassword(
          body.password
        );
      }

      // Update the user
      const user = await strapi.entityService.update('admin::user', id, {
        data: updateData,
        populate: ['role'],
      });

      // Return sanitized user (no password)
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
        blocked: user.blocked,
        role: user.role?.id
          ? {
              id: user.role.id,
              name: user.role.name,
              code: user.role.code,
            }
          : null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    } catch (error: any) {
      if (error.status === 404) throw error;
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
      const existingUser = await strapi.entityService.findOne('admin::user', id);
      if (!existingUser) {
        ctx.throw(404, 'Admin user not found');
      }

      // Prevent deleting super-admin
      if (existingUser.role?.code === 'super-admin') {
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

      // Hash and update password
      const hashedPassword = await strapi.admin.services.auth.hashPassword(
        password
      );

      await strapi.entityService.update('admin::user', id, {
        data: {
          password: hashedPassword,
        },
      });

      return {
        success: true,
        message: 'Password reset successfully',
      };
    } catch (error: any) {
      if (error.status === 404) throw error;
      ctx.throw(500, `Failed to reset password: ${error.message}`);
    }
  },
};

export default adminController;
