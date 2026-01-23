import { Chapter } from '@/types/Book';

/**
 * Determines if a book is a single-file book (one audio file with multiple chapters).
 * Single-file books have all chapters pointing to the same URL.
 */
export function isSingleFileBook(chapters: Chapter[] | undefined): boolean {
  if (!chapters || chapters.length <= 1) return false;
  return chapters.every((c) => c.url === chapters[0].url);
}

/**
 * Finds the chapter index based on the current playback position (in seconds).
 * Returns the index of the chapter whose startMs is <= the current position.
 * Returns 0 if no chapter is found.
 */
export function findChapterIndexByPosition(
  chapters: Chapter[],
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
 * Gets the end position (in seconds) of a chapter.
 * For the last chapter, returns the book duration.
 * For other chapters, returns the start of the next chapter.
 */
export function getChapterEndPosition(
  chapters: Chapter[],
  chapterIndex: number,
  bookDurationSeconds: number
): number {
  if (!chapters || chapters.length === 0) return bookDurationSeconds;

  const clampedIndex = Math.min(chapterIndex, chapters.length - 1);

  if (clampedIndex >= chapters.length - 1) {
    // Last chapter - end is book duration
    return bookDurationSeconds;
  }

  // End is start of next chapter
  return (chapters[clampedIndex + 1].startMs || 0) / 1000;
}

/**
 * Determines if a book has valid chapter timing data.
 * Returns true if the book has multiple chapters with at least one having a non-zero startMs.
 * Used to decide whether to show chapter-level metadata on lock screen.
 */
export function hasValidChapterData(chapters: Chapter[] | undefined): boolean {
  if (!chapters || chapters.length <= 1) return false;
  return chapters.some((c) => (c.startMs || 0) > 0);
}
