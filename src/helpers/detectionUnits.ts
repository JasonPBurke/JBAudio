/**
 * Detection units from the real library — PURE. Book rows in, `DetectionUnit`s
 * out, ready for `detectSeries`.
 *
 * This is the bridge between the library the user actually has and a detector
 * that was measured on a JSON file. It imports one TYPE and nothing else, for
 * the same reason `seriesDetection.ts` imports nothing at all: the shape of a
 * unit is the thing most likely to drift, and drift here is silent — a wrong
 * `rel` still detects, it just detects something else.
 *
 * Why a whole module rather than a `.map()` at the call site: `flat` and the
 * library-root-relative `rel` are properties of the SET, not of a row, so the
 * assembly cannot be written per-book even if it looks like it should be.
 */

import type { DetectionUnit } from '@/helpers/seriesDetection';

/**
 * The placeholder strings `buildBookMetadata` (scanLibrary.ts) writes when a
 * tag is missing. They are ABSENCE WRITTEN DOWN, not evidence, and detection
 * must see them as null — otherwise every untagged book in the library shares
 * an "author" and a folder can corroborate itself off the sentinel.
 *
 * Exported so the scan imports these rather than repeating the literals; if
 * they ever diverge, the sanitising below stops firing silently.
 */
export const UNKNOWN_BOOK_TITLE = 'Unknown Book';
export const UNKNOWN_AUTHOR = 'Unknown Author';
export const UNKNOWN_NARRATOR = 'Unknown Voice Artist';

const SENTINELS: ReadonlySet<string> = new Set([
  UNKNOWN_BOOK_TITLE,
  UNKNOWN_AUTHOR,
  UNKNOWN_NARRATOR,
]);

/**
 * One book, as the database holds it. Deliberately not `Book` from
 * `@/types/Book`: that type carries artwork, colours and playback progress,
 * none of which detection may read, and depending on it would make this module
 * re-render bait for anything that imports it.
 */
export type DetectionBookRow = {
  /**
   * The book's STRUCTURAL KEY = its first file's absolute path, exactly what
   * `bookStructuralKey` returns. It is both the unit's identity and the source
   * of `dir`/`file`/`rel`, which is why there is no separate id field here.
   */
  firstFilePath: string;
  /** `books.title` — the album tag, or the parent folder name. See `album`. */
  title: string | null;
  /** The author NAME (books store an author relation, not a string). */
  author: string | null;
  narrator: string | null;
  /** `books.series` — the raw `extra.SERIES` tag, null before v33. */
  series: string | null;
  /** `books.part` — `extra.PART`, a number because 15.5 is a real value. */
  part: number | null;
  grouping: string | null;
};

/**
 * A unit carrying the two things the caller needs back out. `detectSeries` is
 * generic over its unit type and returns `books[].unit`, so `bookKey` travels
 * through the cascade untouched — no lookup table, and no invented id field on
 * `DetectionUnit` itself.
 */
export type LibraryDetectionUnit = DetectionUnit & {
  /** Structural key, for writing membership rows. Detection never reads it. */
  bookKey: string;
  /** Absolute directory. Detection never reads it; the dev log does. */
  dir: string;
};

export type BuildDetectionUnitsResult = {
  units: LibraryDetectionUnit[];
  /**
   * Books whose first file sits under none of the configured library roots.
   * They are DROPPED, not included with an absolute `rel` — see the note on
   * `relativeToRoot`. A non-zero count means stale library settings.
   */
  outsideRoots: number;
  /** Books with no chapters at all, so no structural key. Also dropped. */
  keyless: number;
};

const sanitise = (value: string | null | undefined): string | null => {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed || SENTINELS.has(trimmed)) return null;
  return trimmed;
};

const dirOf = (path: string): string => {
  const cut = path.lastIndexOf('/');
  return cut < 0 ? '' : path.slice(0, cut);
};

const fileOf = (path: string): string => {
  const cut = path.lastIndexOf('/');
  return cut < 0 ? path : path.slice(cut + 1);
};

const stripTrailingSlash = (p: string): string =>
  p.length > 1 && p.endsWith('/') ? p.replace(/\/+$/, '') : p;

