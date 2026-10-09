import type { Core } from '@strapi/strapi';

const PUBLIC_ACTIONS = [
  'api::article.article.find',
  'api::article.article.findOne',
  'api::homepage.homepage.find',
];

export default {
  register() {},

  /**
   * Demo data: let the public role read the content, and seed a few articles
   * and the homepage on an empty database.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    const publicRole = await strapi
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'public' } });
    for (const action of PUBLIC_ACTIONS) {
      const granted = await strapi
        .query('plugin::users-permissions.permission')
        .findOne({ where: { action, role: publicRole.id } });
      if (!granted) {
        await strapi
          .query('plugin::users-permissions.permission')
          .create({ data: { action, role: publicRole.id } });
      }
    }

    const articles = strapi.documents('api::article.article');
    if ((await articles.count({})) === 0) {
      for (const title of ['Hello Strapi', 'Typed clients', 'Draft only']) {
        await articles.create({
          data: {
            title,
            slug: title.toLowerCase().replace(/\W+/g, '-'),
            body: `${title} — seeded by the demo app.`,
          },
          status: title === 'Draft only' ? 'draft' : 'published',
        });
      }
    }

    const homepage = strapi.documents('api::homepage.homepage');
    if (!(await homepage.findFirst())) {
      await homepage.create({ data: { title: 'Demo', description: 'Seeded by the demo app.' } });
    }
  },
};
