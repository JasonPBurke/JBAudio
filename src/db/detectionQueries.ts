/**
 * Read the whole library out of the database as detection units.
 *
 * WHY THIS IS NOT "A PASS OVER THE SCAN'S OUTPUT". `scanLibrary` is
 * incremental: it builds `existingUrls` from the chapters table and runs
 * MediaInfo only on files not already present, so a rescan of an unchanged
 * library yields ZERO metadata results. Detection driven off scan output would
 * work on first import and then silently do nothing forever. It needs the
 * whole library, and the whole library lives here.
 *
 * FOUR QUERIES, NEVER PER-BOOK. Books, authors and first-chapters are each one
 * fetch, joined in memory; settings is the fourth. A per-book chapter fetch
 * over ~350 books is the shape this module exists to avoid.
 */

import { Q } from '@nozbe/watermelondb';
import database from '@/db';
import Book from '@/db/models/Book';
import Author from '@/db/models/Author';
import Chapter from '@/db/models/Chapter';
import { libraryRootAbsPath } from '@/helpers/enumerateAudioViaMediaStore';
import { getLibraryFolderEntries } from '@/db/settingsQueries';
import {
  buildDetectionUnits,
  type BuildDetectionUnitsResult,
  type DetectionBookRow,
} from '@/helpers/detectionUnits';

/**
 * How many books carry each of the four columns ticket 02 populates, counted
 * over the rows that were read — NOT over units.
 *
 * Two reasons it is counted here rather than in the probe. It is the only place
 * that still holds `DetectionBookRow`s: `loadLibraryDetectionUnits` returns
 * units, and `file_format` is not a detection signal so it must never be put on
 * one to make it visible. And the count must be RAW non-null, matching 02's
 * criterion and the `sqlite3 … sum(series is not null)` fallback — units have
 * been through `sanitise()`, which nulls the `Unknown Author` sentinels and
 * would under-report.
 */
export type TagFillCounts = {
  /** Denominator: rows read, i.e. books that had a first chapter. */
  rows: number;
  fileFormat: number;
  series: number;
  part: number;
  grouping: number;
};

export type LoadDetectionUnitsResult = BuildDetectionUnitsResult & {
  /** Books in the database, before any were dropped. */
  bookCount: number;
  /** Configured library roots the paths were made relative to. */
  roots: string[];
  /** Wall-clock ms for the read plus the assembly. */
  elapsedMs: number;
  /** Ticket 02's fresh-scan fill rates. Measurement, not detection input. */
  tagFill: TagFillCounts;
};

const countTagFill = (rows: readonly DetectionBookRow[]): TagFillCounts => ({
  rows: rows.length,
  fileFormat: rows.filter((r) => r.fileFormat != null).length,
  series: rows.filter((r) => r.series != null).length,
  part: rows.filter((r) => r.part != null).length,
  grouping: rows.filter((r) => r.grouping != null).length,
});

/**
 * Each book's first file path — its structural key.
 *
 * `bookStructuralKey` takes `chapters[0].url` after the library store sorts
 * chapters by `startMs ?? 0` with a STABLE sort, so equal keys keep their
 * fetch (rowid, i.e. insertion) order. This reproduces that exactly, from one
 * query instead of one per book:
 *
 * - `chapter_number = 1` narrows ~40k rows (auto-chapters are numerous) to
 *   roughly one per book before any model is instantiated. Every writer in the
 *   repo numbers from 1 — the scan's `index + 1`, `generateAutoChapters`, and
 *   both single-chapter rebuilds in `autoChapterGenerator`.
 *
 *   THIS DOES NOT MEAN "a book without one has no chapters", which is what
 *   this comment used to claim. Measured false on the real library
 *   (2026-08-07, 352 books): `The Dark Tower VI: Song Of Susannah` exists as
 *   TWO book rows over ONE directory — disks 01-02 and disks 03-12 — and the
 *   second holds ten chapters numbered 3-12, so it matches nothing here and is
 *   dropped. The cause of the split is NOT established (both rows carry a
 *   byte-identical author name, so `groupChaptersIntoBooks`' `author::title`
 *   key would have merged them); see
 *   `.scratch/series-implementation/NOTE-book-split.md`.
 *
 *   Left as is DELIBERATELY (driver's call, 2026-08-07): it is a scan-side
 *   defect to be examined separately, and widening this query to a per-book
 *   `min(chapter_number)` would be a large change made to accommodate a bug
 *   rather than fix it. The consequence is bounded and counted — such a row
 *   lands in `keyless` and abstains, exactly like a book outside every library
 *   root. It is NOT silent.
 * - Where a book has several (per-file chapter numbering), lowest `startMs`
 *   wins and fetch order breaks the tie, which is the store's rule.
 */
async function firstFilePathByBookId(): Promise<Map<string, string>> {
  const firstChapters = await database
    .get<Chapter>('chapters')
    .query(Q.where('chapter_number', 1))
    .fetch();

  const best = new Map<string, { startMs: number; url: string }>();
  for (const chapter of firstChapters) {
    const bookId = (chapter._raw as unknown as { book_id: string }).book_id;
    if (!bookId || !chapter.url) continue;
    const startMs = chapter.startMs ?? 0;
    const current = best.get(bookId);
    // Strictly-less-than keeps the first row seen on a tie — the stable sort.
    if (!current || startMs < current.startMs) {
      best.set(bookId, { startMs, url: chapter.url });
    }
  }

  return new Map([...best].map(([bookId, v]) => [bookId, v.url]));
}

/** Every book in the library, reduced to the fields detection reads. */
export async function loadDetectionBookRows(): Promise<DetectionBookRow[]> {
  const [books, authors, firstPaths] = await Promise.all([
    database.get<Book>('books').query().fetch(),
    database.get<Author>('authors').query().fetch(),
    firstFilePathByBookId(),
  ]);

  const authorNameById = new Map(authors.map((a) => [a.id, a.name]));

  const rows: DetectionBookRow[] = [];
  for (const book of books) {
    const firstFilePath = firstPaths.get(book.id);
    // A book with no chapters has no structural key, so nothing downstream
    // could key a membership row to it. buildDetectionUnits counts these.
    if (!firstFilePath) continue;
    const authorId = (book._raw as unknown as { author_id: string | null })
      .author_id;
    rows.push({
      firstFilePath,
      title: book.title,
      author: (authorId && authorNameById.get(authorId)) || null,
      narrator: book.narrator,
      series: book.series,
      part: book.part,
      grouping: book.grouping,
      // Measurement only — see the field's note on `DetectionBookRow`.
      fileFormat: book.fileFormat,
    });
  }
  return rows;
}

/**
 * The whole library as detection units, ready for `detectSeries`.
 *
 * Books with no chapters are dropped before `buildDetectionUnits` sees them,
 * so its `keyless` count is folded back in here rather than lost.
 */
export async function loadLibraryDetectionUnits(): Promise<LoadDetectionUnitsResult> {
  const startedAt = Date.now();

  const [rows, entries, bookCount] = await Promise.all([
    loadDetectionBookRows(),
    getLibraryFolderEntries(),
    database.get<Book>('books').query().fetchCount(),
  ]);

  const roots = entries.map(libraryRootAbsPath);
  const built = buildDetectionUnits(rows, roots);

  return {
    ...built,
    keyless: built.keyless + (bookCount - rows.length),
    bookCount,
    roots,
    elapsedMs: Date.now() - startedAt,
    tagFill: countTagFill(rows),
  };
}
