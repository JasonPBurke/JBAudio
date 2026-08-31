import {
  chapterStepperView,
  stepChapterCount,
} from '../chapterTimerStepper';

// The two surfaces that draw this stepper cannot be rendered under jest (trap 7
// in docs/testing/jest-projects-and-rn-tests.md), so the derivation IS the test
// and the call sites are one line around it. See
// `.scratch/sleep-timer-stepper/issues/04-displayed-chapter-count-outlives-the-book.md`.

describe('chapterStepperView — a known ceiling', () => {
  it('shows a count below the ceiling verbatim', () => {
    const view = chapterStepperView(2, 5);
    expect(view.count).toBe(2);
    expect(view.label).toBe('End of 3 Chapters');
    expect(view.canStepUp).toBe(true);
    expect(view.canStepDown).toBe(true);
  });

  it('shows a count equal to the ceiling as the end of the book', () => {
    const view = chapterStepperView(5, 5);
    expect(view.count).toBe(5);
    expect(view.label).toBe('End of Book');
    expect(view.canStepUp).toBe(false);
    expect(view.canStepDown).toBe(true);
  });

  it('bounds a count the playhead has outgrown, without rewriting it', () => {
    // The defect this ticket exists for: a configured-but-unarmed count of 5
    // against a book with two chapters left rendered "End of 6 Chapters".
    const view = chapterStepperView(5, 2);
    expect(view.count).toBe(2);
    expect(view.label).toBe('End of Book');
    expect(view.canStepUp).toBe(false);
    expect(view.canStepDown).toBe(true);
  });

  it('steps down by one from a bounded count, not to zero', () => {
    // The acceptance criterion `02`'s ruling made non-obvious: the clamp
    // happens in the derivation now, so the count reaching stepChapterCount is
    // already in range and one `−` press means one step.
    const view = chapterStepperView(5, 2);
    expect(stepChapterCount(view.count, -1, 2)).toBe(1);
  });

  it('reads a ceiling of zero as the end of the current chapter', () => {
    const view = chapterStepperView(0, 0);
    expect(view.count).toBe(0);
    expect(view.label).toBe('End of Chapter');
    expect(view.canStepUp).toBe(false);
    expect(view.canStepDown).toBe(false);
  });

  it('pins a stale count to a ceiling of zero, both presses dead', () => {
    const view = chapterStepperView(4, 0);
    expect(view.count).toBe(0);
    expect(view.label).toBe('End of Chapter');
    expect(view.canStepUp).toBe(false);
    expect(view.canStepDown).toBe(false);
  });

  it('shows a count of zero below a ceiling as the end of the chapter', () => {
    const view = chapterStepperView(0, 3);
    expect(view.label).toBe('End of Chapter');
    expect(view.canStepUp).toBe(true);
    expect(view.canStepDown).toBe(false);
  });
});

describe('chapterStepperView — an unknown ceiling', () => {
  // `null` is the ceiling that has not arrived (the Player reads are async) or
  // cannot be known (they threw). Clamping against a placeholder is what would
  // flatten a real count to "End of Chapter" for the width of that window.
  it('shows the stored count unclamped', () => {
    const view = chapterStepperView(3, null);
    expect(view.count).toBe(3);
    expect(view.label).toBe('End of 4 Chapters');
  });

  it('never claims the end of the book, which it cannot know', () => {
    expect(chapterStepperView(0, null).label).toBe('End of Chapter');
    expect(chapterStepperView(9, null).label).toBe('End of 10 Chapters');
  });

  it('makes both presses no-ops so nothing is persisted against a guess', () => {
    const view = chapterStepperView(3, null);
    expect(view.canStepUp).toBe(false);
    expect(view.canStepDown).toBe(false);
  });
});

describe('chapterStepperView — nothing truthful to say yet', () => {
  // Only the player modal passes a null count, and it passes it until both of
  // its reads have landed. An empty label is what keeps the row from
  // asserting "End of Chapter" — or a count the ceiling is about to bound —
  // and then correcting itself.
  it('says nothing and does nothing', () => {
    const view = chapterStepperView(null, 4);
    expect(view.count).toBe(0);
    expect(view.label).toBe('');
    expect(view.canStepUp).toBe(false);
    expect(view.canStepDown).toBe(false);
  });

  it('says nothing when neither the count nor the ceiling is known', () => {
    expect(chapterStepperView(null, null).label).toBe('');
  });
});

describe('chapterStepperView — counts that should never arrive', () => {
  // normalizeChapterCount heals a negative count to null at every DB boundary,
  // so these are belt and braces: the derivation must not render a negative
  // chapter count if one reaches it anyway.
  it('floors a negative count at zero', () => {
    expect(chapterStepperView(-1, 5).count).toBe(0);
    expect(chapterStepperView(-1, 5).label).toBe('End of Chapter');
    expect(chapterStepperView(-1, null).count).toBe(0);
  });

  it('treats a negative ceiling as zero, as stepChapterCount does', () => {
    const view = chapterStepperView(2, -1);
    expect(view.count).toBe(0);
    expect(view.canStepUp).toBe(false);
  });
});
