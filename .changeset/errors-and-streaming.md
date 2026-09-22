---
"@fbritoferreira/strapi": minor
---

Read validation errors without a cast, and walk pages without buffering them.

`validationIssues(error)` returns the field-level problems Strapi reports —
`{ path, message, name, value? }` — or an empty list for an error that carries
none. Both yup and zod routes produce that same `details.errors` shape, while
other errors put other things in `details` (a rejected query param reports
`{ source, param }`), so `details` stays `unknown` and the helper narrows it.
`isValidationDetails` and the `StrapiValidationIssue` / `StrapiValidationDetails`
types are exported alongside it.

`collection.pages()` walks a collection one page at a time, fetching the next
only when the consumer asks for it, where `findMany({ all: true })`
concatenates everything in memory. Each iteration yields the usual
`[error, data, meta]` tuple, `params` narrow each page as they do elsewhere,
breaking out of the loop stops the requests, and both pagination modes are
followed in whichever mode the caller asked for.
