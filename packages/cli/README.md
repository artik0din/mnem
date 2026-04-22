# @mnem/cli

Command-line interface for inspecting, maintaining and exposing a Mnem vault.

## Install

```bash
pnpm add -g @mnem/cli
```

## Commands

```bash
mnem init [path]                   # create a new vault (.mnem/config.yml + index)
mnem stats                         # note count, total size, last update
mnem search "<query>" [-k 10]      # full-text + optional semantic search
mnem compact [--older-than-days 30]# archive stale notes from conversations/
mnem export-skill <outputDir>      # generate a Claude Skill from the vault
mnem tool <name> '<jsonArgs>'      # run a single tool operation (used by Skill scripts)
```

Example: expose a vault as a Claude Skill visible to Claude Code:

```bash
cd ~/my-vault
mnem init
mnem export-skill ~/.claude/skills/mnem-memory --name mnem-memory
```

Claude will now see the `mnem-memory` skill at session start, load `SKILL.md` when triggered, and open `resources/api.md` only when it needs the full tool schema (progressive disclosure).

## Config

`.mnem/config.yml` at the vault root drives runtime behaviour:

```yaml
storage:
  type: local
index:
  type: sqlite
  path: .mnem/index.sqlite
embeddings:
  type: openai
  model: text-embedding-3-small
```

When `embeddings.type: openai` is set, the CLI reads `OPENAI_API_KEY` from the environment and wires up semantic search automatically.

## License

MIT
