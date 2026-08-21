/**
 * The back-to-top ladder's judgement, as pure functions over a snapshot of
 * plain numbers and sets.
 *
 * The ladder's IO lives in the screen-installed hook, which is gather -> decide
 * -> execute. Everything that constitutes a *decision* lives here instead,
 * because jest in this repo is jsdom with no React Native preset: anything that
 * imports React Native, a native module or a screen cannot be tested at all.
 * Extracting the judgement is what lets every rung-selection rule be verified
 * off-device on every commit.
 */

/**
 * Which library list the ladder is acting on.
 *
 * A NAME, never the view toggle's 0/1/2. That ordinal is a UI toggle position
 * rather than a view identity — it is local state, persisted nowhere, and the
 * two plausible futures for `booksList` (replacing the grid, or joining it as a
 * fourth option) are exactly the changes that renumber it.
 */
export type LadderView = 'booksHome' | 'seriesHome' | 'booksGrid' | 'booksList';

/** The index span one section occupies in a sectioned list's flattened data. */
export type SectionRange = {
  sectionId: string;
  /** index of the section's header item */
  start: number;
  /** index of the section's last item, INCLUSIVE */
  end: number;
};

export type LadderSnapshot = {
  view: LadderView;
  drawerOpen: boolean;
  offset: number;
  firstItemOffset: number;
  expanded: Set<string>;
  ranges: SectionRange[];
  /** LAZY — must not be called before the offset predicate passes (B7). */
  visible: () => { startIndex: number; endIndex: number };
  layoutY: (index: number) => number | undefined;
};

/**
 * Which views the intermediate rung and the collapse sweep are available on.
 *
 * The capability comes from view IDENTITY and is never inferred from data: the
 * expanded-section set persists across view toggles (nothing clears it), so
 * "this view has sections" cannot be read off that set being non-empty.
 */
const SECTIONED_VIEWS = new Set<LadderView>(['booksHome']);

/**
 * Sub-pixel guard. An index-based test alone re-fires the rung when the landing
 * offset settles a hair past the header's y.
 */
const SUBPIXEL_EPSILON = 1;

export type BackPressDecision =
  | { kind: 'decline'; reason: 'drawer' | 'no-list' | 'at-top' }
  | { kind: 'scrollTo'; offset: number; rung: 'section' | 'master' };

/**
 * Decide where a back press should land.
 *
 * `null` means no list is mounted. The absence of a snapshot IS the absence of
 * a list: `visible` and `layoutY` can only be built from a live ref, so a
 * snapshot cannot exist without one. A `hasList` field would instead admit the
 * impossible state of "no list" alongside a real offset and live thunks, and
 * would make the caller fabricate numbers it does not have.
 */
export function decideBackPress(s: LadderSnapshot | null): BackPressDecision {
  if (s === null) return { kind: 'decline', reason: 'no-list' };

  // The drawer consumes back upstream. Guarding here rather than at the call
  // site is what stops it being forgotten.
  if (s.drawerOpen) return { kind: 'decline', reason: 'drawer' };

  // The arm predicate, read live from the list's own ref. `firstItemOffset` is
  // exactly the offset at which the first item's top reaches the viewport top,
  // so this reads literally as "is any list item above the fold?".
  //
  // It stays an INEQUALITY: the resting offset can legitimately be negative
  // (overscroll at the top, or briefly after a sweep), and `<=` is the side
  // every negative value falls on.
  if (s.offset <= s.firstItemOffset) return { kind: 'decline', reason: 'at-top' };

  // Past this point the predicate has passed, which is what makes `visible()`
  // safe to call: it throws when the list has no layout manager, and such a
  // list reads BOTH accessors as 0 -- so the predicate is `0 > 0`, false, and
  // has declined above. Predicate true => layout exists.
  //
  // The premise needs the OFFSET to read 0 as well, not just firstItemOffset,
  // and that half is reasoned rather than measured -- reaching the throw takes
  // a scrolled list that has lost its layout manager. Deliberately NOT wrapped
  // in try/catch: swallowing it would turn a loud bug into a silent scroll to
  // master top, and the boundary with the back handler belongs to the hook,
  // not to a pure decision.
  const headerY = sectionRungTarget(s);
  if (headerY !== null) return { kind: 'scrollTo', offset: headerY, rung: 'section' };

  return { kind: 'scrollTo', offset: 0, rung: 'master' };
}

/**
 * The intermediate rung's landing offset, or `null` when the rung does not
 * apply and the press falls through to master top.
 */
function sectionRungTarget(s: LadderSnapshot): number | null {
  if (!SECTIONED_VIEWS.has(s.view)) return null;

  const { startIndex } = s.visible();

  // The section CONTAINING the viewport top -- the nearest one, not the
  // earliest expanded one in the list. Recently Added is the first item of
  // every non-empty BooksHome, so the earliest reading targets index 0 whenever
  // it is open, which is master top: a guaranteed dead press.
  const containing = s.ranges.find((r) => r.start <= startIndex && r.end >= startIndex);
  if (containing === undefined) return null;
  if (!s.expanded.has(containing.sectionId)) return null;

  const headerY = s.layoutY(containing.start);
  if (headerY === undefined) return null;

  // An intermediate rung is by definition a stop STRICTLY BETWEEN master top
  // and where you already are. Both halves fall out of that one idea:
  //
  //   0 < headerY                          it is below master's own target
  //   headerY < offset - SUBPIXEL_EPSILON  it is meaningfully above you
  //
  // The lower bound is why a header at index 0 (y === 0) needs no special case:
  // its target IS master top, so it degenerates into the master branch and the
  // ladder reports what it actually did.
  if (headerY <= 0) return null;
  if (s.offset - headerY <= SUBPIXEL_EPSILON) return null;

  return headerY;
}
