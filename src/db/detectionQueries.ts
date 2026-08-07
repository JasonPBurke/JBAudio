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

export type LoadDetectionUnitsResult = BuildDetectionUnitsResult & {
  /** Books in the database, before any were dropped. */
  bookCount: number;
  /** Configured library roots the paths were made relative to. */
  roots: string[];
  /** Wall-clock ms for the read plus the assembly. */
  elapsedMs: number;
};

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
 *   both single-chapter rebuilds in `autoChapterGenerator` — so a book without
 *   one has no chapters at all.
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
  };
}
