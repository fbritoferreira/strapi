const CONTENT_MANAGER = 'plugin::content-manager.explorer.';

/**
 * Content Manager permission checks for a whole collection.
 *
 * `ability.can(action, uid)` on a bare type name ignores field limits and rule
 * conditions, so every check runs against a stand-in entry `{ locale }` and,
 * when fields are given, once per field. That honours field-level limits and
 * the i18n locale condition (`{ locale: { $in: [...] } }`). Conditions that
 * depend on the real entry, such as "is creator", cannot hold for a stand-in,
 * so users restricted by them are refused instead of being let past the limit.
 */
export const createGuard = (strapi: any, ability: any) => ({
  can(action: string, uid: string, { locale, fields = [] }: { locale?: string; fields?: string[] }): boolean {
    if (!ability) return false;
    const localized = strapi.contentTypes[uid]?.pluginOptions?.i18n?.localized === true;
    const target = strapi
      .service('admin::permission')
      .createPermissionsManager({ ability, model: uid })
      .toSubject(localized ? { locale } : {});
    const fullAction = `${CONTENT_MANAGER}${action}`;
    // documentId is never in a role's field list; it identifies the entry rather than being content.
    const checked = fields.filter((field) => field !== 'documentId');
    return checked.length === 0
      ? ability.can(fullAction, target)
      : checked.every((field) => ability.can(fullAction, target, field));
  },
});
