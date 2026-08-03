/**
 * THROWAWAY — Series UX redesign prototype harness (ticket 08). See ./README.md.
 *
 * DATA ONLY — no layout, no components. The three ticket-08 variants disagree
 * about how a series should be *drawn*; they must not disagree about what a
 * series *is*, or the A/B is measuring the wrong thing. Everything a card, a
 * rich header or a detail screen wants to state about a series is derived here,
 * once.
 *
 * Two things worth knowing before editing:
 *
 * 1. `bookProgressValue` IS A TRI-STATE ENUM, NOT A FRACTION.
 *    0 = NotStarted, 1 = Started, 2 = Finished (`src/db/models/Book.ts:40`).
 *    A progress bar built by averaging it would render "1 of 7 finished" as
 *    50%. Series completion here is therefore a COUNT of finished books.
 *
 * 2. SYNTHETIC SERIES FORCE `progressState` AT THE SERIES LEVEL while their
 *    books keep their real per-book values (`syntheticSeries.ts` — "forced, not
 *    derived: the pool's real progress can't cover all three"). So a fabricated
 *    'finished' series can be full of unstarted books, and a card reading
 *    "0 of 5 finished" under a Finished chip is noise, not signal. For
 *    `proto:`-prefixed ids only, per-book progress is reconciled to the forced
 *    state below. Real series are untouched — their `progressState` is derived
 *    from these same books, so they are already consistent.
 */
import { Book } from '@/types/Book';
import { DerivedSeries } from '@/helpers/seriesAssembly';
import { collapseNumberRange, ProtoSeries } from './syntheticSeries';

/** 0 NotStarted · 1 Started · 2 Finished — mirrors BookProgressState. */
type ProgressValue = 0 | 1 | 2;

/**
 * A cover plus the aspect ratio needed to draw its container to the artwork's
 * real shape, the way `BookGridItem` already does
 * (`BookGridItem.tsx:239-250` — `width: aspectRatio * ROW_COVER_HEIGHT`).
 *
 * Fallback is 500×500 (square), matching `BookGridItem`'s `safeArtworkWidth` /
 * `safeArtworkHeight` defaults, so a book whose extraction failed does not
 * collapse to a zero-width sliver.
 */
export type CoverShape = { uri: string | null; aspect: number };

const FALLBACK_DIM = 500;

export function bookCoverShape(book: Book): CoverShape {
  const w = book.artworkWidth || FALLBACK_DIM;
  const h = book.artworkHeight || FALLBACK_DIM;
  return { uri: book.artwork, aspect: w / h };
}

/**
 * Draw `shape` inside a fixed `box`, touching the box on its long axis. Keeps
 * the CONTAINER a constant size so neighbouring rows stay aligned, while the
 * image itself still takes the artwork's true proportions — which is what
 * stops a wide cover shoving a book's title to the right.
 */
export function fitInBox(
  shape: CoverShape,
  box: number,
): { width: number; height: number } {
  return shape.aspect >= 1
    ? { width: box, height: box / shape.aspect }
    : { width: box * shape.aspect, height: box };
}

/**
 * How many covers fit on one row at `height`, always leaving room for the
 * `+N` card when books remain unshown.
 *
 * Consequence, accepted by the driver (2026-08-03): at a fixed height, tall
 * covers are NARROWER than square ones, so the count differs per series on the
 * same device. Two 6-book series can legitimately show 5 and 3.
 */
export function fitCoverCount(
  shapes: CoverShape[],
  bookCount: number,
  available: number,
  height: number,
  gap: number,
  moreCardWidth: number,
): number {
  let used = 0;
  let n = 0;
  for (const shape of shapes) {
    const w = fitInBox(shape, height).width;
    const next = used + (n > 0 ? gap : 0) + w;
    // Reserve the `+N` card only while books would still be left over.
    const needsMore = bookCount - (n + 1) > 0;
    if (next + (needsMore ? gap + moreCardWidth : 0) > available) break;
    used = next;
    n += 1;
  }
  // Never render an empty row — one cover beats none even if it overflows.
  return Math.max(1, n);
}

