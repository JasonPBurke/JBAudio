import { Book } from '@/types/Book';
import { bookStructuralKey } from '@/helpers/bookStructuralKey';
import {
  resolveMembership,
  resolveProvenance,
  SeriesProvenance,
} from '@/db/seriesProvenance';
import {
  deriveSeriesProgressState,
  SeriesProgressState,
} from '@/helpers/seriesProgress';

export type SeriesRow = {
  id: string;
  name: string;
  identityKey: string;
  /**
   * A pinned series cover, or null to derive it from the member books.
   *
   * ⚠ §C8 (amended 2026-08-11) — this is BACKGROUND ART. It paints the detail
   * sheet's header backdrop and the browse row's card backdrop, and it never
   * enters either cover fan: the fan is the books, front card book 1, always.
   * Which is why the `Series Backgrounds` toggle is not called "show cover art".
   */
  artwork?: string | null;
  /**
   * A06's `series.origin`, RAW — `'detected' | 'user'`, null on every row that
   * predates v33. Handed over uncoalesced for `membership`'s reason: the
   * resolution rule lives in one place (`seriesProvenance.ts`) and this is a
   * consumer of it, not a second copy.
   */
  origin?: string | null;
  /**
   * Epoch ms. Carried for exactly one reader — §F2's "first user-created" arm
   * — and it cannot be recovered downstream, because the assembled list is
   * sorted A–Z by sort name.
   */
  createdAt: number;
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
  /**
   * A11 — `'detected' | 'user' | 'excluded'`, null (every pre-v33 row) reads
   * as `'user'`. Only `'excluded'` is acted on here: it is a TOMBSTONE, a
   * hidden row whose entire job is to block re-derivation, and no surface may
   * draw it. The other two are the same thing to a reader.
   */
  membership?: string | null;
};
export type DerivedSeries = {
  id: string;
  name: string;
  /**
   * Pinned series artwork, null when the backgrounds derive from the first
   * book. Read through `seriesBackdropUri` — §C8 (amended) keeps series art out
   * of the cover fan entirely, so this must never be substituted into a
   * cluster.
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
  /**
   * Who created this series, coalesced. §F2 branches on it: a detected series
   * competes on size, a user-created one on creation order.
   */
  origin: SeriesProvenance;
  /** Epoch ms — §F2's tiebreak among user-created series. */
  createdAt: number;
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
 * membership `position`; series are ordered A–Z by `identityKey`.
 *
 * ⚠ **Ordering by `identityKey` is the KNOWN DEFECT, not the design.** That key
 * exists to answer "are these the same series?", and borrowing it to sort is
 * why `The Dresden Files` files under T. Ticket 32 replaces the comparator
 * below with `compareSeriesNames`, which strips a leading article. Fix it
 * THERE — never by changing what `seriesIdentityKey` returns, which would merge
 * two distinct series. See ADR 0002.
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

  const identityKeyById = new Map(series.map((s) => [s.id, s.identityKey]));

  const derived = series.map((s) => {
    const rows = (bySeries.get(s.id) ?? [])
      // A11 — the tombstone filter, and this is the ONE place it lives. Every
      // Series surface resolves its books through this function, so filtering
      // here is what makes "removed" mean removed on the browse row, the
      // detail sheet, the editor and the counts alike. ⚠ It is deliberately
      // NOT applied in `loadExistingSeries`: reconcile needs the tombstones,
      // and `deleteEmptySeries` must keep counting them (K16).
      .filter((m) => resolveMembership(m.membership) !== 'excluded')
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
      origin: resolveProvenance(s.origin),
      createdAt: s.createdAt,
    };
  });

  return derived.sort((a, b) =>
    (identityKeyById.get(a.id) ?? '').localeCompare(
      identityKeyById.get(b.id) ?? '',
    ),
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
