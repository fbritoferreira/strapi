import { describe as group, expect, it } from 'vitest';

import { contentTypes } from '../test/strapi-mock';
import { describe, listCollectionTypes } from './schema';

const strapi = { contentTypes };

group('describe', () => {
  it('lists documentId first, then importable attributes with their flags', () => {
    expect(describe(strapi, 'api::article.article')).toEqual([
      { name: 'documentId', type: 'string', required: false, unique: true },
      { name: 'title', type: 'string', required: true, unique: false },
      { name: 'slug', type: 'uid', required: false, unique: true },
      { name: 'views', type: 'integer', required: false, unique: false },
      { name: 'kind', type: 'enumeration', required: false, unique: false, enum: ['news', 'opinion'] },
      {
        name: 'category',
        type: 'relation',
        required: false,
        unique: false,
        relation: { target: 'api::category.category', multiple: false },
      },
      {
        name: 'tags',
        type: 'relation',
        required: false,
        unique: false,
        relation: { target: 'api::tag.tag', multiple: true },
      },
      { name: 'cover', type: 'media', required: false, unique: false, multiple: false },
    ]);
  });

  it('marks attributes with unique: true as unique', () => {
    expect(describe(strapi, 'api::category.category')?.find((f) => f.name === 'code')?.unique).toBe(true);
  });

  it('returns null for single types, admin types, hidden types and unknown uids', () => {
    expect(describe(strapi, 'api::homepage.homepage')).toBeNull();
    expect(describe(strapi, 'admin::user')).toBeNull();
    expect(describe(strapi, 'plugin::upload.file')).toBeNull();
    expect(describe(strapi, 'api::nope.nope')).toBeNull();
  });
});

group('listCollectionTypes', () => {
  it('lists importable collection types the user can read', () => {
    expect(listCollectionTypes(strapi, (uid) => uid !== 'api::tag.tag')).toEqual([
      { uid: 'api::article.article', displayName: 'Article', draftAndPublish: true, localized: true },
      { uid: 'api::category.category', displayName: 'Category', draftAndPublish: false, localized: false },
    ]);
  });
});
