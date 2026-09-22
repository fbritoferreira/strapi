---
"@fbritoferreira/strapi": minor
---

Constrain collection and single-type uids to the typed registry.

Once `StrapiContentTypes` / `StrapiSingleTypes` are augmented — by the file
`strapi-client generate` emits, or by hand — `strapi.collection(uid)` and
`strapi.single(uid)` reject a uid the registry does not declare, so a typo is a
compile error instead of a silent `CollectionClient<object>`. A uid outside the
registry now needs an explicit type argument (`strapi.collection<Article>(uid)`).
`StrapiClientConfig["uid"]` is constrained the same way. Projects that do not
augment the registry are unaffected: any uid is still accepted.

`SortField<T>` no longer accepts an arbitrary `"anything:asc"` string. Sort
entries must start with a key of `T`; relation paths such as `"author.name:asc"`
keep working.
