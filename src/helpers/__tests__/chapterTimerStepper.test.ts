import {
  normalizeChapterCount,
  stepChapterCount,
} from '../chapterTimerStepper';

describe('stepChapterCount', () => {
  it('increments below the ceiling', () => {
    expect(stepChapterCount(0, 1, 5)).toBe(1);
    expect(stepChapterCount(4, 1, 5)).toBe(5);
  });

  it('decrements above zero', () => {
    expect(stepChapterCount(5, -1, 5)).toBe(4);
    expect(stepChapterCount(1, -1, 5)).toBe(0);
  });

  it('is a no-op at the ceiling', () => {
    expect(stepChapterCount(5, 1, 5)).toBe(5);
  });

  it('is a no-op at zero', () => {
    expect(stepChapterCount(0, -1, 5)).toBe(0);
  });

  it('pins every press at zero when no chapters remain', () => {
    expect(stepChapterCount(0, 1, 0)).toBe(0);
    expect(stepChapterCount(0, -1, 0)).toBe(0);
  });

  it('treats a negative ceiling as zero', () => {
    expect(stepChapterCount(0, 1, -1)).toBe(0);
  });

  it('steps an already out-of-range count back into range', () => {
    // A device that ran the unclamped modal can hold -1 or a count past the
    // end of the book; the next press heals it rather than compounding it.
    expect(stepChapterCount(-1, 1, 5)).toBe(0);
    expect(stepChapterCount(-1, -1, 5)).toBe(0);
    expect(stepChapterCount(9, 1, 5)).toBe(5);
    expect(stepChapterCount(9, -1, 5)).toBe(5);
  });
});

describe('the no-op contract both press sites are built on', () => {
  // The player modal (SleepTimerOptions) and the settings card
  // (SleepTimerDurationCard) draw the same stepper and differ only in how they
  // deliver the result: the modal persists inline, the card calls back to the
  // screen that owns persistence. Both write ONLY when the returned count
  // differs from the one they passed in, so "a press at a bound writes
  // nothing" reduces to this identity — which is the contract, and is asserted
  // here without restating the arithmetic the function itself computes.
  //
  // Neither component can be rendered under jest — see trap 7 in
  // docs/testing/jest-projects-and-rn-tests.md — so the shared unit IS the
  // assertion, and both call sites are one line around it.
  const maxChapters = 3;
  const isNoOp = (count: number, delta: number) =>
    stepChapterCount(count, delta, maxChapters) === count;

  it.each([0, 1, 2, 3])('a + press at %i is a no-op only at the top', (n) => {
    expect(isNoOp(n, 1)).toBe(n === maxChapters);
  });

  it.each([0, 1, 2, 3])('a - press at %i is a no-op only at zero', (n) => {
    expect(isNoOp(n, -1)).toBe(n === 0);
  });

  it('never returns a count outside the range, from any starting point', () => {
    for (const count of [-2, -1, 0, 1, 2, 3, 4, 9]) {
      for (const delta of [-1, 1]) {
        const next = stepChapterCount(count, delta, maxChapters);
        expect(next).toBeGreaterThanOrEqual(0);
        expect(next).toBeLessThanOrEqual(maxChapters);
      }
    }
  });
});

describe('normalizeChapterCount', () => {
  it('leaves an unarmed chapter timer alone', () => {
    expect(normalizeChapterCount(null)).toBeNull();
  });

  it('passes through an in-range count', () => {
    expect(normalizeChapterCount(0)).toBe(0);
    expect(normalizeChapterCount(7)).toBe(7);
  });

  // Healed to null (the timer's "off" value), NOT to 0. A negative count is
  // the fingerprint of a press that should have been a no-op, and the row held
  // null before it. Healing to 0 would leave setup/sleepTimer.ts arming
  // bedtime mode (it arms on `!== null`) and firing at the next chapter
  // boundary (it fires when the count is not `> 0`) — i.e. every affected
  // device behaving exactly as the corruption made it behave.
  it('heals a negative count to off, not to zero', () => {
    expect(normalizeChapterCount(-1)).toBeNull();
    expect(normalizeChapterCount(-4)).toBeNull();
  });
});

describe('the shrinking-ceiling ruling, pinned', () => {
  // Characterization, not a new rule. Issue `02` argued that a `−` press on a
  // count the book had outgrown should step down by one; the ruling was that
  // clamping to the ceiling is correct in BOTH directions, because the nearest
  // reachable value is the only honest answer to "an end the book can no
  // longer offer". Issue `04` then changed what is HANDED to this function —
  // `chapterStepperView` bounds the count first, so a stale count no longer
  // reaches here from either surface — and this test exists so that change
  // cannot quietly turn into a change of the ruling itself.
  it('clamps a `-` press from above the ceiling rather than stepping', () => {
    expect(stepChapterCount(6, -1, 2)).toBe(2);
    expect(stepChapterCount(6, 1, 2)).toBe(2);
  });

  it('clamps to zero when the book has no boundary left', () => {
    expect(stepChapterCount(6, -1, 0)).toBe(0);
  });
});
