import { Book } from '@/types/Book';
import { BookProgressState } from '@/helpers/bookProgressState';
import { approximateLocationInBook } from '@/helpers/bookLocation';
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
 *
 * ⚠ BOTH INPUTS ARE CHAPTER POSITIONS, persisted or live — never a Player
 * Position. `current_chapter_progress` is seconds into the CHAPTER, and the
 * service writes the store the same way (`setPlaybackProgress` is fed
 * `chapter.positionSeconds` on a one-item Queue). That is why the reading
 * below is tagged `'chapter'`, and why this file used to add `startMs` back
 * by hand on one Queue shape and sum durations on the other.
 *
 * No Player read, directly or transitively: `BookDurationRow` calls this once
 * per visible library row and is deliberately unmemoized, so an async bridge
 * call here would be a scroll regression.
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

  // Started: prefer live overrides, fall back to persisted bookProgress.
  //
  // ⚠ THE BEST-EFFORT VARIANT, ASKED FOR BY NAME. A chapter whose duration
  // failed to extract (`scanLibrary`'s `makeErrorChapter` stores `0`) counts
  // as zero here, which reads the capsule a little LOW — cosmetic, and the
  // exact trade-off the spec's decision 3 names for this surface. The same
  // undercount in `evaluateBookEnd` marks a Book Finished hours early, which
  // is why that caller gets the exact function and this one has to say the
  // approximate name out loud.
  //
  // ⚠ The trailing `?? 0` is NOT the conversion ADR 0004 forbids — it stays
  // inside ONE coordinate. `current_chapter_progress` is a nullable column,
  // and a Book whose chapter index is known but whose progress was never
  // written is at the START of that chapter; treating it as the chapter start
  // is a floor, not a fabricated Book Position. Passing the `null` through
  // instead would make every such Book render as unmeasurable.
  const location = approximateLocationInBook(book.chapters, {
    from: 'chapter',
    chapterIndex:
      overrides?.liveIndex ?? book.bookProgress.currentChapterIndex,
    chapterPositionSeconds:
      overrides?.liveProgress ?? book.bookProgress.currentChapterProgress ?? 0,
  });

  // A Book we cannot place — the stored chapter index points at no row, where
  // the deleted arithmetic silently CLAMPED it to the last chapter and read
  // the Book as nearly finished. Showing the whole duration as remaining is
  // the honest floor: never blank, never NaN, and never a progress capsule
  // full of a position we did not measure.
  const totalPlayed = location?.bookPositionSeconds;
  if (totalPlayed == null) {
    return {
      progressFraction: 0,
      remainingText: totalDurationText,
      totalDurationText,
      progressState,
    };
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