/**
 * `dir` relative to whichever configured library root contains it, or null.
 *
 * NULL IS A DROP, AND THAT IS THE POINT. An absolute `rel` does not merely
 * look wrong — it MEASURABLY breaks detection. Re-running the 298-unit corpus
 * with `sdcard/Audiobooks/` left on the front produces, at full fidelity, a
 * 71-book series called **"Audiobooks"**: the library root becomes a depth-2
 * folder cluster, big enough for the uncorroborated rule to accept it whole
 * (28 series / 213 placed -> 29 / 284). Conservative fidelity survives, so
 * this fails in exactly one of the two modes, which is worse than failing in
 * both. A book outside every root cannot be placed in the hierarchy the folder
 * rules reason about, so it abstains (A7).
 *
 * (There is a second, weaker effect: `folderClusters` skips depth-1
 * directories as "the author level", and a prefix moves every author folder
 * out of reach of that guard. Noted separately because that guard is itself
 * unratified — see ticket 04's answer — whereas the "Audiobooks" cluster above
 * is present whether the guard stays or goes.)
 *
 * Roots are matched longest-first so a root nested inside another wins.
 */
function relativeToRoot(dir: string, roots: readonly string[]): string | null {
  for (const root of roots) {
    if (dir === root) return '';
    if (dir.startsWith(`${root}/`)) return dir.slice(root.length + 1);
  }
  return null;
}

/**
 * Assemble detection units for a whole library.
 *
 * `libraryRoots` are ABSOLUTE paths (`libraryRootAbsPath(entry)`), passed in
 * rather than read here so this module stays free of RNFS and the database.
 * An empty list yields zero units — correct, and loud in the caller's log,
 * since with no configured root nothing can be made relative to anything.
 */
export function buildDetectionUnits(
  rows: readonly DetectionBookRow[],
  libraryRoots: readonly string[],
): BuildDetectionUnitsResult {
  const roots = libraryRoots
    .map(stripTrailingSlash)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  let keyless = 0;
  let outsideRoots = 0;

  // Pass 1: resolve paths, so `flat` can be counted over the assembled set.
  const staged: { row: DetectionBookRow; dir: string; rel: string }[] = [];
  for (const row of rows) {
    if (!row.firstFilePath) {
      keyless++;
      continue;
    }
    const dir = dirOf(row.firstFilePath);
    const rel = relativeToRoot(dir, roots);
    if (rel == null) {
      outsideRoots++;
      continue;
    }
    staged.push({ row, dir, rel });
  }

  // Pass 2: `flat` = "this DIRECTORY holds more than one book". A property of
  // the directory, never of the book — deriving it from a single row is how
  // you get a library where nothing is ever flat.
  const booksPerDir = new Map<string, number>();
  for (const s of staged) {
    booksPerDir.set(s.dir, (booksPerDir.get(s.dir) ?? 0) + 1);
  }

  return {
    keyless,
    outsideRoots,
    units: staged.map(({ row, dir, rel }) => ({
      bookKey: row.firstFilePath,
      dir,
      rel,
      file: fileOf(row.firstFilePath),
      // The title enters the album channel EVEN WHEN it is a folder fallback.
      // Measured on the 298-unit corpus rather than assumed: suppressing every
      // album equal to its own folder name costs 19 -> 14 series and 179 -> 123
      // books placed (it breaks the Discworld edition split, The First Law and
      // Long Earth), because 67 units carry a real album tag that simply
      // matches its folder. Letting the fallback through costs exactly one book
      // at either fidelity. The contamination is real but an order of magnitude
      // smaller than the cure, and the folder channel would see the same string
      // anyway — one waterfall step later, and self-validated.
      album: sanitise(row.title),
      // The DB stores ONE author, so artist and album_artist collapse onto it.
      // Verified a no-op: the corpus's two fields differ on 132 of 298 units
      // and collapsing them changes nothing at either fidelity.
      artist: sanitise(row.author),
      album_artist: sanitise(row.author),
      composer: sanitise(row.narrator),
      series: sanitise(row.series),
      grouping: sanitise(row.grouping),
      // `part` is a number column (15.5 is a real novella position); the
      // cascade parses it as a string, so no precision is lost by stringifying.
      part: row.part == null ? null : String(row.part),
      flat: (booksPerDir.get(dir) ?? 0) > 1,
    })),
  };
}
