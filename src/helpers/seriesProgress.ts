import { Book } from '@/types/Book';

export type SeriesProgressState = 'unplayed' | 'playing' | 'finished';

/**
 * Completion model: derive a series' aggregate progress from its books.
 *   - every book NotStarted (0) → 'unplayed'
 *   - every book Finished (2)   → 'finished'
 *   - anything in between       → 'playing'
 *
 * bookProgressValue: 0 NotStarted, 1 Started, 2 Finished
 * (BookProgressState in handleBookPlay.ts). Empty series → 'unplayed'.
 */
export function deriveSeriesProgressState(
  books: Pick<Book, 'bookProgressValue'>[],
): SeriesProgressState {
  if (books.length === 0) return 'unplayed';
  if (books.every((b) => b.bookProgressValue === 0)) return 'unplayed';
  if (books.every((b) => b.bookProgressValue === 2)) return 'finished';
  return 'playing';
}
