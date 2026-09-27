# Users

`strapi.users()` is the users-permissions plugin at `/api/users`. These endpoints are not content-API routes:

- The body is the user or an array of users. There is no `data` wrapper, and `meta` is `null`.
- Users are addressed by numeric `id`, not `documentId`.
- `locale`, `status` and `_q` are not part of these routes and are rejected by the types.
- `create` and `update` send `data` as the raw JSON body, not `{ data }`.

```ts
const users = strapi.users();

const [err, me] = await users.me({ params: { populate: ["role"] } });
const [listErr, list] = await users.findMany({
	params: { filters: { blocked: { $eq: false } }, pagination: { pageSize: 20 } },
});
const [oneErr, user] = await users.find({ id: 1, params: { fields: ["username", "email"] } });
const [countErr, total] = await users.count({ params: { filters: { confirmed: { $eq: true } } } });
```

| Method | Route | Params |
| --- | --- | --- |
| `findMany` | `GET /api/users` | `fields`, `populate`, `sort`, `pagination`, `filters` |
| `find` | `GET /api/users/<id>` | `fields`, `populate` |
| `me` | `GET /api/users/me` | `fields`, `populate`. The user the configured token belongs to. |
| `count` | `GET /api/users/count` | `filters`. The body is a number, not pagination meta. |
| `create` | `POST /api/users` | `data` object, sent raw. |
| `update` | `PUT /api/users/<id>` | `id`, `data`. |
| `delete` | `DELETE /api/users/<id>` | Returns the deleted user. |

`count` returns `0` when the body is not a number. `find`, `me`, `create`, `update` and `delete` return `NotFoundError` when the body is empty.

Pass a type argument when the user shape is not `StrapiUser`:

```ts
interface Member extends StrapiUser {
	displayName: string;
}

const members = strapi.users<Member>();
```

A populated `role` is `StrapiRole` (`id`, `name`, `description`, `type`). Unpopulated, it is the role id. `StrapiUser` also has `username`, `email`, `provider`, `confirmed` and `blocked`.
