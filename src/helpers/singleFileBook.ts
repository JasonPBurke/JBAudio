import { Chapter } from '@/types/Book';

/**
 * Finds the chapter index based on the current playback position (in seconds).
 * Returns the index of the chapter whose startMs is <= the current position.
 * Returns 0 if no chapter is found.
 */
export function findChapterIndexByPosition(
  chapters: readonly Pick<Chapter, 'startMs'>[],
  positionSeconds: number
): number {
  if (!chapters || chapters.length === 0) return 0;

  const positionMs = positionSeconds * 1000;

  // Find the last chapter that starts at or before the current position
  for (let i = chapters.length - 1; i >= 0; i--) {
    if ((chapters[i].startMs || 0) <= positionMs) {
      return i;
    }
  }

  return 0;
}

/**
 * Calculates the absolute position (in seconds) from a chapter index and progress within that chapter.
 * Used for single-file books to restore position.
 */
export function calculateAbsolutePosition(
  chapters: Chapter[],
  chapterIndex: number,
  progressSeconds: number
): number {
  if (!chapters || chapters.length === 0 || chapterIndex < 0) {
    return progressSeconds;
  }

  const clampedIndex = Math.min(chapterIndex, chapters.length - 1);
  const chapterStartSeconds = (chapters[clampedIndex].startMs || 0) / 1000;

  return chapterStartSeconds + progressSeconds;
}

/**
 * Calculates the progress within the current chapter (in seconds) from an absolute position.
 * Used for single-file books to save progress relative to chapter start.
 */
export function calculateProgressWithinChapter(
  chapters: Chapter[],
  positionSeconds: number
): number {
  if (!chapters || chapters.length === 0) return positionSeconds;

  const chapterIndex = findChapterIndexByPosition(chapters, positionSeconds);
  const chapterStartSeconds = (chapters[chapterIndex].startMs || 0) / 1000;

  return Math.max(0, positionSeconds - chapterStartSeconds);
}

/**
 * Determines if a book has valid chapter timing data.
 * Returns true if the book has multiple chapters with at least one having a non-zero startMs.
 * Used to decide whether to show chapter-level metadata on lock screen.
 */
export function hasValidChapterData(
  chapters: readonly Pick<Chapter, 'startMs'>[] | undefined,
): boolean {
  if (!chapters || chapters.length <= 1) return false;
  return chapters.some((c) => (c.startMs || 0) > 0);
}
