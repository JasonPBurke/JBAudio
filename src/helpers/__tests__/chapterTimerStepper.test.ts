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

describe('the two stepper surfaces agree', () => {
  // The player modal (SleepTimerOptions) and the settings card
  // (SleepTimerDurationCard) draw the same stepper and differ only in how they
  // deliver the result: the modal persists inline, the card calls back to the
  // screen that owns persistence. The press itself resolves here, so a press
  // at a bound cannot mean two different things. This table is that contract.
  //
  // Neither component can be rendered under jest — see trap 7 in
  // docs/testing/jest-projects-and-rn-tests.md — so the shared unit IS the
  // assertion, and both call sites are one line each around it.
  const maxChapters = 3;
  const counts = [0, 1, 2, 3];

  it.each(counts)('resolves + at %i the same way for both', (count) => {
    const next = stepChapterCount(count, 1, maxChapters);
    expect(next).toBe(Math.min(count + 1, maxChapters));
    expect(next === count).toBe(count === maxChapters);
  });

  it.each(counts)('resolves - at %i the same way for both', (count) => {
    const next = stepChapterCount(count, -1, maxChapters);
    expect(next).toBe(Math.max(count - 1, 0));
    expect(next === count).toBe(count === 0);
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

  it('heals a negative count persisted by the unclamped stepper', () => {
    expect(normalizeChapterCount(-1)).toBe(0);
    expect(normalizeChapterCount(-4)).toBe(0);
  });
});
