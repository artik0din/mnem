/**
 * Wikilink extraction. Supports:
 *   [[note]]
 *   [[folder/note]]
 *   [[note|alias]]
 *   [[note#heading]]
 *
 * The current implementation ignores aliases and heading anchors when
 * returning the target path; only the base path is returned.
 */

const WIKILINK_REGEX = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g

export function extractWikilinks(content: string): readonly string[] {
  const found = new Set<string>()
  for (const match of content.matchAll(WIKILINK_REGEX)) {
    const raw = match[1]
    if (raw === undefined) continue
    const target = raw.trim()
    if (target.length === 0) continue
    found.add(target)
  }
  return Array.from(found)
}
