import type { Book } from '@/types/Book';
import { queueShapeOf, type ShapeChapter } from '@/helpers/queueShape';
import { findChapterIndexByPosition } from '@/helpers/singleFileBook';

/**
 * Chapter identity for playback UIs, for either Queue shape:
 *
 * - MULTI-ITEM: queue index == chapter index and positions are
 *   chapter-relative. That is how a Book with one file per Chapter has always
 *   behaved, and how one file with real Chapter offsets behaves under the
 *   clipped-chapters spike (each Chapter is a clipped queue item).
 * - ONE-ITEM: the whole Book is one queue item and positions are absolute, so
 *   the Chapter must be derived from the position.
 *
 * Both functions below ask `queueShapeOf` — they do not derive shape.
 *
 * Never identify a chapter by URL — clipped queue items all share one URL.
 */

/**
 * Resolves the current chapter index for either shape. Returns undefined when
 * it cannot be determined yet (no chapters, or queue index unknown on a
 * multi-item Queue).
 */
export function resolveCurrentChapterIndex(
  chapters: readonly ShapeChapter[] | undefined,
  queueIndex: number | null | undefined,
  positionSeconds: number,
): number | undefined {
  if (!chapters || chapters.length === 0) return undefined;

  if (queueShapeOf(chapters) === 'multi-item') {
    if (typeof queueIndex !== 'number' || queueIndex < 0) return undefined;
    return Math.min(queueIndex, chapters.length - 1);
  }

  return findChapterIndexByPosition(chapters, positionSeconds);
}

/**
 * Remaining time in the book, in seconds.
 * On a multi-item Queue `positionSeconds` is chapter-relative and
 * `currentIndex` is the queue/chapter index; on a one-item Queue
 * `positionSeconds` is the absolute position and the index is ignored.
 */
export function calculateRemainingBookTime(
  book: Book,
  positionSeconds: number,
  currentIndex: number | undefined,
): number {
  const chapters = book.chapters;

  if (
    !chapters ||
    chapters.length === 0 ||
    queueShapeOf(chapters) === 'one-item'
  ) {
    return Math.max(0, book.bookDuration - positionSeconds);
  }

  const idx =
    typeof currentIndex === 'number' &&
    currentIndex >= 0 &&
    currentIndex < chapters.length
      ? currentIndex
      : 0;

  let totalPlayed = positionSeconds;
  for (let i = 0; i < idx; i++) {
    totalPlayed += chapters[i]?.chapterDuration ?? 0;
  }

  return Math.max(0, book.bookDuration - totalPlayed);
}
