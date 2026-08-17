import {
  FINISH_LEAD_SECONDS,
  evaluateBookEnd,
} from '@/helpers/bookEndDetection';
import { BookProgressState } from '@/helpers/bookProgressState';

/**
 * A one-item queue: shapes C, D and E from the ticket. `duration` is the
 * whole book and `position` is absolute, so the rule is a plain subtraction.
 */
const wholeBook = {
  position: 0,
  duration: 3600,
  queueShape: 'one-item' as const,
  progressState: BookProgressState.Started,
  alreadyMarked: false,
};

/**
 * Chapter rows as a MULTI-FILE book actually has them: `startMs` is 0 on
 * every row (scanLibrary.ts:520) and `chapterNumber` is the file's track tag,
 * which collapses to 1 on an untagged rip (`metadata.trackPosition || 1`).
 * Every row here carries those poisoned values on purpose — ordering may only
 * ever come from array position. See CORRECTION 3 in the ticket.
 */
const multiFileRows = (durations: number[]) =>
  durations.map((chapterDuration, i) => ({
    chapterDuration,
    startMs: 0,
    chapterNumber: 1,
    url: `file:///book/part-${i}.mp3`,
  }));

const multiItem = (durations: number[], currentIndex: number) => ({
  queueShape: 'multi-item' as const,
  queueChapters: multiFileRows(durations),
  currentIndex,
  currentTrackUrl: `file:///book/part-${currentIndex}.mp3`,
  duration: durations[currentIndex],
  position: 0,
  progressState: BookProgressState.Started,
  alreadyMarked: false,
});

describe('FINISH_LEAD_SECONDS', () => {
  it('is a positive number of seconds', () => {
    // Deliberately NOT pinned to its current value: the constant is a
    // listening judgement meant to be tuned, and a test asserting `=== 60`
    // would make tuning it require editing a test that proves no behaviour.
    // The window tests below pin the semantics.
    expect(FINISH_LEAD_SECONDS).toBeGreaterThan(0);
  });
});

describe('evaluateBookEnd — one-item queue', () => {
  it('marks once playback passes within the lead of the end', () => {
    expect(evaluateBookEnd({ ...wholeBook, position: 3541 })).toBe('mark');
  });

  it('does not mark before the window opens', () => {
    expect(evaluateBookEnd({ ...wholeBook, position: 3539 })).toBe('clear');
  });
});

describe('evaluateBookEnd — multi-item queue measures the whole book', () => {
  it('does not mark near the end of chapter 3 of 12', () => {
    // 10s left in this chapter, but nine 10-minute chapters follow it.
    const input = multiItem(Array(12).fill(600), 2);
    expect(evaluateBookEnd({ ...input, position: 590 })).toBe('clear');
  });

  it('marks 30s into a 60s second-to-last chapter with a 30s chapter after it', () => {
    // remaining = (60 - 30) + 30 = 60, exactly the lead.
    const input = multiItem([600, 600, 60, 30], 2);
    expect(evaluateBookEnd({ ...input, position: 30 })).toBe('mark');
    expect(evaluateBookEnd({ ...input, position: 29 })).toBe('clear');
  });

  it('marks a short final item from its first tick', () => {
    // A 45s credits track: nothing follows, so remaining is 45 at position 0.
    // There is no clamp — the lead is measured against the book, not the item.
    const input = multiItem([3600, 45], 1);
    expect(evaluateBookEnd({ ...input, position: 0 })).toBe('mark');
  });

  it('reduces to the plain check on the last item of the queue', () => {
    const input = multiItem([3600, 600], 1);
    expect(evaluateBookEnd({ ...input, position: 541 })).toBe('mark');
    expect(evaluateBookEnd({ ...input, position: 539 })).toBe('clear');
  });
});

