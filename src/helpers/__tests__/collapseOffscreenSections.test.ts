import { computeRemainingOpen } from '../collapseOffscreenSections';

/**
 * ⚠ The two `toBe(open)` cases below look like tautologies about `Set` and are
 * not. Same-reference is what the ladder's sweep tests to decide whether to arm
 * the MVCP anchor fix (`decision.open !== expanded`). A version of this function
 * that always returned a fresh set would arm that flag on every arrival where
 * nothing collapses, which is a real bug -- `useBackToTopLadder`'s sweep argues
 * why in full, and the helper's own docblock points there. Do not delete these
 * as obsolete "React bails out" cases: that is the cheaper half of what they
 * pin.
 */
describe('computeRemainingOpen', () => {
  it('drops open sections that are not visible', () => {
    const open = new Set(['A', 'B', 'C']);
    const result = computeRemainingOpen(open, new Set(['A']));
    expect([...result]).toEqual(['A']);
  });

  it('returns the same reference when nothing collapses', () => {
    const open = new Set(['A', 'B']);
    const result = computeRemainingOpen(open, new Set(['A', 'B']));
    expect(result).toBe(open);
  });

  it('returns the same reference when open is empty', () => {
    const open = new Set<string>();
    expect(computeRemainingOpen(open, new Set(['A']))).toBe(open);
  });

  it('retains the protected primary section even when off-screen', () => {
    const open = new Set(['A', 'B']);
    const result = computeRemainingOpen(open, new Set<string>(), 'A');
    expect([...result]).toEqual(['A']);
  });

  it('defaults primary to null so nothing is protected', () => {
    const open = new Set(['A']);
    const result = computeRemainingOpen(open, new Set<string>());
    expect([...result]).toEqual([]);
  });
});
