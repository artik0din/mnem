# Règles de code

## TypeScript

- `strict: true` avec `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`.
- Zero `any` (utiliser `unknown` + type guards). `@ts-ignore` / `@ts-expect-error` interdits sauf commentaire + ticket.
- Exports publics : typés explicitement, surface API stable, TSdoc sur chaque export.

## Général

- Code complet, pas de `...` / marqueur de tâche / `// reste du code` dans un fichier livré.
- Zéro `console.log` — utiliser `process.stderr.write` / `process.stdout.write` dans la CLI, ou les hooks du consommateur.
- Pas de secrets en clair dans les tests ou les exemples.
- Gestion d'erreurs exhaustive : jamais de promesse sans gestion, jamais d'erreur avalée.
- DRY / KISS / YAGNI / SOLID avec jugeote — pas d'abstraction prématurée.

## Tests

- **Seuils de couverture `@mnem/core`** : `packages/core/vitest.config.ts` (lignes/fonctions/statements 100 %, branches 90 % ; `src/index.ts` et `src/types.ts` exclus).
- Tests d'intégration pour les adapters (fs réel pour `storage-local`, etc.).
- Pas de tests E2E payants en CI (mocks pour OpenAI, tests réels uniquement en pre-release).

## Commits

- Conventional Commits : `type(scope): description` (< 72 chars).
- Commits atomiques : 1 commit = 1 modification logique.
- Types : `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`, `build`, `ci`, `style`.
- Scopes valides : `core`, `storage-local`, `storage-s3`, `index-sqlite`, `index-postgres`, `embeddings-openai`, `tools`, `cli`, `config`, `ci`, `deps`, `docs`, `examples`.
