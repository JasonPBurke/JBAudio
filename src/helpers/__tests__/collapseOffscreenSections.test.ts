import { computeRemainingOpen } from '../collapseOffscreenSections';

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