describe('evaluateBookEnd — D5, marking once', () => {
  it('returns none while the latch is set', () => {
    expect(
      evaluateBookEnd({ ...wholeBook, position: 3550, alreadyMarked: true }),
    ).toBe('none');
  });

  it('returns none when the store already has the book Finished', () => {
    expect(
      evaluateBookEnd({
        ...wholeBook,
        position: 3550,
        progressState: BookProgressState.Finished,
      }),
    ).toBe('none');
  });

  it('clears the latch once playback leaves the window', () => {
    // §C5's restart: the book is played again from 0:00, so the latch must be
    // released or the second listen would never be marked.
    expect(
      evaluateBookEnd({ ...wholeBook, position: 10, alreadyMarked: true }),
    ).toBe('clear');
  });

  it('marks a restarted book that reaches the window a second time', () => {
    expect(
      evaluateBookEnd({
        ...wholeBook,
        position: 3550,
        progressState: BookProgressState.Started,
        alreadyMarked: false,
      }),
    ).toBe('mark');
  });
});

/**
 * The only production caller is untyped `service.js`, so `tsc` cannot check
 * what reaches this function and Babel strips the types without looking at
 * them. Every input has to be assumed missing.
 */
describe('evaluateBookEnd — undefined and unusable inputs', () => {
  it('does nothing when the position or duration is missing', () => {
    expect(
      evaluateBookEnd({ ...wholeBook, position: undefined }),
    ).toBe('none');
    expect(
      evaluateBookEnd({ ...wholeBook, position: 3550, duration: undefined }),
    ).toBe('none');
  });

  it('does nothing while the duration is still unknown', () => {
    // ExoPlayer reports 0 for the first ticks after a track loads.
    expect(
      evaluateBookEnd({ ...wholeBook, position: 0, duration: 0 }),
    ).toBe('none');
    expect(
      evaluateBookEnd({ ...wholeBook, position: 0, duration: NaN }),
    ).toBe('none');
    expect(
      evaluateBookEnd({ ...wholeBook, position: 0, duration: -1 }),
    ).toBe('none');
  });

  it('marks when the store holds no progress state for the book', () => {
    // `books[bookId]?.bookProgressValue` — the lookup misses before the store
    // has hydrated, and `undefined` genuinely reaches here.
    expect(
      evaluateBookEnd({
        ...wholeBook,
        position: 3550,
        progressState: undefined,
        alreadyMarked: undefined,
      }),
    ).toBe('mark');
  });

  it('marks a NotStarted book played straight through to its end', () => {
    expect(
      evaluateBookEnd({
        ...wholeBook,
        position: 3550,
        progressState: BookProgressState.NotStarted,
      }),
    ).toBe('mark');
  });

  it('never marks a multi-item queue whose chapters the store is missing', () => {
    // The dangerous case: without the explicit queueShape, an absent array
    // would read as "one item spanning the book" and mark this book at the
    // end of EVERY track.
    const input = multiItem([600, 600, 600], 0);
    expect(
      evaluateBookEnd({
        ...input,
        position: 599,
        queueChapters: undefined,
      }),
    ).toBe('none');
    expect(
      evaluateBookEnd({ ...input, position: 599, queueChapters: [] }),
    ).toBe('none');
  });

  it('never marks when the index falls outside the chapter array', () => {
    // A rescan mid-playback can leave the store holding fewer rows than the
    // queue has items.
    const input = multiItem([600, 600, 600], 2);
    expect(
      evaluateBookEnd({ ...input, position: 599, currentIndex: 3 }),
    ).toBe('none');
    expect(
      evaluateBookEnd({ ...input, position: 599, currentIndex: -1 }),
    ).toBe('none');
    expect(
      evaluateBookEnd({ ...input, position: 599, currentIndex: undefined }),
    ).toBe('none');
  });

  it('never marks when a chapter row carries no usable duration', () => {
    // scanLibrary's makeErrorChapter stores `duration: 0` for a file whose
    // metadata extraction failed, and the single-chapter path falls back to 0
    // whenever the duration tag is missing. Counting such a row as 0 seconds
    // would drop it out of the "still to come" sum: on a 20-file book with
    // files 6-20 unreadable, the sum is empty and the book gets marked
    // Finished at the end of chapter 5, hours early. There is no cheap way
    // back from that — nothing moves a book off Finished except a play press,
    // and that RESTARTS it from 0:00 rather than resuming.
    const input = multiItem([600, 600, 600, 600], 1);
    const rows = [...input.queueChapters];
    rows[3] = { ...rows[3], chapterDuration: 0 };
    expect(
      evaluateBookEnd({ ...input, position: 599, queueChapters: rows }),
    ).toBe('none');
  });

  it('never marks a one-item queue that is playing a later index', () => {
    // A one-item queue can only ever tick at index 0. Any other index means
    // the caller's claim about the queue shape is contradicted by the payload
    // it came with — which is reachable, because the caller re-derives the
    // shape from the store's CURRENT chapter rows while the queue was built
    // from an earlier snapshot, and the clipped-chapters gate can flip
    // between the two. Believing the claim would read a chapter-relative
    // `duration` as the whole book's.
    expect(
      evaluateBookEnd({ ...wholeBook, position: 3550, currentIndex: 2 }),
    ).toBe('none');
    expect(
      evaluateBookEnd({ ...wholeBook, position: 3550, currentIndex: 0 }),
    ).toBe('mark');
  });

  it('never marks a book whose whole runtime is inside the lead', () => {
    // A stray intro file scanned as its own book. Without this the book is
    // Finished from its first tick and can never be seen as Started: a play
    // press demotes it and the next tick promotes it straight back, two
    // full-library writes per press. The lead-time rule is about the credits
    // at the end of a real book; a book shorter than the credits is left to
    // the true-end path exactly as before this ticket.
    expect(
      evaluateBookEnd({ ...wholeBook, duration: 45, position: 0 }),
    ).toBe('none');
    expect(
      evaluateBookEnd({ ...wholeBook, duration: 45, position: 44 }),
    ).toBe('none');
    // One second over the lead, the rule applies again.
    expect(
      evaluateBookEnd({ ...wholeBook, duration: 61, position: 1 }),
    ).toBe('mark');
  });

  it('marks a clipped single-file book, whose items all share one url', () => {
    // Shape B: N queue items, all pointing at the same file with different
    // clip windows. The url check must be inert here, not fatal.
    const clipped = {
      queueShape: 'multi-item' as const,
      queueChapters: [600, 600, 45].map(() => ({
        chapterDuration: 600,
        startMs: 0,
        chapterNumber: 1,
        url: 'file:///book/whole.m4b',
      })),
      currentIndex: 2,
      currentTrackUrl: 'file:///book/whole.m4b',
      duration: 600,
      position: 550,
      progressState: BookProgressState.Started,
      alreadyMarked: false,
    };
    expect(evaluateBookEnd(clipped)).toBe('mark');
  });

  it('fails closed when the caller omits the queue shape', () => {
    const input = multiItem([600, 600], 1);
    expect(
      evaluateBookEnd({
        ...input,
        position: 599,
        // Untyped JS can leave this out; it must not be read as 'one-item'.
        queueShape: undefined as unknown as 'multi-item',
        queueChapters: undefined,
      }),
    ).toBe('none');
  });
});

