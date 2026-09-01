import { computeBookProgress } from '../bookProgressUtils';
import { BookProgressState } from '@/helpers/bookProgressState';
import type { Book, Chapter } from '@/types/Book';
import {
  multiItemChapters,
  oneItemChapters,
} from './support/queueShapeFixtures';

jest.mock('@/constants/images', () => ({
  unknownBookImageUri: 'file:///fallback.png',
}));

jest.mock('@/constants/featureFlags', () => ({
  CLIPPED_CHAPTERS_SPIKE: true,
}));

const makeBook = (
  chapters: readonly unknown[],
  {
    bookDuration = 1800,
    currentChapterIndex = 0,
    currentChapterProgress = 0,
    bookProgressValue = BookProgressState.Started,
  }: Partial<{
    bookDuration: number;
    currentChapterIndex: number;
    currentChapterProgress: number | null;
    bookProgressValue: BookProgressState;
  }> = {},
): Book =>
  ({
    bookId: 'b1',
    chapters: chapters as Chapter[],
    bookDuration,
    bookProgress: { currentChapterIndex, currentChapterProgress },
    bookProgressValue,
  }) as unknown as Book;

describe('computeBookProgress — the two coordinates', () => {
  it('adds the chapter start on a one-item Queue', () => {
    // Three 600s chapters at 0 / 600s / 1200s, 30s into the third.
    const book = makeBook(oneItemChapters([0, 600_000, 1_200_000]), {
      currentChapterIndex: 2,
      currentChapterProgress: 30,
    });

    const progress = computeBookProgress(book);

    // 1200 + 30 played of 1800 → 570 remaining
    expect(progress.progressFraction).toBeCloseTo(1230 / 1800);
    expect(progress.remainingText).toBe('09m');
  });

  it('sums the preceding chapter durations on a multi-item Queue', () => {
    const book = makeBook(multiItemChapters(3), {
      currentChapterIndex: 2,
      currentChapterProgress: 30,
    });

    const progress = computeBookProgress(book);

    expect(progress.progressFraction).toBeCloseTo(1230 / 1800);
  });

  it('prefers the live overrides over the persisted progress', () => {
    const book = makeBook(multiItemChapters(3), {
      currentChapterIndex: 0,
      currentChapterProgress: 0,
    });

    const progress = computeBookProgress(book, {
      liveIndex: 1,
      liveProgress: 60,
    });

    expect(progress.progressFraction).toBeCloseTo(660 / 1800);
  });
});

describe('computeBookProgress — a Book it cannot measure exactly', () => {
  it('counts an unusable chapter duration as zero rather than blanking', () => {
    const chapters = multiItemChapters(3).map((chapter, index) =>
      index === 0 ? { ...chapter, chapterDuration: 0 } : chapter,
    );
    const book = makeBook(chapters, {
      currentChapterIndex: 2,
      currentChapterProgress: 30,
    });

    const progress = computeBookProgress(book);

    // The unreadable first chapter counts as zero: 600 + 30 of 1800.
    expect(progress.progressFraction).toBeCloseTo(630 / 1800);
    expect(progress.remainingText).not.toMatch(/NaN/);
    expect(progress.remainingText).toBeTruthy();
  });

  it('falls back to the whole Book when the chapter index points at no row', () => {
    const book = makeBook(multiItemChapters(3), {
      currentChapterIndex: 7,
      currentChapterProgress: 30,
    });

    const progress = computeBookProgress(book);

    expect(progress.progressFraction).toBe(0);
    expect(progress.remainingText).toBe(progress.totalDurationText);
    expect(progress.remainingText).not.toMatch(/NaN/);
  });

  it('treats a null persisted chapter progress as the chapter start', () => {
    const book = makeBook(multiItemChapters(3), {
      currentChapterIndex: 1,
      currentChapterProgress: null,
    });

    const progress = computeBookProgress(book);

    expect(progress.progressFraction).toBeCloseTo(600 / 1800);
  });
});

describe('computeBookProgress — the states that never measure', () => {
  it('reports a Not Started Book as the whole duration', () => {
    const book = makeBook(multiItemChapters(3), {
      bookProgressValue: BookProgressState.NotStarted,
      currentChapterIndex: 2,
      currentChapterProgress: 30,
    });

    const progress = computeBookProgress(book);

    expect(progress.progressFraction).toBe(0);
    expect(progress.remainingText).toBe(progress.totalDurationText);
  });

  it('reports a Finished Book as complete', () => {
    const book = makeBook(multiItemChapters(3), {
      bookProgressValue: BookProgressState.Finished,
    });

    const progress = computeBookProgress(book);

    expect(progress.progressFraction).toBe(1);
    expect(progress.remainingText).toBe('0m');
  });

  it('reports a Book with no chapters as the whole duration', () => {
    const book = makeBook([]);

    const progress = computeBookProgress(book);

    expect(progress.progressFraction).toBe(0);
    expect(progress.remainingText).toBe(progress.totalDurationText);
  });
});
