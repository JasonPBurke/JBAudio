import { Book } from '@/types/Book';
import { BookProgressState } from '@/helpers/handleBookPlay';
import { formatSecondsToHoursMinutes } from '@/helpers/miscellaneous';

export type BookProgressInfo = {
  progressFraction: number;
  remainingText: string;
  totalDurationText: string;
  progressState: BookProgressState;
};

type LiveOverrides = {
  liveProgress?: number;
  liveIndex?: number;
};

/**
 * Computes book progress from the Book object.
 *
 * The store's `books[id].bookProgress` is only refreshed when the WatermelonDB
 * observer fires (which does NOT watch `current_chapter_progress`).
 * To get up-to-date values, callers can pass `liveProgress` / `liveIndex`
 * from `playbackProgress[bookId]` / `playbackIndex[bookId]` in the store,
 * which the playback service updates in real-time.
 */
export function computeBookProgress(
  book: Book,
  overrides?: LiveOverrides,
): BookProgressInfo {
  const progressState = book.bookProgressValue as BookProgressState;
  const totalDurationText = formatSecondsToHoursMinutes(book.bookDuration || 0);

  if (
    progressState === BookProgressState.NotStarted ||
    !book.chapters ||
    book.chapters.length === 0
  ) {
    return {
      progressFraction: 0,
      remainingText: totalDurationText,
      totalDurationText,
      progressState,
    };
  }

  if (progressState === BookProgressState.Finished) {
    return {
      progressFraction: 1,
      remainingText: '0m',
      totalDurationText,
      progressState,
    };
  }

  // Started: prefer live overrides, fall back to persisted bookProgress
  const chapterProgress =
    overrides?.liveProgress ?? book.bookProgress.currentChapterProgress ?? 0;
  const chapterIndex =
    overrides?.liveIndex ?? book.bookProgress.currentChapterIndex;
  const chapters = book.chapters;
  const idx = Math.max(0, Math.min(chapterIndex, chapters.length - 1));

  let totalPlayed: number;

  if (book.isSingleFile) {
    // Single-file books: chapterProgress is the absolute position
    totalPlayed = chapterProgress;
  } else {
    // Multi-file books: sum previous chapters + current chapter progress
    totalPlayed = chapterProgress;
    for (let i = 0; i < idx; i++) {
      totalPlayed += chapters[i]?.chapterDuration ?? 0;
    }
  }

  const duration = book.bookDuration || 0;
  const remaining = Math.max(0, duration - totalPlayed);
  const progressFraction =
    duration > 0 ? Math.min(1, Math.max(0, totalPlayed / duration)) : 0;

  return {
    progressFraction,
    remainingText: formatSecondsToHoursMinutes(remaining),
    totalDurationText,
    progressState,
  };
}
