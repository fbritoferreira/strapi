/**
 * Content-type fixtures shaped like `strapi.contentTypes` in Strapi 5.57.
 * article: Draft and Publish + i18n, a manyToOne category, a manyToMany tags, a media cover.
 * category: neither Draft and Publish nor i18n.
 */
export const contentTypes: Record<string, any> = {
  'api::article.article': {
    uid: 'api::article.article',
    kind: 'collectionType',
    info: { displayName: 'Article', singularName: 'article' },
    options: { draftAndPublish: true },
    pluginOptions: { i18n: { localized: true } },
    attributes: {
      title: { type: 'string', required: true },
      slug: { type: 'uid', targetField: 'title' },
      views: { type: 'integer' },
      kind: { type: 'enumeration', enum: ['news', 'opinion'] },
      category: { type: 'relation', relation: 'manyToOne', target: 'api::category.category' },
      tags: { type: 'relation', relation: 'manyToMany', target: 'api::tag.tag' },
      cover: { type: 'media', multiple: false },
      seo: { type: 'component', component: 'shared.seo' },
      blocks: { type: 'dynamiczone', components: [] },
      secret: { type: 'password' },
      owner: { type: 'relation', relation: 'oneToOne', target: 'admin::user' },
      related: { type: 'relation', relation: 'morphToMany' },
      createdAt: { type: 'datetime' },
      updatedAt: { type: 'datetime' },
      publishedAt: { type: 'datetime' },
      createdBy: { type: 'relation', relation: 'oneToOne', target: 'admin::user' },
      updatedBy: { type: 'relation', relation: 'oneToOne', target: 'admin::user' },
      locale: { type: 'string' },
      localizations: { type: 'relation', relation: 'oneToMany', target: 'api::article.article' },
    },
  },
  'api::category.category': {
    uid: 'api::category.category',
    kind: 'collectionType',
    info: { displayName: 'Category', singularName: 'category' },
    options: { draftAndPublish: false },
    pluginOptions: {},
    attributes: {
      name: { type: 'string' },
      slug: { type: 'uid', targetField: 'name' },
      code: { type: 'integer', unique: true },
    },
  },
  'api::tag.tag': {
    uid: 'api::tag.tag',
    kind: 'collectionType',
    info: { displayName: 'Tag', singularName: 'tag' },
    options: {},
    pluginOptions: {},
    attributes: { label: { type: 'string', unique: true } },
  },
  'api::homepage.homepage': {
    uid: 'api::homepage.homepage',
    kind: 'singleType',
    info: { displayName: 'Homepage' },
    options: {},
    attributes: {},
  },
  'admin::user': { uid: 'admin::user', kind: 'collectionType', info: { displayName: 'User' }, attributes: {} },
  'plugin::upload.file': {
    uid: 'plugin::upload.file',
    kind: 'collectionType',
    info: { displayName: 'File' },
    pluginOptions: { 'content-manager': { visible: false } },
    attributes: {},
  },
};
