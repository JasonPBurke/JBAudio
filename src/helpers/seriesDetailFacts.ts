/**
 * Everything the Series detail sheet states, derived once — spec §C.
 *
 * DATA ONLY, no layout, no components, in the same spirit as
 * `seriesRowFacts.ts`: the sheet's three decisions that are arguable (which
 * cover the hero fans, which word the play button keeps, what a row shows) are
 * asserted here without a renderer.
 *
 * ⚠ K11 — A BOOK CELL CAN ONLY RENDER A BOOK THAT IS IN THE LIBRARY STORE. An
 * unresolvable id renders a size-accurate BLANK. That is why the rows below
 * carry the `Book` OBJECT rather than an id for the cell to re-resolve:
 * `assembleDerivedSeries` has already resolved every membership row against the
 * live library and dropped the ones that do not resolve, so a row that exists
 * here is a row that can be drawn.
 */
import { Book } from '@/types/Book';
import { DerivedSeries } from '@/helpers/seriesAssembly';
import { SeriesRowFacts, bookCoverShape } from '@/helpers/seriesRowFacts';
import {
  CLUSTER_MAX_LAYERS,
  type CoverShape,
} from '@/helpers/seriesRowGeometry';

export type SeriesDetailRow = {
  book: Book;
  /**
   * §07: the badge shows the CANONICAL number and is blank when unknown —
   * position is already carried by the layout, and blank beats misleading.
   */
  canonicalNumber: number | null;
  finished: boolean;
  shape: CoverShape;
  /**
   * List key. The book id alone is NOT unique: multi-membership is real (one
   * book can sit in two series) and the prototype harness repeats real books to
   * build a 22-book series, so the index is part of the identity.
   */
  key: string;
};

/** One row per book, in series (`position`) order — §C9. */
export function seriesDetailRows(series: DerivedSeries): SeriesDetailRow[] {
  return series.books.map((book, index) => ({
    book,
    canonicalNumber: series.canonicalNumbers[index] ?? null,
    finished: book.bookProgressValue === 2,
    shape: bookCoverShape(book),
    key: `${book.bookId}-${index}`,
  }));
}

/**
 * Assumed aspect for PINNED series artwork.
 *
 * Square, because nothing measures it: `series.artwork` is one nullable column
 * with no dimension companions, unlike a book's `artwork_width`/`_height`. A
 * square box plus the cluster layer's `cover` resize crops a non-square pinned
 * image evenly, which is the better failure than guessing a shape and
 * pillarboxing to a shape it does not have.
 */
const PINNED_ASPECT = 1;

/**
 * The hero's fan — §C8: **pinned art rides the fan's FRONT CARD**, replacing
 * card 0 rather than being prepended, so the cluster's width and its peek stay
 * exactly what §B2 fixed them at. The backdrop follows, because the backdrop is
 * drawn from `covers[0]`.
 *
 * Card 0 already IS the derived series art — `assembleDerivedSeries` walks
 * membership in `position` order — which is what makes this one expression
 * rather than a branch on where the art came from.
 */
export function heroClusterCovers(
  series: DerivedSeries,
  max: number = CLUSTER_MAX_LAYERS,
): CoverShape[] {
  // Sliced BEFORE mapping: a 41-book series would otherwise build 41 shapes to
  // draw three, on every render of the hero.
  const derived = series.books.slice(0, max).map(bookCoverShape);
  if (series.artwork === null) return derived;

  const pinned: CoverShape = { uri: series.artwork, aspect: PINNED_ASPECT };
  return derived.length === 0 ? [pinned] : [pinned, ...derived.slice(1)];
}

/**
 * The hero play button — §C9: it **keeps its word here**, where the browse row
 * dropped it. A full-width hero button has no width constraint to spend, and
 * the ~27% of row width that killed the label on browse is not a cost here.
 *
 * The three words are §B3's: `Start` for a book not yet begun (whether it is
 * the first book or the one after the last you finished), `Continue` when you
 * are mid-book, `Restart` when the whole series is done. `Restart` targets the
 * FIRST book — §B3's rule, and the helper it calls starts a finished book from
 * zero (§C5), so the button reaches the beginning rather than the credits.
 *
 * Null when there is nothing to play at all: a series whose membership rows all
 * failed to resolve, or K16's all-excluded state, which is a stable state and
 * renders with no books.
 */
export type HeroPlayAction = {
  book: Book;
  word: 'Start' | 'Continue' | 'Restart';
  /** `Continue · #9 Eric` — the word, then what it will play. */
  label: string;
};

export function heroPlayAction(
  series: DerivedSeries,
  facts: SeriesRowFacts,
): HeroPlayAction | null {
  const finished = facts.bookCount > 0 && facts.nextUp === null;
  const book = facts.nextUp ?? series.books[0] ?? null;
  if (!book) return null;

  const word = finished ? 'Restart' : facts.nextUpStarted ? 'Continue' : 'Start';

  // The number comes from the same index the book did, so a series with gaps
  // (`1, 3, 4, 8`) badges the book's own published number, never its position.
  const number = finished
    ? (series.canonicalNumbers[0] ?? null)
    : facts.nextUpNumber;

  const named =
    number !== null ? `#${number} ${book.bookTitle}` : book.bookTitle;

  return { book, word, label: `${word} · ${named}` };
}
