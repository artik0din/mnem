# CLAUDE CODE — Instructions projet Mnem

**TOUJOURS PARLER EN FRANÇAIS** côté conversation. Code, commits, commentaires techniques, noms publics : en anglais (projet OSS).

## Context Management

Quand le contexte dépasse 80 %, arrête-toi, résume l'état courant, lance un `/compact`. Ne lis jamais plus de 3 fichiers à la suite sans vérifier le contexte. Pour une exploration large, utilise un sub-agent.

## Vision projet

Mnem est un moteur de mémoire persistante pour agents LLM, livré sous forme de lib TypeScript OSS sous licence MIT. Les souvenirs sont stockés comme des fichiers markdown liés entre eux (compatibles avec le format vault Obsidian), pas dans une base vectorielle propriétaire.

Document de référence : `README.md`. PRD complet dans le repo Globolead : `/Users/artik0din/Documents/globolead/docs/v2/PRD-MNEM.md`.

## Stack & Preferences

- **Runtime** : Node.js 20+
- **Package Manager** : pnpm 9+
- **Monorepo** : Turborepo
- **Build** : tsup (dual ESM + CJS + .d.ts)
- **Tests** : Vitest (+ testcontainers pour Postgres en v0.1)
- **Release** : Changesets + GitHub Actions → publication npm
- **Lint** : ESLint flat-adjacent + Prettier

## Règles de code

### TypeScript

- `strict: true` avec `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`.
- Zero `any` (utiliser `unknown` + type guards). `@ts-ignore` / `@ts-expect-error` interdits sauf commentaire + ticket.
- Exports publics : typés explicitement, surface API stable, TSdoc sur chaque export.

### Général

- Code complet, pas de `...` / `// TODO` / `// reste du code` dans un fichier livré.
- Zéro `console.log` — utiliser `process.stderr.write` / `process.stdout.write` dans la CLI, ou les hooks du consommateur.
- Pas de secrets en clair dans les tests ou les exemples.
- Gestion d'erreurs exhaustive : jamais de promesse sans gestion, jamais d'erreur avalée.
- DRY / KISS / YAGNI / SOLID avec jugeote — pas d'abstraction prématurée.

### Tests

- **100 % coverage obligatoire sur `@mnem/core`** (bloqué en CI via seuils Vitest).
- Tests d'intégration pour les adapters (fs réel pour `storage-local`, testcontainers pour `index-postgres`).
- Pas de tests E2E payants en CI (mocks pour OpenAI, tests réels uniquement en pre-release).

### Commits

- Conventional Commits : `type(scope): description` (< 72 chars).
- Commits atomiques : 1 commit = 1 modification logique.
- Types : `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`, `build`, `ci`, `style`.
- Scopes valides : `core`, `storage-local`, `storage-s3`, `index-sqlite`, `index-postgres`, `embeddings-openai`, `tools`, `cli`, `config`, `ci`, `deps`, `docs`, `examples`.

## Git Workflow

### Branches protégées

- `main` : protégée, PR obligatoire. Toute release part de `main`.
- `dev` : intégration, PR obligatoire.

### Commandes interdites

- `git push origin main` ou `git push origin dev` en direct.
- `git push --force` sur `main` ou `dev`.
- `gh pr merge --squash` ou `--rebase` (on merge avec merge commit pour préserver l'historique).

### Workflow standard

1. `git fetch origin && git checkout dev && git pull origin dev`
2. `git checkout -b type/description` (ex: `feat/core-semantic-search`)
3. Commits atomiques conventionnels.
4. Checks locaux avant push :
   ```bash
   pnpm prettier --write .
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   ```
5. `git push origin type/description`
6. `gh pr create --base dev --title "type(scope): description"`
7. Attendre CI au vert.
8. `gh pr merge --merge --delete-branch --admin`
9. Promotion `dev → main` via PR dédiée (`chore: release to main`).

## Release

Releases via Changesets :

```bash
pnpm changeset                # créer un changeset pour les packages impactés
# commit + PR
pnpm changeset version        # applique les bumps en local (utilisé par la release action)
pnpm release                  # build + publish npm
```

La release sur npm est déclenchée par un push sur `main` avec un changeset présent (GitHub Action `release.yml`).

## Confirmations requises

**DEMANDER CONFIRMATION** avant :

- Toute opération sur `main`
- Suppression de fichiers ou de code non trivial
- Bump de dépendance majeure
- Modification du format de vault (breaking change pour les consumers)
- Modification de la surface d'API publique de `@mnem/core`
- Publication sur npm
