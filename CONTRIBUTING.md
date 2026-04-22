# Contributing to Mnem

Thanks for your interest in contributing to Mnem. This document describes the workflow, expectations, and conventions.

## Code of Conduct

All contributors must follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Development setup

Requirements:

- Node.js >= 20
- pnpm >= 9

```bash
git clone https://github.com/artik0din/mnem.git
cd mnem
pnpm install
pnpm build
pnpm test
```

## Branch workflow

- `main` is the stable release branch. It is protected.
- `dev` is the integration branch. All feature work lands here first.
- Feature branches are created from `dev`.

Branch naming:

- `feat/<short-description>` for new features
- `fix/<short-description>` for bug fixes
- `refactor/<short-description>` for refactoring
- `perf/<short-description>` for performance improvements
- `docs/<short-description>` for documentation
- `chore/<short-description>` for maintenance
- `test/<short-description>` for test-only changes
- `ci/<short-description>` for CI configuration

## Commit convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>
```

Valid types: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `chore`, `security`.

Valid scopes: `core`, `storage-local`, `storage-s3`, `index-sqlite`, `index-postgres`, `embeddings-openai`, `tools`, `cli`, `config`, `ci`, `deps`, `docs`.

Example:

```
feat(core): add appendNote API
fix(storage-local): handle concurrent writes safely
```

## Pull requests

1. Fork and create a feature branch from `dev`.
2. Write focused, atomic commits.
3. Add or update tests. Coverage on `@mnem/core` must remain at 100%.
4. Run locally before pushing:
   ```bash
   pnpm prettier
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   ```
5. If your change is user-facing or changes published packages, add a changeset:
   ```bash
   pnpm changeset
   ```
6. Open a PR against `dev`. Fill out the PR template.
7. Wait for CI to pass and at least one approving review.

## Testing

- Unit tests for pure logic (Vitest).
- Integration tests for adapters against real backends (Postgres via testcontainers, SQLite in-memory, minio for S3).
- No `any` types. Use `unknown` with type guards if necessary.
- Every public function gets a test.

## Questions

Open an issue or a GitHub discussion. We read everything.
