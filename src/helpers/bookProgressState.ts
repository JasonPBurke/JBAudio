/**
 * The three states a book's progress can be in, as persisted in
 * `books.book_progress_value`.
 *
 * Lives in its own dependency-free module so pure helpers (and their jest
 * tests) can compare against it without dragging in handleBookPlay.ts, which
 * imports the Player adapter and the database. handleBookPlay re-exports it, so the
 * long-standing `from '@/helpers/handleBookPlay'` import sites still work.
 */
export enum BookProgressState {
  NotStarted = 0,
  Started = 1,
  Finished = 2,
}
