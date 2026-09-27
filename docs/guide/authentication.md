# Authentication

`strapi.auth` covers the users-permissions routes at `/api/auth/*`. These routes have no `data`/`meta` envelope. The returned `jwt` is not applied to later requests; pass it to `setToken` when you want that.

```ts
const [err, session] = await strapi.auth.login({ identifier: "me@example.com", password: "…" });
if (err) throw new Error(err.message);

strapi.setToken(session.jwt);
```

| Method | Route | Body | Result |
| --- | --- | --- | --- |
| `login` | `POST /api/auth/local` | `identifier`, `password` | `{ jwt, refreshToken?, user }` |
| `register` | `POST /api/auth/local/register` | `username`, `email`, `password` | `{ jwt?, refreshToken?, user }`. `jwt` is absent when email confirmation is enabled. |
| `forgotPassword` | `POST /api/auth/forgot-password` | `email` | `{ ok: true }` |
| `resetPassword` | `POST /api/auth/reset-password` | `code`, `password`, `passwordConfirmation` | a session, same shape as `login` |
| `changePassword` | `POST /api/auth/change-password` | `currentPassword`, `password`, `passwordConfirmation` | a session. Needs the signed-in user's token. |
| `sendEmailConfirmation` | `POST /api/auth/send-email-confirmation` | `email` | `{ email, sent }` |
| `refresh` | `POST /api/auth/refresh` | `refreshToken?` | `{ jwt, refreshToken? }` |
| `logout` | `POST /api/auth/logout` | `scope?`, `deviceId?` | `{ ok: true }` |

`refresh` and `logout` exist only when the plugin runs with `jwtManagement: "refresh"`. Otherwise Strapi answers 404 and the error message says to enable that mode. With an httpOnly refresh cookie, omit `refreshToken`: it travels in the cookie, and the response may omit it too.

```ts
if (session.refreshToken !== undefined) {
	const [refreshErr, refreshed] = await strapi.auth.refresh({ refreshToken: session.refreshToken });
	if (!refreshErr) strapi.setToken(refreshed.jwt);
}

await strapi.auth.logout({ scope: "session" });
strapi.setToken(undefined);
```

Every method accepts `init` for extra `fetch` options. The user type defaults to `StrapiUser`; the client itself is not generic at `strapi.auth` — the session's `user` is `StrapiUser` unless you call the methods through a typed path you constructed yourself. For the signed-in user after login, use [Users](/guide/users) `me()`.