/**
 * CORRECTION 3's undefended assumption. The tick handler reads the STORE's
 * chapter array but indexes it with the QUEUE's track index, and on the cold
 * -start restore path the queue was built from a different producer
 * (`getBookWithChaptersForRestoration`). Neither query is sorted, so nothing
 * enforces that the two agree. A misordered multi-file array has no other
 * consumer, so this sum would be its first and only detector.
 */
describe('evaluateBookEnd — the queue and the store must agree', () => {
  const threeFiles = multiItem([600, 600, 600], 2);

  it('marks when the playing url sits at the index it was indexed by', () => {
    expect(evaluateBookEnd({ ...threeFiles, position: 550 })).toBe('mark');
  });

  it('never marks when the playing url sits at a DIFFERENT index', () => {
    // The store's array and the queue disagree: the player is really on
    // part-0 while the payload's index points at part-2.
    expect(
      evaluateBookEnd({
        ...threeFiles,
        position: 550,
        currentTrackUrl: 'file:///book/part-0.mp3',
      }),
    ).toBe('none');
  });

  it('proceeds when the playing url is nowhere in the array', () => {
    // The player may hand back a url it has normalised, which says nothing
    // about ordering. Being unable to check is not evidence of disagreement,
    // and this is the assumption the ticket says to take explicitly.
    expect(
      evaluateBookEnd({
        ...threeFiles,
        position: 550,
        currentTrackUrl: 'content://media/external/audio/9182',
      }),
    ).toBe('mark');
    expect(
      evaluateBookEnd({
        ...threeFiles,
        position: 550,
        currentTrackUrl: undefined,
      }),
    ).toBe('mark');
  });
});
