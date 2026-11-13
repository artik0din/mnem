# Vision projet

Mnem est un moteur de mémoire persistante pour agents LLM, livré sous forme de lib TypeScript OSS sous licence MIT. Les souvenirs sont stockés comme des fichiers markdown liés entre eux (compatibles avec le format vault Obsidian), pas dans une base vectorielle propriétaire.

Document de référence : `README.md`.

## Stack & Preferences

- **Runtime** : Node.js 20+
- **Package Manager** : pnpm 9+
- **Monorepo** : Turborepo
- **Build** : tsup (dual ESM + CJS + .d.ts)
- **Tests** : Vitest
- **Release** : Changesets + GitHub Actions → publication npm
- **Lint** : ESLint 8 (config legacy `.eslintrc.cjs`) + Prettier
