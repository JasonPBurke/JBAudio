import type { LadderView } from '@/helpers/ladderDecisions';
import type { BooksLayout } from '@/types/booksLayout';

/**
 * §H1 -- the mount site's mapping from the two axes the library screen owns to
 * the ladder's NAMED view. The ladder never learns the ordinal; this is the one
 * place the two vocabularies meet, and `LadderView`'s own docblock in
 * `ladderDecisions.ts` carries the reason.
 *
 * ⚠ ADR 0006: SHELF and LAYOUT are two axes, not four positions on one. The
 * header's control cycles the shelf; the Books shelf -- alone -- also has a
 * layout. Collapsing them into one `LadderView` happens HERE and nowhere else,
 * and every consumer that needs a view identity takes this derived value rather
 * than the raw ordinal. Two consumers today: `useBackToTopLadder`'s `view`, and
 * `useScrollDirection`'s `surface` -- the second looks like an over-reach and is
 * not, because a layout flip replaces the mounted list while the ordinal is
 * unchanged, so an ordinal-keyed surface performs no reset. A third caller that
 * passes only the ordinal would mean the single meeting point has quietly become
 * two vocabularies again.
 *
 * Its own module rather than a `const` inside the library screen only so the
 * fall-through below can be pinned by a test in the fast `helpers` lane --
 * importing the screen would drag FlashList through `jest-expo`'s transform
 * allowlist, which this effort has already tried and backed out of. Nothing but
 * the library screen imports it.
 *
 * ⚠ THE UNMAPPED VIEW MUST NOT LAND ON `booksHome`. That is the only
 * sectioned view (`SECTIONED_VIEWS`), so it is the only one that arms the
 * section rung and the collapse sweep -- and the ranges ref is never emptied on
 * a shelf change (§R5), so a view mapped there by accident would resolve
 * back against another list's indices and collapse the reader's expansions
 * while they are looking at something else. It would compile and it would be
 * silent. Two axes give the unrecognised case two ways to arrive rather than
 * one, which is the cost ADR 0006 names and accepts: the cascade below
 * therefore names `booksHome` EXPLICITLY and lets anything unrecognised degrade
 * to a two-rung view, where the worst case is a missing rung rather than a
 * destructive one.
 */
export const ladderViewFor = (
  shelf: number,
  layout: BooksLayout,
): LadderView =>
  shelf === 0
    ? 'booksHome'
    : shelf === 1
      ? 'seriesHome'
      : layout === 'list'
        ? 'booksList'
        : 'booksGrid';
