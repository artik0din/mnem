export { createVault } from './vault.js'
export { MemoryStorage } from './memory-storage.js'
export { MemoryIndex } from './memory-index.js'
export { extractWikilinks } from './wikilinks.js'
export { validateNotePath, wikilinkTargetToPath } from './path-utils.js'
export {
  MnemError,
  NoteNotFoundError,
  InvalidNotePathError,
  IndexNotConfiguredError,
  EmbeddingsNotConfiguredError,
} from './errors.js'
export type {
  Note,
  NoteFrontmatter,
  WriteNoteInput,
  AppendNoteInput,
  PatchNoteInput,
  ReadNoteInput,
  DeleteNoteInput,
  SearchResult,
  FullTextSearchInput,
  SemanticSearchInput,
  GraphSearchInput,
  IndexedNote,
  StorageAdapter,
  IndexAdapter,
  EmbeddingProvider,
  Vault,
  VaultConfig,
} from './types.js'
