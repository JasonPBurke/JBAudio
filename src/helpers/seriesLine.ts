/**
 * §F1–F5 — the line under a book's title on `titleDetails`, as data.
 *
 * `Book 8 of Discworld`. One series, one string, no number when there isn't
 * one, and nothing at all when the book is in no series.
 *
 * Pure on purpose. Everything else about this line — where it sits in the
 * title block, what colour it is against a mesh gradient — is device-verified
 * and untestable here (§I2, and the ticket's own "test the pick, not the
 * pixels"). What jest CAN hold is §F2's pick, which is an ASYMMETRIC rule and
 * therefore the one part a later reader is likely to "simplify" into something
 * that still passes on the common case.
 */

import type { SeriesProvenance } from '@/db/seriesProvenance';

/**
 * The subset of a `DerivedSeries` this decision reads. Deliberately structural
 * rather than the real type: a fixture here is four fields, not a fabricated
 * `Book`, and `DerivedSeries` stays assignable to it for free.
 */
export type SeriesLineSource = {
  id: string;
  name: string;
  books: readonly { bookId: string }[];
  /** Index-aligned with `books` — `assembleDerivedSeries` guarantees it. */
  canonicalNumbers: readonly (number | null)[];
  origin: SeriesProvenance;
  /** Epoch ms. §F2's tiebreak for user-created series, and only for those. */
  createdAt: number;
};

/** One membership of one book, flattened for the pick. */
export type SeriesLineMembership = {
  seriesId: string;
  name: string;
  /** §D3's published number for THIS book in THIS series. Null is the norm. */
  canonicalNumber: number | null;
  /** Member count — §F2's signal, and only meaningful for detected series. */
  size: number;
  origin: SeriesProvenance;
  createdAt: number;
};

/**
 * Every series this book is in.
 *
 * Matched on `bookId`, not on the structural key: `assembleDerivedSeries` has
 * already resolved every membership row against the live library, so the books
 * in here ARE library books and this is the same id `titleDetails` was routed
 * with. Tombstoned rows never reach this point — the exclusion filter lives in
 * the assembly (§A11).
 */
export function bookSeriesMemberships(
  series: readonly SeriesLineSource[],
  bookId: string | undefined,
): SeriesLineMembership[] {
  if (!bookId) return [];
  const out: SeriesLineMembership[] = [];
  for (const s of series) {
    const index = s.books.findIndex((b) => b.bookId === bookId);
    if (index === -1) continue;
    out.push({
      seriesId: s.id,
      name: s.name,
      canonicalNumber: s.canonicalNumbers[index] ?? null,
      size: s.books.length,
      origin: s.origin,
      createdAt: s.createdAt,
    });
  }
  return out;
}

/**
 * §F2 — the ONE series the line names.
 *
 *   1. among DETECTED series, the LARGEST wins
 *   2. failing that, the FIRST user-created one, in creation order
 *
 * ⚠ THE ASYMMETRY IS THE RULING, NOT AN OVERSIGHT. Detected series have no
 * meaningful creation order — it is scan order — so size is the only signal
 * available, and the bigger series is almost always the canonical one with the
 * sub-series as the specialist grouping. User-created series DO have a
 * meaningful order, so "first created" stands for them. Collapsing both arms
 * to one comparator loses the ruling and still passes on a book in one series.
 *
 * The cost, accepted knowingly: *Guards! Guards!* names Discworld 8 here and
 * simply does not mention Night Watch 1. That membership is reachable by
 * opening the series sheet — verified against a book in 12 series.
 *
 * Both arms keep the FIRST candidate on a tie, so the pick is stable: the list
 * arrives A–Z by display order (`compareSeriesNames`), and a tie therefore
 * resolves alphabetically rather than by whatever order the observer happened
 * to emit. ⚠ One exception since ticket 32: two names that differ ONLY by a
 * leading article tie under that comparator too, so between `The Dresden
 * Files` and `Dresden Files` of equal size the pick falls back to observer
 * order. Vanishingly rare, and noted rather than coded around.
 */
export function pickPrimarySeries(
  items: readonly SeriesLineMembership[],
): SeriesLineMembership | null {
  const detected = items.filter((m) => m.origin === 'detected');
  if (detected.length > 0) {
    return detected.reduce((best, m) => (m.size > best.size ? m : best));
  }
  if (items.length === 0) return null;
  return items.reduce((best, m) => (m.createdAt < best.createdAt ? m : best));
}

/**
 * §F4 — the string. `Part of <series>` when there is no canonical number,
 * NEVER a substituted position: the book at index 1 of a series is not
 * thereby "Book 2", and blank beats misleading.
 */
export function formatSeriesLine(m: SeriesLineMembership): string {
  return m.canonicalNumber === null
    ? `Part of ${m.name}`
    : `Book ${m.canonicalNumber} of ${m.name}`;
}

/**
 * The whole decision in one call, for the component. Null means §F5: render
 * nothing at all, not a dimmed placeholder.
 */
export function bookSeriesLine(
  series: readonly SeriesLineSource[],
  bookId: string | undefined,
): string | null {
  const picked = pickPrimarySeries(bookSeriesMemberships(series, bookId));
  return picked ? formatSeriesLine(picked) : null;
}
