/**
 * The three states a book's progress can be in, as persisted in
 * `books.book_progress_value`.
 *
 * Lives in its own dependency-free module so pure helpers (and their jest
 * tests) can compare against it without dragging in handleBookPlay.ts, which
 * imports the Player adapter and the database. Every site imports it from
 * here; the `handleBookPlay` re-export that carried the migration is gone.
 */
export enum BookProgressState {
  NotStarted = 0,
  Started = 1,
  Finished = 2,
}
