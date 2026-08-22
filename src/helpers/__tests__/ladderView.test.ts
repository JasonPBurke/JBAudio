import { ladderViewFor } from '../ladderView';

describe('ladderViewFor', () => {
  it('maps the three ordinals the toggle actually produces today', () => {
    expect(ladderViewFor(0)).toBe('booksHome');
    expect(ladderViewFor(1)).toBe('seriesHome');
    expect(ladderViewFor(2)).toBe('booksGrid');
  });

  /*
   * The reason the cascade is written the way it is. A fourth view -- §H7 calls
   * reviving `BooksList` a zero-diff change -- must not inherit `booksHome`'s
   * capabilities by falling through to it, because that is the ONE view that
   * arms the section rung and the collapse sweep against a ranges ref that
   * describes a different list (§R5).
   *
   * Written as "is not the sectioned view" rather than "is booksGrid": what
   * matters is the capability, not which of the two safe names it lands on, and
   * pinning the name would fail the day a fourth ordinal is mapped properly.
   */
  it('degrades an UNMAPPED ordinal away from the sectioned view', () => {
    for (const ordinal of [3, 4, 99, -1, NaN]) {
      expect(ladderViewFor(ordinal)).not.toBe('booksHome');
    }
  });
});
