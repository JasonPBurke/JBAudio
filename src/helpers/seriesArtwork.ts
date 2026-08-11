/**
 * What a series' cover IS, and what the editor's caption says about it —
 * spec §C8, §D6, §D7, §D10.
 *
 * DATA ONLY, no components, in the same spirit as `seriesDetailFacts.ts`. The
 * rule "pinned artwork, else the first book's" is one line, and it is written
 * in two places — the detail sheet's hero fan and the editor's cover control —
 * so it is asserted here once rather than left to agree by inspection.
 */
import { Book } from '@/types/Book';
import type { DerivedSeries } from '@/helpers/seriesAssembly';
import { bookCoverShape } from '@/helpers/seriesRowFacts';
import type { CoverShape } from '@/helpers/seriesRowGeometry';

/**
 * Assumed aspect for PINNED series artwork.
 *
 * Square, because nothing measures it: `series.artwork` is one nullable column
 * with no dimension companions, unlike a book's `artwork_width`/`_height`. A
 * square box plus a `cover` resize crops a non-square pinned image evenly,
 * which is the better failure than guessing a shape and pillarboxing to a
 * shape it does not have.
 */
export const PINNED_ARTWORK_ASPECT = 1;

/**
 * The image a series' BACKGROUNDS are painted from — §C8, and the only place
 * `series.artwork` is read outside the editor's own control.
 *
 * ⚠ SERIES ART IS BACKGROUND-ONLY. It paints the detail sheet's header
 * backdrop and the browse row's card backdrop, and **it never enters the cover
 * fan** — the fan is the books, and its front card is book 1, always. If a
 * pinned cover happens to match book 1's, that is coincidence, not coupling.
 *
 * This is the reason the expression lives here rather than being read off
 * `covers[0]`, which is how both surfaces used to get it: sharing that one line
 * is precisely what made the fan and the backdrop move together. They are two
 * decisions and they now read as two.
 *
 * Null when a series has neither — an empty series, or books with no artwork.
 * Every caller falls back to the placeholder, as they already did.
 */
export function seriesBackdropUri(series: DerivedSeries): string | null {
  return series.artwork ?? series.books[0]?.artwork ?? null;
}

/**
 * The cover the SERIES EDITOR draws — §D6.
 *
 * The editor is the one surface that shows pinned art AS a cover rather than
 * as a background, because it is the control that owns the asset: you cannot
 * choose or revert a cover you cannot see.
 *
 * ⚠ `firstBook` MUST come from the editor's live drag order, never from the
 * saved series. §D10 is the reason the control sits on this screen at all:
 * `Sort by number` silently changes a derived cover, because the cover follows
 * the first book and a re-sort moves it. You are meant to WATCH that happen
 * and pin it if you disagree, which only works if the preview tracks the list
 * you are dragging rather than the last thing saved.
 *
 * Never null: `uri: null` is a real state (a series whose books resolve to no
 * artwork, or K16's all-excluded series) and every cover renderer in the app
 * already draws the placeholder for it.
 */
export function editorCoverShape(
  artwork: string | null,
  firstBook: Book | undefined,
): CoverShape {
  if (artwork !== null) return { uri: artwork, aspect: PINNED_ARTWORK_ASPECT };
  if (!firstBook) return { uri: null, aspect: PINNED_ARTWORK_ASPECT };
  return bookCoverShape(firstBook);
}

/**
 * The caption under the editor's cover control — §D7.
 *
 * ONE ELEMENT DOING THREE JOBS: it says which cover the series is using, it
 * explains where a derived cover comes from, and in the pinned state it is
 * itself the way back. **Words rather than a pin badge**, on §D2's division: a
 * badge tells you the state and gives you nothing to press, so reverting would
 * need a second, undiscoverable affordance.
 *
 * Note that the two strings are not a state and its negation. The muted one
 * NAMES the state (`Using…`); the pressable one names what pressing it DOES
 * (`Use…instead`). A pressable that read `Pinned` would be the badge this
 * rejects, wearing a button's clothes.
 */
export type SeriesArtworkCaption = {
  text: string;
  /**
   * True only in the pinned state. False means muted and non-interactive —
   * there is nothing to revert TO.
   */
  reverts: boolean;
};

export function seriesArtworkCaption(
  artwork: string | null,
): SeriesArtworkCaption {
  return artwork === null
    ? { text: 'Using first book’s cover', reverts: false }
    : { text: 'Use first book’s cover instead', reverts: true };
}

/**
 * The one author every book in the series shares, or null if they disagree.
 *
 * Seeds the cover search (`Brandon Sanderson Mistborn series cover`). Null
 * rather than "the first book's author" on a mixed series: a hand-built
 * playlist spanning five authors would otherwise send one of them into the
 * query and quietly narrow the results to that author's covers, which is worse
 * than searching the series name alone.
 */
export function sharedAuthorName(books: Book[]): string | null {
  const first = books[0]?.author;
  if (!first) return null;
  return books.every((book) => book.author === first) ? first : null;
}