export type SeriesFacts = {
  bookCount: number;
  finishedCount: number;
  /** 0..1, by finished-book count. Never by averaging the tri-state field. */
  completion: number;
  /** First book not yet finished — the "continue" candidate. null when done. */
  nextUp: Book | null;
  /** Index of `nextUp` within `books`, or -1. */
  nextUpIndex: number;
  /** Canonical number of `nextUp`, when one is known. */
  nextUpNumber: number | null;
  /** `1, 3-4, 8` — already collapsed. Empty string when nothing is numbered. */
  range: string;
  /** Per-book progress AFTER the synthetic reconciliation described above. */
  progressValues: ProgressValue[];
  /**
   * Distinct covers in series order, with their shapes. Deduped, capped at
   * `clusterMax`. Callers that lay out responsively should ask for more than
   * they expect to draw and let the layout decide (see `fitCoverCount`).
   */
  cluster: CoverShape[];
};

/**
 * Reconcile per-book progress with a synthetic series' forced state, so a
 * fabricated row is internally coherent. Real series fall straight through.
 *
 * The `proto:` prefix is the discriminator, and it is load-bearing elsewhere
 * too — `syntheticSeries.ts` chose it so fabricated ids can never collide with
 * real ones in the expanded-sections Set the library screen holds.
 */
function reconcileProgress(series: DerivedSeries): ProgressValue[] {
  const real = series.books.map(
    (b) => (b.bookProgressValue ?? 0) as ProgressValue,
  );
  if (!series.id.startsWith('proto:')) return real;

  if (series.progressState === 'finished') return real.map(() => 2);
  if (series.progressState === 'unplayed') return real.map(() => 0);

  // 'playing'. Use the real values when they already express a part-read
  // series. The emulator's 8-book pool often cannot (every book unstarted, or
  // every book finished), and a "mixed progress" stress row that renders as
  // uniformly untouched tests nothing — so fall back to a deterministic
  // progression: leading third finished, one in flight, remainder untouched.
  const hasMix = real.some((v) => v > 0) && real.some((v) => v < 2);
  if (hasMix) return real;

  const done = Math.floor(real.length / 3);
  return real.map((_, i) => (i < done ? 2 : i === done ? 1 : 0));
}

export function getSeriesFacts(
  series: DerivedSeries,
  clusterMax = 12,
): SeriesFacts {
  const books = series.books;
  const progressValues = reconcileProgress(series);

  // Fabricated numbers live on ProtoSeries; real series carry none until the
  // schema v33 column ticket 07 specified actually exists.
  const numbers = (series as ProtoSeries).canonicalNumbers ?? [];

  const finishedCount = progressValues.filter((v) => v === 2).length;
  const nextUpIndex = progressValues.findIndex((v) => v !== 2);

  // Covers repeat hard under synthetic data (a 22-book series over an 8-book
  // pool), and a "stack" of three identical covers reads as a rendering bug
  // rather than a collection. Dedupe by uri so the cluster stays legible.
  const cluster: CoverShape[] = [];
  const seen = new Set<string>();
  for (const b of books) {
    const key = b.artwork ?? '__none__';
    if (seen.has(key)) continue;
    seen.add(key);
    cluster.push(bookCoverShape(b));
    if (cluster.length >= clusterMax) break;
  }

  return {
    bookCount: books.length,
    finishedCount,
    completion: books.length === 0 ? 0 : finishedCount / books.length,
    nextUp: nextUpIndex === -1 ? null : books[nextUpIndex],
    nextUpIndex,
    nextUpNumber: nextUpIndex === -1 ? null : (numbers[nextUpIndex] ?? null),
    range: collapseNumberRange(numbers),
    progressValues,
    cluster,
  };
}

/**
 * The one-line meta string under a series name. Deliberately shared: if the
 * variants disagree about this sentence the driver ends up comparing copy
 * instead of comparing structure.
 */
export function seriesMetaLine(facts: SeriesFacts): string {
  const books = `${facts.bookCount} book${facts.bookCount === 1 ? '' : 's'}`;
  if (facts.finishedCount === 0) return books;
  if (facts.finishedCount === facts.bookCount) return `${books} · finished`;
  return `${books} · ${facts.finishedCount} finished`;
}
