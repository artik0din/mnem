import type { Vault } from '@mnem/core'

export type ToolOperation =
  | 'read_note'
  | 'write_note'
  | 'append_note'
  | 'patch_note'
  | 'delete_note'
  | 'search_full_text'
  | 'search_semantic'
  | 'search_graph'
  | 'get_backlinks'
  | 'get_outgoing_links'

export interface ToolAdapterOptions {
  /** Restrict which operations are exposed to the agent. Defaults to all. */
  readonly allowedOperations?: readonly ToolOperation[]
  /** Optional path prefix. Operations outside this prefix are rejected. */
  readonly restrictToPath?: string
  /** Optional name prefix applied to every tool name. */
  readonly namePrefix?: string
}

export interface OpenAIToolDefinition {
  readonly type: 'function'
  readonly function: {
    readonly name: string
    readonly description: string
    readonly parameters: Record<string, unknown>
  }
}

export interface AnthropicToolDefinition {
  readonly name: string
  readonly description: string
  readonly input_schema: Record<string, unknown>
}

/**
 * Generate OpenAI-compatible function calling tool definitions from a vault.
 *
 * Implementation is scheduled for v0.1.
 */
export function toOpenAITools(
  _vault: Vault,
  _options: ToolAdapterOptions = {},
): readonly OpenAIToolDefinition[] {
  throw new Error('[@mnem/tools] toOpenAITools is not implemented yet')
}

/**
 * Generate Anthropic-compatible tool definitions from a vault.
 *
 * Implementation is scheduled for v0.1.
 */
export function toAnthropicTools(
  _vault: Vault,
  _options: ToolAdapterOptions = {},
): readonly AnthropicToolDefinition[] {
  throw new Error('[@mnem/tools] toAnthropicTools is not implemented yet')
}
