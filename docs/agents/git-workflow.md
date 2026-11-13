# Git Workflow

## Branches d'intégration

- `main` : production / release npm ; pas de push direct — PR obligatoire.
- `dev` : intégration ; pas de push direct — PR obligatoire.

Aucune protection GitHub ni ruleset sur ce dépôt : la discipline vient du workflow ci-dessous, pas des paramètres du repo.

## Commandes interdites

- `git push origin main` ou `git push origin dev` en direct.
- `git push --force` sur `main` ou `dev`.
- `gh pr merge --squash` ou `--rebase` (on merge avec merge commit pour préserver l'historique).

## Workflow standard

1. `git fetch origin && git checkout dev && git pull origin dev`
2. `git checkout -b type/description` (ex: `feat/core-semantic-search`)
3. Commits atomiques conventionnels.
4. Checks locaux avant push (même ordre que `.github/workflows/ci.yml`) :
   ```bash
   pnpm install --frozen-lockfile
   pnpm prettier
   pnpm lint
   pnpm typecheck
   pnpm build
   pnpm test
   ```
5. `git push origin type/description`
6. `gh pr create --base dev --title "type(scope): description"`
7. Attendre CI au vert — merger seulement si :
   ```bash
   gh pr checks <N> --json bucket --jq 'any(.[]; .bucket == "pass") and all(.[]; .bucket == "pass" or .bucket == "skipping")'
   ```
   renvoie vrai.
8. `gh pr merge --merge` (sans `--admin`, sans `--delete-branch` sur une PR vers `dev`).
9. Promotion `dev → main` : PR dédiée (`chore: release to main`), puis :
   ```bash
   gh pr merge --merge
   ```
   Jamais `--delete-branch` sur cette PR (sinon la branche `dev` serait supprimée).
