---
"@fbritoferreira/strapi": minor
---

Add opt-in retries with backoff.

`retry` on the client config repeats the failures worth repeating: `408`, `429`,
`500`, `502`, `503`, `504` and requests that never reached the server. A number
sets the attempts, an object tunes the rest.

`Retry-After` is honoured — seconds or HTTP date — capped at `maxDelay`;
otherwise the wait doubles from `delay`, with optional `jitter`. The `timeout`
applies per attempt rather than to the whole sequence, and an aborted signal
stops the retrying rather than restarting it.

Only idempotent methods are retried by default. Repeating a `POST` can create a
second document, since the first may have been applied before the response was
lost, so opting in is explicit: `methods: ["POST"]`.

`RetryOptions` and `ResolvedRetry` are exported, along with the helpers behind
them.
