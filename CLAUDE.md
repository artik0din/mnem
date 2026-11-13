# CLAUDE CODE — Instructions projet Mnem

**TOUJOURS PARLER EN FRANÇAIS** côté conversation. Code, commits, commentaires techniques, noms publics : en anglais (projet OSS).

## Produit

Mnem est un moteur de mémoire persistante pour agents LLM (lib TypeScript MIT). Souvenirs en markdown liés (compatibles vault Obsidian), pas en base vectorielle propriétaire. Référence : `README.md`.

## Stack

Node.js 20+, pnpm 9.15.4 (`packageManager` racine), Turborepo, tsup (ESM + CJS + `.d.ts`), Vitest, Changesets + GitHub Actions, ESLint (`.eslintrc.cjs`) + Prettier (`.prettierrc.json`).

## Arborescence

- `packages/core` — API vault ; seuils couverture dans `packages/core/vitest.config.ts`
- `packages/storage-local`, `storage-s3`, `index-sqlite`, `index-postgres`, `embeddings-openai`, `tools`, `cli`
- `examples/quickstart-anthropic`, `examples/quickstart-openai`
- `.github/workflows/ci.yml`, `release.yml` ; `tsconfig.base.json`, `turbo.json`

## Règles absolues

- TypeScript : options strictes de `tsconfig.base.json` ; pas de `any` ; `@ts-ignore` / `@ts-expect-error` interdits sauf commentaire + ticket ; exports publics typés + TSdoc.
- Code livré complet ; Zéro `console.log` — CLI : `process.stderr.write` / `process.stdout.write` ; pas de secrets en clair ; promesses et erreurs toujours gérées.
- `@mnem/core` : seuils couverture Vitest obligatoires en CI (voir config package).
- Commits Conventional `type(scope): description` (< 72 car.), atomiques — types et scopes : `docs/agents/code-rules.md`.
- Git : pas de push direct sur `main`/`dev`, pas de `git push --force` sur ces branches, pas de `gh pr merge --squash` ni `--rebase` ; merge commit `gh pr merge --merge`.
- **Demander confirmation** avant : `main`, suppressions non triviales, bump majeur deps, format vault, API publique `@mnem/core`, publication npm (`docs/agents/confirmations.md`).

## Commandes

Install et checks (séquence `.github/workflows/ci.yml`) :

```bash
pnpm install --frozen-lockfile
pnpm prettier
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

Format local : `pnpm prettier:fix`. Release : `pnpm changeset`, `pnpm changeset version`, `pnpm release` (npm via `release.yml` seulement, après confirmation) — voir `docs/agents/release.md`.

## Contexte agent

Quand le contexte dépasse 80 %, arrête-toi, résume l'état courant, lance un `/compact`. Ne lis jamais plus de 3 fichiers à la suite sans vérifier le contexte. Exploration large → sub-agent (`docs/agents/context.md`).

## Docs détaillées

- `docs/agents/context.md` : gestion du contexte et exploration large.
- `docs/agents/product.md` : vision, stack détaillée, références documentaires.
- `docs/agents/code-rules.md` : TypeScript, qualité, tests, conventions de commits.
- `docs/agents/git-workflow.md` : branches et workflow PR.
- `docs/agents/release.md` : Changesets et publication npm.
- `docs/agents/confirmations.md` : confirmations utilisateur avant actions sensibles.
