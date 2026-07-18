/**
 * Artwork identity helpers.
 *
 * A book's artwork file and its scan-time cover-extraction slot must be keyed
 * by unique book identity, never author+title alone: two copies of the same
 * title (e.g. different narrators in different folders) are distinct books in
 * the DB and must not share an artwork file, or they clobber each other's
 * covers. Unique keys are structural (file path, directory, DB record id) —
 * metadata like narrator is optional and non-unique, so it is never used here.
 */

/**
 * Sanitizes a string for use in a filename by replacing non-alphanumeric characters.
 */
export function sanitizeForFilename(str: string): string {
  return str.replace(/[^a-zA-Z0-9]/g, '_');
}

/**
 * FNV-1a 32-bit hash as 8-char lowercase hex. Deterministic and
 * dependency-free; used to fold arbitrary unique keys (file paths, record
 * ids) into a filename-safe suffix.
 */
export function shortHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Filename for a book's saved artwork. `uniqueKey` disambiguates books that
 * share author+title: the scan pipeline passes the book's first chapter file
 * path, manual replacement passes the WatermelonDB record id.
 */
export function artworkFilename(
  author: string,
  bookTitle: string,
  uniqueKey: string,
): string {
  const safeAuthor = sanitizeForFilename(author);
  const safeTitle = sanitizeForFilename(bookTitle);
  return `${safeAuthor}_${safeTitle}_${shortHash(uniqueKey)}.webp`;
}

/**
 * Dedupe key for scan-time cover extraction. Scoped to the directory because
 * scan grouping is per-directory: same author+title in one directory is one
 * book (only its first file needs the cover pass), while the same title in
 * another directory is a separate copy that needs its own extraction.
 */
export function coverExtractionKey(
  dir: string,
  author: string,
  bookTitle: string,
): string {
  return `${dir}::${author}::${bookTitle}`;
}
