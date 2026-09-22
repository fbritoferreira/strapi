---
"@fbritoferreira/strapi": minor
---

Split `fields` from `populate` in generated types.

`strapi-client generate` now emits a `__populatable` marker on every content
type and component, listing the fields Strapi populates (relations, components,
media, dynamic zones). `fields` and `sort` accept only the remaining scalar
fields; `populate` accepts only the marked ones, as a single field, a list, a
dotted path or a nested map. Selecting a field with the wrong param is a compile
error instead of a request Strapi silently ignores.

The marker is type-level only: Strapi never returns it, and it is excluded from
`filters`, `sort` and create/update payloads. Types written by hand, with no
marker, keep accepting any key in both params.

`Populate<T>` no longer falls back to `string[]`, so a typo in a populate list
is caught for hand-written types too. `ScalarKey`, `PopulatableKey`,
`PopulatePath` and `PopulatableMarker` are exported.
