import { InvalidNotePathError } from './errors.js'

const INVALID_CHARS = /[\0]/
const PATH_TRAVERSAL = /(^|\/)\.\.(\/|$)/

/**
 * Validate a note path. Rejects:
 *   - empty strings
 *   - absolute paths (starting with /)
 *   - path traversal (../)
 *   - null bytes
 *   - paths that don't end with .md
 */
export function validateNotePath(path: string): void {
  if (path.length === 0) {
    throw new InvalidNotePathError(path, 'path is empty')
  }
  if (path.startsWith('/')) {
    throw new InvalidNotePathError(path, 'absolute paths are not allowed')
  }
  if (PATH_TRAVERSAL.test(path)) {
    throw new InvalidNotePathError(path, 'path traversal segments are not allowed')
  }
  if (INVALID_CHARS.test(path)) {
    throw new InvalidNotePathError(path, 'path contains invalid characters')
  }
  if (!path.endsWith('.md')) {
    throw new InvalidNotePathError(path, 'path must end with .md')
  }
}

/**
 * Normalize a wikilink target to a note path.
 *   "note"        -> "note.md"
 *   "folder/note" -> "folder/note.md"
 *   "note.md"     -> "note.md"
 */
export function wikilinkTargetToPath(target: string): string {
  const trimmed = target.trim()
  if (trimmed.endsWith('.md')) return trimmed
  return `${trimmed}.md`
}
