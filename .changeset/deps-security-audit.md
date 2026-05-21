---
"@mnem/storage-s3": patch
"@mnem/index-sqlite": patch
"@mnem/cli": patch
"@mnem/embeddings-openai": patch
---

Update runtime dependencies for security and maintenance.

- `@mnem/storage-s3`: bump `@aws-sdk/client-s3` to 3.1051.0 (resolves transitive `fast-xml-parser`/`fast-xml-builder` advisories).
- `@mnem/index-sqlite`: upgrade `better-sqlite3` to v12.
- `@mnem/cli`: upgrade `commander` to v14.
- `@mnem/embeddings-openai`: upgrade the `openai` SDK to v6.

No public API changes; all upgrades are behaviour-compatible for the surface used by these packages.
