# Contributing

## Setup

```bash
pnpm install   # also installs the husky pre-commit hook (lint-staged + eslint --fix)
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```

Node 24 (see `.nvmrc`) is needed for the toolchain. The published packages
support Node 20.3+, which CI checks with each package's `scripts/smoke.mjs`.

First-time contributors are asked to sign the [CLA](./CLA.md) on their pull
request.

## Changesets

Every pull request that changes a published package needs a changeset:

```bash
pnpm changeset
```

Pick the packages you changed, the bump type, and write a one-line summary for
the changelog. Commit the generated `.changeset/*.md` file with your change.
Docs-only, test-only and CI-only changes do not need one.

## How releases work

Releases run from `.github/workflows/release.yml` on every push to `main`:

1. If there are pending changesets, `changeset version` bumps the affected
   packages, writes their `CHANGELOG.md`, syncs each `jsr.json` version, and
   pushes a `Version Packages [skip ci]` commit.
2. Every package whose `package.json` version is not on npm yet is built and
   published to npm. Packages without a changeset are left alone.
3. Each published package gets its own `<name>@<version>` git tag and GitHub
   release, with that version's changelog entry as the notes.
4. Any package whose `jsr.json` version is not on JSR yet is published there.

Steps 2 and 4 check the registries rather than the changesets, so a publish
that failed is retried on the next push to `main`.
