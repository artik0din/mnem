# @mnem/tools

Tool format adapters for exposing a Mnem vault to LLM agents. Three output formats are supported:

1. **OpenAI function calling** — `toOpenAITools(vault, options)` returns an array of `{ type: 'function', function: { name, description, parameters } }`.
2. **Anthropic tool use** — `toAnthropicTools(vault, options)` returns `{ name, description, input_schema }` tool definitions.
3. **Claude Skill** — `toClaudeSkill(vault, options)` writes a complete skill directory (`SKILL.md`, `scripts/`, `resources/api.md`) that Claude Code, Claude.ai and the Anthropic Agent SDK can load through progressive disclosure.

A runtime dispatcher, `executeToolCall(vault, call, options)`, runs a tool call emitted by an agent against the vault and returns markdown output that can be fed back to the model.

## Install

```bash
pnpm add @mnem/core @mnem/tools
```

## Usage — OpenAI

```typescript
import OpenAI from 'openai'
import { executeToolCall, toOpenAITools } from '@mnem/tools'

const tools = toOpenAITools(vault, { restrictToPath: 'clients/alice/' })
const res = await openai.chat.completions.create({ model: 'gpt-4o', tools, messages })
for (const call of res.choices[0].message.tool_calls ?? []) {
  const out = await executeToolCall(vault, {
    name: call.function.name,
    arguments: JSON.parse(call.function.arguments),
  })
  // feed `out.content` back as the tool result
}
```

## Usage — Anthropic

```typescript
import { toAnthropicTools } from '@mnem/tools'

const tools = toAnthropicTools(vault)
const res = await anthropic.messages.create({ model: 'claude-sonnet-4-5', tools, messages })
```

## Usage — Claude Skill

```typescript
import { toClaudeSkill } from '@mnem/tools'

await toClaudeSkill(vault, {
  outputDir: '/Users/me/.claude/skills/mnem-memory',
  skillName: 'mnem-memory',
})
```

The generated directory follows Anthropic's Claude Skill format:

```
mnem-memory/
├── SKILL.md          # YAML frontmatter + short overview
├── scripts/          # one .sh per tool, shells out to `mnem tool <op>`
└── resources/
    └── api.md        # full JSON schema reference, loaded on demand
```

Claude loads the metadata at session start, reads `SKILL.md` when the skill is triggered, and only opens `resources/api.md` when it needs the full parameter schema — this is the progressive-disclosure pattern Anthropic recommends.

## Options

- `allowedOperations?: ToolOperation[]` — restrict which tools are exposed
- `restrictToPath?: string` — reject any path that does not start with this prefix
- `namePrefix?: string` — prepended to every tool name (e.g. `vault_read_note`)

Available operations: `read_note`, `write_note`, `append_note`, `patch_note`, `delete_note`, `search_full_text`, `search_semantic`, `search_graph`, `get_backlinks`, `get_outgoing_links`.

## License

MIT
