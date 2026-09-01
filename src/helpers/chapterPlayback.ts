import type { Book } from '@/types/Book';
import { queueShapeOf, type ShapeChapter } from '@/helpers/queueShape';
import { findChapterIndexByPosition } from '@/helpers/singleFileBook';
import { approximateLocationInBook } from '@/helpers/bookLocation';

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
 * `resolveCurrentChapterIndex` asks `queueShapeOf` — it does not derive
 * shape. `calculateRemainingBookTime` no longer asks at all: it hands its
 * Player reading to `helpers/bookLocation`, where the two coordinates meet,
 * so there is one branch here where there were two.
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
 * Remaining time in the book, in seconds — or `null` when the location could
 * not be told.
 *
 * ⚠ THE READING IS A PLAYER ONE (`from: 'queue'`): `positionSeconds` is
 * seconds into the playing QUEUE ITEM and `currentIndex` is the Queue index.
 * The translator is what turns that into a Book Position, and it is the same
 * translator the persisted surfaces use — this file no longer asks which
 * shape it is in.
 *
 * ⚠ THE BEST-EFFORT VARIANT, ASKED FOR BY NAME. A chapter whose duration
 * failed to extract counts as zero, which UNDERCOUNTS what has been played
 * and so OVERSTATES what is left. For a label that is the safe direction —
 * it can never announce "0m left" in the middle of a Book — and it is not
 * the family that once marked a twenty-file Book Finished at chapter five.
 * That caller (`evaluateBookEnd`) uses the exact function.
 *
 * `null` means the Queue index could not be read on a multi-item Queue, where
 * it is the only thing that says which Chapter is playing. It is NOT zero
 * remaining; the caller decides what to show. Previously this fabricated
 * chapter 0 for that case.
 */
export function calculateRemainingBookTime(
  book: Book,
  positionSeconds: number,
  currentIndex: number | undefined,
): number | null {
  const chapters = book.chapters;

  // No chapters at all: there is nothing to convert between, so the Position
  // is the Book Position. The translator declines this case outright (a null
  // RESULT means "there is no Book here"), which would lose a perfectly good
  // answer.
  if (!chapters || chapters.length === 0) {
    return Math.max(0, book.bookDuration - positionSeconds);
  }

  const totalPlayed = approximateLocationInBook(chapters, {
    from: 'queue',
    queueIndex: currentIndex,
    positionSeconds,
  })?.bookPositionSeconds;

  if (totalPlayed == null) return null;

  return Math.max(0, book.bookDuration - totalPlayed);
}
