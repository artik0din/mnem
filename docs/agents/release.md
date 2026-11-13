# Release

Releases via Changesets :

```bash
pnpm changeset                # créer un changeset pour les packages impactés
# commit + PR
pnpm changeset version        # applique les bumps en local (pnpm 9 : pas `pnpm version` → npm)
pnpm release                  # build + changeset publish (script racine)
```

Sur `main`, GitHub Action `release.yml` lance `changesets/action@v1` : tant qu'un changeset est en attente, l'action ouvre ou met à jour une PR de version ; `pnpm release` (build + publish npm) ne s'exécute que lorsqu'il n'y a plus de changeset en attente.

Publication npm : uniquement via `release.yml`, et seulement après confirmation (voir `docs/agents/confirmations.md`).
