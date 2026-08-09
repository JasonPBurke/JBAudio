/**
 * Everything the Series browse row states about a series, derived once.
 *
 * DATA ONLY — no layout, no components. Spec §B1's three-part text column
 * (name · meta line · completion bar · next-up line) is built entirely from
 * this, so the copy and the arithmetic can be asserted without a renderer.
 *
 * ⚠ `bookProgressValue` IS A TRI-STATE ENUM, NOT A FRACTION — 0 NotStarted,
 * 1 Started, 2 Finished (`db/models/Book.ts`). A completion bar built by
 * averaging it renders "1 of 7 finished" as 50%. Series completion is a COUNT
 * of finished books (trap K12).
 */
import { Book } from '@/types/Book';
import { DerivedSeries } from '@/helpers/seriesAssembly';
import { collapseNumberRange } from '@/helpers/seriesRange';
import {
  CLUSTER_MAX_LAYERS,
  type CoverShape,
} from '@/helpers/seriesRowGeometry';

/** Matches `BookGridItem`'s fallback, so a failed extraction stays square. */
const FALLBACK_DIM = 500;

export function bookCoverShape(book: Book): CoverShape {
  const w = book.artworkWidth || FALLBACK_DIM;
  const h = book.artworkHeight || FALLBACK_DIM;
  return { uri: book.artwork, aspect: w / h };
}

export type SeriesRowFacts = {
  bookCount: number;
  finishedCount: number;
  /** 0..1, by finished-book COUNT. Never by averaging the tri-state field. */
  completion: number;
  /** First book not yet finished — the play glyph's target. null when done. */
  nextUp: Book | null;
  /** Index of `nextUp` within `books`, or -1. */
  nextUpIndex: number;
  /** Canonical number of `nextUp`, when one is known. */
  nextUpNumber: number | null;
  /**
   * Is `nextUp` already part-read (tri-state `1 = Started`) rather than
   * untouched? Distinguishes **mid-book** from **between books**, which is the
   * difference between `Continue · #9 Eric` and `Next · #9 Eric` — and that
   * distinction is what lets the play glyph drop its `Start`/`Continue`/
   * `Restart` word without losing the information (§B3).
   */
  nextUpStarted: boolean;
  /** `1, 3-4, 8` — already collapsed and capped. '' when nothing is numbered. */
  range: string;
  /** Covers for the fan, in series order, capped at the layer count. */
  cluster: CoverShape[];
};

export function getSeriesRowFacts(
  series: DerivedSeries,
  clusterMax: number = CLUSTER_MAX_LAYERS,
): SeriesRowFacts {
  const books = series.books;
  const numbers = series.canonicalNumbers;

  const finishedCount = books.filter((b) => b.bookProgressValue === 2).length;
  const nextUpIndex = books.findIndex((b) => b.bookProgressValue !== 2);

  /*
   * NOT DEDUPED, deliberately. The prototype deduped by uri because synthetic
   * series cycled an 8-book pool and stacked three identical covers. Real
   * repeats are real: a boxset whose books share one cover is still a set, and
   * collapsing it to a single layer draws exactly the "one lone cover" K13
   * exists to prevent.
   */
  const cluster = books.slice(0, clusterMax).map(bookCoverShape);

  return {
    bookCount: books.length,
    finishedCount,
    completion: books.length === 0 ? 0 : finishedCount / books.length,
    nextUp: nextUpIndex === -1 ? null : books[nextUpIndex],
    nextUpIndex,
    nextUpNumber: nextUpIndex === -1 ? null : (numbers[nextUpIndex] ?? null),
    nextUpStarted:
      nextUpIndex !== -1 && books[nextUpIndex].bookProgressValue === 1,
    range: collapseNumberRange(numbers),
    cluster,
  };
}

/**
 * The one-line meta string under a series name: `22 books · 7 finished · #1-22`.
 *
 * §H9 — THE SACRIFICE ORDER IS `M finished` FIRST. It is the only redundant
 * segment (the completion bar renders the same count directly beneath it),
 * while the canonical range has no other home on browse. `6 books · 2 finished
 * · #1…` becomes `6 books · #1-6`.
 *
 * `overflowing` must come from a MEASUREMENT of the rendered line
 * (`isMetaLineOverflowing`), never from a font-scale threshold — that was the
 * prototype's proxy and it is wrong in both directions (K14).
 */
export function seriesMetaLine(
  facts: SeriesRowFacts,
  { overflowing }: { overflowing: boolean },
): string {
  const parts = [`${facts.bookCount} book${facts.bookCount === 1 ? '' : 's'}`];
  if (!overflowing && facts.finishedCount > 0) {
    parts.push(
      facts.finishedCount === facts.bookCount
        ? 'finished'
        : `${facts.finishedCount} finished`,
    );
  }
  if (facts.range !== '') parts.push(`#${facts.range}`);
  return parts.join(' · ');
}

/** `Next · #9 Eric` / `Continue · #9 Eric` / `Series complete` (§B1, §B3). */
export type NextUpLine = {
  state: 'next' | 'continue' | 'complete';
  text: string;
};

/**
 * The next-up line, or null when there is nothing to say.
 *
 * THREE states, not two. `Continue` means you are mid-book; `Next` means you
 * finished the last one and this is what follows. Between this line and the
 * progress bar, every state the removed `Start`/`Continue`/`Restart` button
 * label carried is still stated — which is what makes the word redundant rather
 * than sacrificed (§B3).
 *
 * The null case is a series with no resolvable books (K16 leaves an
 * all-excluded series standing, and a moved library can leave one empty).
 * `Series complete` would be a lie there.
 */
export function nextUpLine(facts: SeriesRowFacts): NextUpLine | null {
  if (facts.bookCount === 0) return null;
  if (!facts.nextUp) return { state: 'complete', text: 'Series complete' };

  const title = facts.nextUp.bookTitle;
  const named =
    facts.nextUpNumber !== null ? `#${facts.nextUpNumber} ${title}` : title;
  return facts.nextUpStarted
    ? { state: 'continue', text: `Continue · ${named}` }
    : { state: 'next', text: `Next · ${named}` };
}
