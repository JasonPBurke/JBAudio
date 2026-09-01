import { Chapter } from '@/types/Book';

/**
 * Determines if a book has valid chapter timing data.
 * Returns true if the book has multiple chapters with at least one having a non-zero startMs.
 * Used to decide whether to show chapter-level metadata on lock screen.
 *
 * ⚠ NOT A QUEUE SHAPE VERDICT, and its threshold is deliberately not
 * `queueShapeOf`'s. This asks whether the rows carry BOUNDARIES worth showing
 * a listener; `queueShapeOf` asks how the Queue was built. The two live in
 * separate modules for that reason. ⚠ This `> 1` is load-bearing only
 * TOGETHER with `shouldUseClippedChapters`' own — flipping either alone
 * changes no verdict, and flipping both makes a one-chapter Book clippable.
 * The argument is on that gate, at `helpers/clippedChapters.ts`.
 *
 * This module is what is left of `helpers/singleFileBook.ts`, which also held
 * the app's Book Position ⇄ Chapter Position conversion pair. That pair was a
 * general-purpose translator wearing a special case's name, and it is now
 * `helpers/bookLocation.ts`. Nothing here converts between coordinates.
 */
export function hasValidChapterData(
  chapters: readonly Pick<Chapter, 'startMs'>[] | undefined,
): boolean {
  if (!chapters || chapters.length <= 1) return false;
  return chapters.some((c) => (c.startMs || 0) > 0);
}
