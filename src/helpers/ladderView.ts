import type { LadderView } from '@/helpers/ladderDecisions';

/**
 * §H1 -- the mount site's mapping from the view toggle's ORDINAL to the ladder's
 * NAMED view. The ladder never learns the ordinal; this is the one place the
 * two vocabularies meet, and `LadderView`'s own docblock in `ladderDecisions.ts`
 * carries the reason.
 *
 * Its own module rather than a `const` inside the library screen only so the
 * fall-through below can be pinned by a test in the fast `helpers` lane --
 * importing the screen would drag FlashList through `jest-expo`'s transform
 * allowlist, which this effort has already tried and backed out of. Nothing but
 * the library screen imports it.
 *
 * ⚠ THE UNMAPPED ORDINAL MUST NOT LAND ON `booksHome`. That is the only
 * sectioned view (`SECTIONED_VIEWS`), so it is the only one that arms the
 * section rung and the collapse sweep -- and the ranges ref is never emptied on
 * a view toggle (§R5), so a fourth view mapped there by accident would resolve
 * back against another list's indices and collapse the reader's expansions
 * while they are looking at something else. It would compile and it would be
 * silent. §H7 advertises reviving `BooksList` as a zero-diff change, so the
 * fourth ordinal is a matter of when, not if: the cascade below therefore names
 * `booksHome` EXPLICITLY and lets anything unrecognised degrade to a
 * two-rung view, where the worst case is a missing rung rather than a
 * destructive one.
 */
export const ladderViewFor = (toggleView: number): LadderView =>
  toggleView === 0 ? 'booksHome' : toggleView === 1 ? 'seriesHome' : 'booksGrid';
