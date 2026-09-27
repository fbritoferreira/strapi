# Retries

Off by default. Pass `retry` to repeat the failures worth repeating:

```ts
const strapi = new Strapi({
	baseURL: "http://localhost:1337",
	defaultLocale: "en",
	retry: 3, // or { attempts: 3, delay: 300, maxDelay: 10_000 }
});
```

| Option | Default | Meaning |
| --- | --- | --- |
| `attempts` | the number you passed | Extra attempts after the first request. `retry: 3` means up to four requests. |
| `delay` | `300` | First wait, in milliseconds. Doubles each attempt. |
| `maxDelay` | `10000` | Cap on the wait, including `Retry-After`. |
| `statuses` | `408`, `429`, `500`, `502`, `503`, `504` | Responses a second attempt can fix. A `400` or `404` is returned as it is. |
| `methods` | `GET`, `HEAD`, `OPTIONS` | Repeating a `POST` can create a second document, because the first may have been applied before the response was lost. Opt in with `methods: ["POST"]` when the endpoint tolerates it. |
| `network` | `true` | Retry when no response arrived. `false` turns that off. |
| `jitter` | `false` | Spread the waits when many clients retry at once. |
| `onRetry` | none | Called with `{ attempt, delay, status }` before each wait. `status` is `null` for a network failure. |

`Retry-After` is honoured, in seconds or as an HTTP date, and capped at `maxDelay`. Otherwise the wait doubles from `delay`.

`timeout` applies per attempt. An aborted `init.signal` stops the retrying: you asked for the request to stop, not to be repeated.

```ts
retry: {
	attempts: 3,
	jitter: true,
	onRetry: ({ attempt, delay, status }) => log.warn({ attempt, delay, status }),
}
```
