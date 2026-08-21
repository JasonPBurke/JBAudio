import type { SectionRange } from './ladderDecisions';

/**
 * The one thing FlashList's ref cannot answer, because answering it needs the
 * flat data array rather than the layout: which index span each section
 * occupies (spec §H4).
 *
 * Both consumers are pure index math -- the rung asks CONTAINMENT of the
 * viewport top, the sweep asks OVERLAP with the visible span -- so this
 * produces plain data and never touches a pixel.
 */

/**
 * The only field of a sectioned list's flat item this reads.
 *
 * Deliberately NOT the item's `type`. Finding section starts by matching a
 * `'sectionHeader'` type string would couple this module to a literal owned by
 * the list component, and a rename there would fail in this ticket's
 * characteristic way: zero ranges, no error, and a ladder that silently loses
 * its third rung. `sectionId` is the field both consumers already key on.
 */
export type SectionedItem = { readonly sectionId: string };

/**
 * Group a sectioned list's flat data into one range per section.
 *
 * ⚠ PRECONDITION: each section occupies ONE CONTIGUOUS RUN of the array whose
 * first item is that section's header. `BooksHome` builds `flatData` exactly
 * that way -- header, then either a horizontal row or N book cells, then the
 * next header -- and this is what makes a run's first index a header index,
 * which is the index the rung resolves a `y` from.
 *
 * The two properties the consumers depend on and the type cannot express (§H4,
 * amended 2026-08-21) both fall out of walking runs, and both are pinned by
 * tests on this function's real output:
 *
 *   1. `end` is INCLUSIVE -- the last item of the run, NOT the next section's
 *      `start`. The exclusive reading resolves a viewport top sitting on a
 *      section's last item to the PREVIOUS section, landing the rung on the
 *      wrong header while every obvious sanity check still passes.
 *   2. Ranges DO NOT OVERLAP, because runs are disjoint by construction. The
 *      rung uses a first-match containment lookup, so an index inside two
 *      ranges would resolve to an arbitrary one.
 */
export function computeSectionRanges(
  items: readonly SectionedItem[],
): SectionRange[] {
  const ranges: SectionRange[] = [];
  let start = 0;

  for (let i = 1; i <= items.length; i++) {
    // The run ends at the last index before the id changes, and the final run
    // ends at the last index of the array -- which is why the loop runs one
    // past the end rather than closing the last range after it.
    if (i < items.length && items[i].sectionId === items[start].sectionId) {
      continue;
    }
    // Pushed fully formed and never mutated afterwards: the React Compiler
    // rejects the mutate-the-last-entry shape this would otherwise take.
    ranges.push({ sectionId: items[start].sectionId, start, end: i - 1 });
    start = i;
  }

  return ranges;
}
