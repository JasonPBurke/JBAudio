import { decideBackPress } from '../ladderDecisions';
import { computeSectionRanges } from '../sectionRanges';
import { book, header, row } from './support/sectionedItems';


describe('computeSectionRanges — `end` is INCLUSIVE', () => {
  it('ends a section on its LAST ITEM, never on the next section`s header', () => {
    const items = [
      header('recentlyAdded'), // 0
      row('recentlyAdded'), // 1
      header('author-A'), // 2
      book('author-A', 'a1'), // 3
      book('author-A', 'a2'), // 4
      header('author-B'), // 5
      row('author-B'), // 6
    ];

    expect(computeSectionRanges(items)).toEqual([
      { sectionId: 'recentlyAdded', start: 0, end: 1 },
      { sectionId: 'author-A', start: 2, end: 4 },
      { sectionId: 'author-B', start: 5, end: 6 },
    ]);
  });
});

describe('computeSectionRanges — ranges do not overlap', () => {
  /**
   * Asserted as a PROPERTY over produced output rather than as an expected
   * literal, because the failure this guards against is a producer that is
   * right on a three-section fixture and wrong at scale. The shape is the real
   * one: a recents section, then authors of differing sizes, expanded and
   * collapsed mixed.
   */
  const library = [
    header('recentlyAdded'),
    ...Array.from({ length: 25 }, (_, i) => book('recentlyAdded', `r${i}`)),
    ...Array.from({ length: 40 }, (_, a) =>
      a % 3 === 0
        ? [
            header(`author-${a}`),
            ...Array.from({ length: a }, (_, b) =>
              book(`author-${a}`, `b${a}-${b}`),
            ),
          ]
        : [header(`author-${a}`), row(`author-${a}`)],
    ).flat(),
  ];

  it('assigns every index to exactly one range', () => {
    const ranges = computeSectionRanges(library);

    const owners = library.map(
      (_, index) =>
        ranges.filter((r) => r.start <= index && index <= r.end).length,
    );

    expect(owners.every((count) => count === 1)).toBe(true);
  });

  it('ends the last range on the last index, leaving no tail unowned', () => {
    const ranges = computeSectionRanges(library);

    expect(ranges.at(-1)!.end).toBe(library.length - 1);
  });

  it('produces one range per section', () => {
    const ranges = computeSectionRanges(library);

    expect(ranges).toHaveLength(41);
    expect(new Set(ranges.map((r) => r.sectionId)).size).toBe(41);
  });
});

describe('computeSectionRanges — degenerate inputs', () => {
  it('produces nothing for an empty list', () => {
    // The empty tab and the no-results search. `decideSweep` treats an empty
    // range list as a no-op rather than as "nothing is visible, collapse
    // everything" (§F8), so this is a safe value to publish.
    expect(computeSectionRanges([])).toEqual([]);
  });

  it('produces one whole-array range for a single section', () => {
    expect(
      computeSectionRanges([header('only'), book('only', 'b1')]),
    ).toEqual([{ sectionId: 'only', start: 0, end: 1 }]);
  });
});

/**
 * The contract, closed end to end.
 *
 * `ladderDecisions.test.ts` pins the containment bounds against HAND-WRITTEN
 * ranges, which cannot catch a producer that emits an exclusive `end` -- the
 * decision would still be right and the rung would still land on the previous
 * section's header. These tests run the same boundary through the real
 * producer, so the two halves are pinned against each other rather than each
 * against a fixture.
 */
describe('computeSectionRanges — the rung reads the produced ranges correctly', () => {
  const items = [
    header('recentlyAdded'), // 0
    row('recentlyAdded'), // 1
    header('author-A'), // 2
    ...Array.from({ length: 8 }, (_, i) => book('author-A', `a${i}`)), // 3..10
    header('author-B'), // 11
    row('author-B'), // 12
  ];
  const ranges = computeSectionRanges(items);

  /** A plausible layout: headers at 400 px intervals, books at 200 px. */
  const layoutY = (index: number) => index * 200;

  const pressFrom = (startIndex: number) =>
    decideBackPress({
      view: 'booksHome',
      drawerOpen: false,
      offset: layoutY(startIndex),
      firstItemOffset: 38,
      expanded: new Set(['author-A']),
      ranges,
      visible: () => ({ startIndex, endIndex: startIndex + 3 }),
      layoutY,
    });

  it('lands a viewport top on the LAST item of a section on THAT section`s header', () => {
    // ⚠ The trap. With an exclusive `end` (11 rather than 10) index 10 falls
    // outside author-A and inside nothing, and the press silently becomes a
    // master-top press -- or worse, with a differently wrong producer, lands on
    // the section above.
    expect(pressFrom(10)).toEqual({
      kind: 'scrollTo',
      offset: layoutY(2),
      rung: 'section',
    });
  });

  it('lands the FIRST item below a header on that header, not the one above', () => {
    // The containment lookup's other bound: index 3 is author-A's first book,
    // one index past the header. An off-by-one at the `start` bound resolves it
    // to `recentlyAdded` and lands the press at the top of the wrong section.
    expect(pressFrom(3)).toEqual({
      kind: 'scrollTo',
      offset: layoutY(2),
      rung: 'section',
    });
  });

  it('goes to master top when the section`s own header is already on screen', () => {
    // Story 10, and the reason the rung is decided by OFFSET rather than by
    // index alone: at a viewport top of exactly the header's `y` the rung would
    // scroll by zero. A press must never produce an invisible result.
    expect(pressFrom(2)).toEqual({
      kind: 'scrollTo',
      offset: 0,
      rung: 'master',
    });
  });

  it('falls through to master top from inside a COLLAPSED section', () => {
    // Story 9: index 12 is inside author-B, which is not expanded. A rung
    // there would move the viewport by a screenful for no visible reason.
    expect(pressFrom(12)).toEqual({
      kind: 'scrollTo',
      offset: 0,
      rung: 'master',
    });
  });
});
