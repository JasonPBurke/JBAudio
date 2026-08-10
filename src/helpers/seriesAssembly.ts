import { Book } from '@/types/Book';
import { bookStructuralKey } from '@/helpers/bookStructuralKey';
import {
  deriveSeriesProgressState,
  SeriesProgressState,
} from '@/helpers/seriesProgress';

export type SeriesRow = {
  id: string;
  name: string;
  sortName: string;
  /**
   * A pinned series cover, or null to derive it from the member books. Only the
   * detail sheet's hero reads it today (§C8) — the browse row's fan is book
   * covers in both cases, which is why the `Series Backgrounds` toggle is not
   * called "show cover art".
   */
  artwork?: string | null;
};
export type MembershipRow = {
  seriesId: string;
  bookKey: string;
  position: number;
  /**
   * The published number shown on a badge and collapsed into the browse row's
   * canonical range. `position` keeps sole sort authority — this is displayed,
   * never sorted on. Null is the norm, not an edge case: a book with no
   * detectable number carries none, and blank beats misleading.
   */
  canonicalNumber: number | null;
};
export type DerivedSeries = {
  id: string;
  name: string;
  /**
   * Pinned series artwork, null when it is derived from the first book. §C8:
   * pinned art REPLACES the fan's front card rather than being prepended, so
   * the cluster's width and peek are the same either way.
   */
  artwork: string | null;
  books: Book[];
  /**
   * Canonical numbers INDEX-ALIGNED with `books` — so a membership row whose
   * key no longer resolves drops its number with it. Misalignment here would
   * badge every later book with its neighbour's number.
   */
  canonicalNumbers: (number | null)[];
  progressState: SeriesProgressState;
};

/** Index the live library by structural key for O(1) membership resolution. */
function buildKeyMap(bookMap: Record<string, Book>): Map<string, Book> {
  const m = new Map<string, Book>();
  for (const book of Object.values(bookMap)) {
    const key = bookStructuralKey(book);
    if (key) m.set(key, book);
  }
  return m;
}

/**
 * Combine observed series + membership rows with the live library book map into
 * render-ready series. Membership keys that don't resolve against the live
 * library are silently skipped (graceful skip). Books are ordered by their
 * membership `position`; series are ordered A–Z by `sortName`.
 */
export function assembleDerivedSeries(
  series: SeriesRow[],
  memberships: MembershipRow[],
  bookMap: Record<string, Book>,
): DerivedSeries[] {
  const keyMap = buildKeyMap(bookMap);

  const bySeries = new Map<string, MembershipRow[]>();
  for (const m of memberships) {
    if (!bySeries.has(m.seriesId)) bySeries.set(m.seriesId, []);
    bySeries.get(m.seriesId)!.push(m);
  }

  const sortNameById = new Map(series.map((s) => [s.id, s.sortName]));

  const derived = series.map((s) => {
    const rows = (bySeries.get(s.id) ?? [])
      .slice()
      .sort((a, b) => a.position - b.position);
    const books: Book[] = [];
    const canonicalNumbers: (number | null)[] = [];
    for (const r of rows) {
      const book = keyMap.get(r.bookKey);
      if (!book) continue; // graceful skip for unresolved keys
      books.push(book);
      // Pushed in the same branch, never in a parallel pass: an unresolved key
      // must drop its number too or the two arrays desynchronise.
      canonicalNumbers.push(r.canonicalNumber);
    }
    return {
      id: s.id,
      name: s.name,
      artwork: s.artwork ?? null,
      books,
      canonicalNumbers,
      progressState: deriveSeriesProgressState(books),
    };
  });

  return derived.sort((a, b) =>
    (sortNameById.get(a.id) ?? '').localeCompare(sortNameById.get(b.id) ?? ''),
  );
}

/** Series counts by aggregate state, for the tab bar in Series view. */
export function countSeriesByState(list: DerivedSeries[]) {
  const c = { all: list.length, unplayed: 0, playing: 0, finished: 0 };
  for (const s of list) c[s.progressState]++;
  return c;
}

/**
 * Filter series by a search query: match on series name OR any member book
 * title. Matched series keep all their books. Blank query returns all.
 */
export function filterSeriesBySearch(
  list: DerivedSeries[],
  query: string,
): DerivedSeries[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.books.some((b) => b.bookTitle.toLowerCase().includes(q)),
  );
}
