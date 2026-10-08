# Configuration

`new Strapi(config)` throws a `TypeError` when `baseURL` or `defaultLocale` is missing or blank. There is no implicit `"en"` locale.

```ts
const strapi = new Strapi({
	baseURL: "http://localhost:1337",
	defaultLocale: "en",
	token: process.env.STRAPI_TOKEN,
	headers: { "X-Custom": "1" },
	fetch: myFetch,
	timeout: 5_000,
	concurrency: 10,
	retry: 3,
	graphqlEndpoint: "/graphql",
	graphqlArgs: strapiGraphqlArgs,
});
```

| Option | Default | What it does |
| --- | --- | --- |
| `baseURL` | required | Strapi origin. A trailing slash is stripped. `/api` is appended when the URL does not already end in it, so both `http://localhost:1337` and `http://localhost:1337/api` are the REST root. |
| `defaultLocale` | required | Locale omitted from query strings, because Strapi treats it as the default. |
| `token` | none | API token or JWT sent as `Authorization: Bearer`. Change it later with `setToken`. |
| `headers` | `{}` | Extra headers merged into every request. Per-call `init.headers` win. |
| `fetch` | `globalThis.fetch` | Custom implementation. |
| `timeout` | `10000` | Milliseconds before a request is aborted. Applies per attempt, not to a retry sequence. |
| `concurrency` | `5` | Max parallel requests when `findMany({ all: true })` fetches the remaining pages. |
| `retry` | off | A number is the extra attempts. An object tunes backoff, statuses and methods. See [Retries](/guide/retries). |
| `refreshOnUnauthorized` | off | On a 401, rotate a refresh token and retry once. See [Authentication](/guide/authentication). |
| `graphqlEndpoint` | `"/graphql"` | Path resolved against the origin, not the `/api` root. Match the plugin's `endpoint` option. |
| `graphqlArgs` | none | The generated `strapiGraphqlArgs`. Required by `query()` and `mutate()`. |

`strapi.http` is the shared `HttpClient`. Use `strapi.http.request(path, init)` for an endpoint this client does not wrap. `path` is relative to the API root, or an absolute `http(s)` URL. `strapi.graphqlUrl` is the resolved GraphQL URL.

`setToken(token)` replaces the bearer token for every later request. `setToken(undefined)` clears it. A JWT from `auth.login` is not adopted automatically: one client is often shared, and silently rebinding its identity is rarely what you want.

A content-type call also accepts `locale` (overrides `defaultLocale` for that call) and `init` (merged `RequestInit`, including an `AbortSignal` and Next.js `fetch` extensions). See [Fetch, Next.js and abort](/guide/fetch).
