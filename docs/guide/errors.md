# Errors

Every method returns `[error, data, meta]`. `data` and `meta` are `null` when `error` is set. Two-element destructuring still works; the third element is ignored.

```ts
interface ServiceError {
	message: string;
	status?: number;
	name?: string;
	details?: unknown;
	cause?: unknown;
}
```

`name` is Strapi's own error name (`"ValidationError"`, `"NotFoundError"`, …) when Strapi returned one, or one of `"HTTPError"`, `"TimeoutError"`, `"NetworkError"` for failures the client classifies itself. `details` is Strapi's `error.details`. `cause` is the thrown value on a network or timeout failure.

A missing document is `{ status: 404, name: "NotFoundError", message: "Not Found" }`, including when Strapi answers 200 with an empty body on a read that must return a document.

## Validation errors

A validation error carries field-level problems in `details`. Strapi shapes that differently per error — a rejected query param reports `{ source, param }`, for instance — so `details` stays `unknown` and `validationIssues` reads the validation case:

```ts
import { validationIssues } from "@fbritoferreira/strapi";

const [err] = await articles.create({ payload: { data: {} } });
for (const issue of validationIssues(err)) {
	form.setError(issue.path.join("."), issue.message);
}
```

Each issue is `{ path: (string | number)[], message: string, name?: string }`. The function returns `[]` for any error without that shape, including `null`. `isValidationDetails` narrows `details` directly.

```ts
const [err, created] = await articles.create({ payload: { data: { title: "" } } });
if (err) {
	if (err.name === "ValidationError") console.error(err.details);
	throw new Error(`${err.name}: ${err.message}`);
}
```

GraphQL errors are the same tuple: the whole `errors` array is `details`, and a single error's `extensions.code` is `name` (otherwise `"GraphQLError"`). See [GraphQL](/graphql/).
