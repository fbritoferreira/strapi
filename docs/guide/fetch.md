# Fetch, Next.js and abort

Pass `init` on any call to merge extra `RequestInit` fields into that request. Per-call headers override the constructor headers. A string body sets `Content-Type: application/json` unless you override it. `FormData` (uploads) does not, so the runtime can set the multipart boundary.

## Next.js

`FetchInit` includes Next.js's `fetch` extension:

```ts
const [err, cached] = await articles.findMany({
	params: { populate: "*" },
	init: { next: { revalidate: 60, tags: ["articles"] } },
});
```

`next.revalidate` is a number of seconds, or `false`. `next.tags` is the list `revalidateTag` later targets.

## Aborting

`init.signal` is combined with the client's timeout via `AbortSignal.any`. Either one aborts the attempt. A timeout becomes `{ name: "TimeoutError", message }` and may be retried. An abort you requested is not retried.

```ts
const controller = new AbortController();
const [err, rows] = await articles.findMany({ init: { signal: controller.signal } });
controller.abort();
```

The timeout budget is per attempt, default 10 seconds. Set `timeout` on the constructor to change it.

## Custom fetch

```ts
const strapi = new Strapi({
	baseURL: "http://localhost:1337",
	defaultLocale: "en",
	fetch: (input, init) => myFetch(input, init),
});
```

The implementation is called with the absolute URL and the merged `RequestInit`, including the bearer token and the combined signal.

## Unwrapped requests

`strapi.http.request(path, init)` is the same transport the sub-clients use. `path` is relative to the API root (`articles?populate=*`) or an absolute URL. The result is `[error, body]` — no `meta`, and the body is not unwrapped. Non-2xx responses and network failures are `ServiceError` values, not throws. An empty body is `null`.
