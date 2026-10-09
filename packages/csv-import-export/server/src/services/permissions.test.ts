import { describe, expect, it, vi } from 'vitest';

import { contentTypes } from '../test/strapi-mock';
import { createGuard } from './permissions';

/** CASL-like ability: a rule list of { action, subject, fields?, locales? }. */
const makeAbility = (rules: Array<{ action: string; subject: string; fields?: string[]; locales?: string[] }>) => ({
  can: vi.fn((action: string, target: any, field?: string) =>
    rules.some(
      (rule) =>
        rule.action === action &&
        rule.subject === target.__type &&
        (!field || !rule.fields || rule.fields.includes(field)) &&
        (!rule.locales || rule.locales.includes(target.locale))
    )
  ),
});

const strapi = {
  contentTypes,
  service: () => ({
    createPermissionsManager: ({ model }: { model: string }) => ({
      toSubject: (target: object, type = model) => ({ __type: type, ...target }),
    }),
  }),
};

const READ = 'plugin::content-manager.explorer.read';
const ARTICLE = 'api::article.article';

describe('createGuard', () => {
  it('allows an action when a rule covers every field', () => {
    const guard = createGuard(strapi, makeAbility([{ action: READ, subject: ARTICLE }]));
    expect(guard.can('read', ARTICLE, { locale: 'en', fields: ['title', 'slug'] })).toBe(true);
  });

  it('refuses when one field is outside the rule', () => {
    const guard = createGuard(strapi, makeAbility([{ action: READ, subject: ARTICLE, fields: ['title'] }]));
    expect(guard.can('read', ARTICLE, { locale: 'en', fields: ['title'] })).toBe(true);
    expect(guard.can('read', ARTICLE, { locale: 'en', fields: ['title', 'views'] })).toBe(false);
  });

  it('never checks documentId as a field, since role field lists do not contain it', () => {
    const guard = createGuard(strapi, makeAbility([{ action: READ, subject: ARTICLE, fields: ['title'] }]));
    expect(guard.can('read', ARTICLE, { locale: 'en', fields: ['documentId', 'title'] })).toBe(true);
  });

  it('applies i18n locale limits through the locale of the stand-in entry', () => {
    const guard = createGuard(strapi, makeAbility([{ action: READ, subject: ARTICLE, locales: ['fr'] }]));
    expect(guard.can('read', ARTICLE, { locale: 'fr', fields: ['title'] })).toBe(true);
    expect(guard.can('read', ARTICLE, { locale: 'en', fields: ['title'] })).toBe(false);
  });

  it('builds a stand-in without a locale for types that are not localized', () => {
    const ability = makeAbility([{ action: READ, subject: 'api::category.category' }]);
    createGuard(strapi, ability).can('read', 'api::category.category', { locale: 'en' });
    expect(ability.can).toHaveBeenCalledWith(READ, { __type: 'api::category.category' });
  });

  it('refuses when the ability is missing', () => {
    expect(createGuard(strapi, undefined).can('read', ARTICLE, {})).toBe(false);
  });
});
