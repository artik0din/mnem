/**
 * Error classes used across Mnem. Consumers should catch these explicitly
 * rather than checking message strings.
 */

export class MnemError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MnemError'
  }
}

export class NoteNotFoundError extends MnemError {
  constructor(public readonly path: string) {
    super(`Note not found: ${path}`)
    this.name = 'NoteNotFoundError'
  }
}

export class InvalidNotePathError extends MnemError {
  constructor(
    public readonly path: string,
    reason: string,
  ) {
    super(`Invalid note path "${path}": ${reason}`)
    this.name = 'InvalidNotePathError'
  }
}

export class IndexNotConfiguredError extends MnemError {
  constructor(operation: string) {
    super(
      `Operation "${operation}" requires an index adapter. ` +
        `Pass an IndexAdapter when creating the vault.`,
    )
    this.name = 'IndexNotConfiguredError'
  }
}

export class EmbeddingsNotConfiguredError extends MnemError {
  constructor(operation: string) {
    super(
      `Operation "${operation}" requires an embedding provider. ` +
        `Pass an EmbeddingProvider when creating the vault.`,
    )
    this.name = 'EmbeddingsNotConfiguredError'
  }
}
