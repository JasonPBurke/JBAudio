import { Chapter } from '@/types/Book';

/**
 * Determines if a book is a single-file book (one audio file with multiple chapters).
 * Single-file books have all chapters pointing to the same URL.
 * Accepts any chapter-shaped rows (e.g. DB projections) that carry `url`.
 */
export function isSingleFileBook(
  chapters: readonly Pick<Chapter, 'url'>[] | undefined,
): boolean {
  if (!chapters || chapters.length <= 1) return false;
  return chapters.every((c) => c.url === chapters[0].url);
}

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
 * Returns the start position (in seconds) of the next chapter, or null if at the last chapter.
 * Used by both in-app and lock screen skip-next buttons for single-file books.
 */
export function getNextChapterStartSeconds(
  chapters: Chapter[],
  positionSeconds: number,
): number | null {
  if (!chapters || chapters.length <= 1) return null;

  const currentIndex = findChapterIndexByPosition(chapters, positionSeconds);
  if (currentIndex < chapters.length - 1) {
    return (chapters[currentIndex + 1].startMs || 0) / 1000;
  }
  return null;
}

export type PreviousPressKind = 'restart' | 'previous';

export type PreviousPressTarget = {
  targetSeconds: number;
  kind: PreviousPressKind;
};

/**
 * Seek target (in seconds) for a skip-to-previous press in a single-file book.
 * More than `thresholdSeconds` into the current chapter restarts that chapter
 * (kind 'restart'); at or under the threshold it goes to the previous
 * chapter's start (kind 'previous'; book start when already in the first
 * chapter). The kind drives footprint labeling ('Chapter restart' vs
 * 'Chapter changed').
 * Shared by the RemotePrevious handler and the in-app skip-previous button
 * via skipToPreviousChapter() in chapterSkip.ts.
 */
export function getPreviousPressTarget(
  chapters: readonly Pick<Chapter, 'startMs'>[],
  positionSeconds: number,
  thresholdSeconds: number,
): PreviousPressTarget {
  if (!chapters || chapters.length <= 1) {
    return { targetSeconds: 0, kind: 'restart' };
  }

  const currentIndex = findChapterIndexByPosition(chapters, positionSeconds);
  const currentStartSeconds = (chapters[currentIndex].startMs || 0) / 1000;

  if (positionSeconds - currentStartSeconds > thresholdSeconds) {
    return { targetSeconds: currentStartSeconds, kind: 'restart' };
  }
  if (currentIndex > 0) {
    return {
      targetSeconds: (chapters[currentIndex - 1].startMs || 0) / 1000,
      kind: 'previous',
    };
  }
  return { targetSeconds: 0, kind: 'previous' };
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
