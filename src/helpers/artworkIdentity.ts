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
 * Filename for a series' PINNED artwork — spec §D6, §K8.
 *
 * ⚠ KEYED ON THE SERIES ID ALONE, WITH NO NAME COMPONENT, AND THAT IS THE
 * WHOLE POINT. A book's filename carries author+title because two books can
 * share both and collided over it once (see the header). A series has no such
 * collision to solve, and putting its name in the path would buy a readable
 * filename at the cost of the one guarantee K8 needs: replacing a pinned cover
 * has to land on the SAME path it landed on last time, so the `unlink` before
 * the move destroys the file it replaces. Key it on a mutable name and a
 * rename silently redirects the destination — every pin after a rename leaks
 * the file before it, which is precisely the orphan K8 exists to stop.
 *
 * The `series_` prefix is not load-bearing; it makes the artwork directory
 * legible at a glance and gives the ref-counted sweep sketched in the
 * orphaned-artwork note an obvious way to see that series own files too.
 */
export function seriesArtworkFilename(seriesId: string): string {
  return `series_${shortHash(seriesId)}.webp`;
}

/** The `file://` prefix every artwork URI this app writes carries. */
const FILE_SCHEME = 'file://';

/**
 * The on-disk path an artwork URI refers to, or null if it does not name a
 * file this app is allowed to delete — spec §K8.
 *
 * Two things it strips, and one it refuses:
 *
 *  - **The `?t=` cache-buster.** Every artwork write appends one so FastImage
 *    reloads a replaced cover instead of serving the old bytes from its
 *    immutable cache. It is not part of the path, and the same strip is what
 *    the future ref-counted sweep needs before it compares basenames.
 *  - **The scheme.** RNFS takes plain paths.
 *  - **Anything outside `artworkDir`.** A URI that is not ours is not ours to
 *    unlink. `series.artwork` is a free-text column; the one design that would
 *    have pointed it at a BOOK's own file ("pick a member's cover") is dropped
 *    rather than impossible, and an unlink through that path would delete a
 *    cover the book still references. Cheaper to make it unrepresentable.
 *
 * ⚠ THE CONTAINMENT CHECK IS A STRING PREFIX, AND A PREFIX IS NOT CONTAINMENT.
 * `…/artwork/../books/cover.webp` starts with `…/artwork/` and resolves outside
 * it, so a `..` segment is refused outright (code review finding 16). Refused
 * rather than normalised: every path this app writes is built from
 * `sanitizeForFilename`/`shortHash`, so a traversal segment is a bug or an
 * attack, never a value to be tidied up. The same string-vs-semantics gap gave
 * ticket 22 its `Books` / `Books Backup` defect; the trailing `/` below is that
 * lesson, and this is the other half of it.
 *
 * Deliberately does NOT percent-decode: every path written here is
 * `<documents>/artwork/<name>.webp` where the name comes from
 * `sanitizeForFilename` or `shortHash`, so it is `[A-Za-z0-9_.]` throughout and
 * nothing is ever encoded. Decoding would only add a way to mangle a literal
 * `%` in a future directory name.
 */
export function artworkFilePath(
  uri: string | null | undefined,
  artworkDir: string,
): string | null {
  if (!uri) return null;
  const withoutQuery = uri.split('?')[0];
  if (!withoutQuery.startsWith(FILE_SCHEME)) return null;
  const absolute = withoutQuery.slice(FILE_SCHEME.length);
  if (absolute.split('/').includes('..')) return null;
  const dir = artworkDir.replace(/\/+$/, '');
  return absolute.startsWith(`${dir}/`) ? absolute : null;
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
