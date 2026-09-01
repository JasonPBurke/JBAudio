import type { Book } from '@/types/Book';
import { approximateLocationInBook } from '@/helpers/bookLocation';

/*
 * Remaining-time arithmetic for a Book, and nothing else.
 *
 * This file used to open with a paragraph explaining what a Chapter index
 * means under each Queue shape, because it held `resolveCurrentChapterIndex`
 * — a predicate that asked `queueShapeOf` and then branched. Every caller of
 * it now asks `helpers/bookLocation` instead, so the predicate is gone and so
 * is the explanation: the one function left here hands its Player reading to
 * the translator and never learns which shape it is in.
 *
 * Never identify a chapter by URL — clipped queue items all share one URL.
 */

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
