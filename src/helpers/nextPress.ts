import { seekTo, skipToNext, stop } from '@/player/trackPlayer';
import {
  markBookFinishedOnce,
  type BookProgressReading,
} from '@/helpers/markBookFinishedOnce';
import { resolveNextPress, type NextPressBook } from '@/helpers/chapterSkip';
import {
  resetBookToStart,
  type SingleFileChapterTracking,
} from '@/helpers/resetBookToStart';
import { queueShapeOf } from '@/helpers/queueShape';
import { withoutBlockingThePress } from '@/helpers/withoutBlockingThePress';
import { singleFileChapterTracking } from '@/helpers/chapterTracking';
import {
  recordActiveBookChapterChangeFootprint,
  recordActiveBookSeekFootprint,
} from '@/helpers/activeBookFootprints';
import type { Book } from '@/types/Book';

/**
 * The skip-forward press, for every surface that can make one: the
 * notification player and Android Auto (`Event.RemoteNext`) and the in-app
 * `SkipToNextButton`. Named for the question it answers rather than the
 * caller that used to be its only one — the button carried a fourth,
 * hand-rolled copy of this decision until it was routed through here.
 *
 * Two functions, deliberately: `pressNext` at the bottom is the WIRING both
 * surfaces share (queue-shape verdict, tracker, footprint recorders) and is
 * what a press site calls; `handleNextPress` is the press itself with those
 * dependencies INJECTED, which is what makes the ordering property below
 * assertable without a player or a database.
 *
 * Extracted from the playback service for the same reason
 * `handleRemotePlayPause` was: `setup/service.ts` has no test lane, and the
 * property that matters here is one no "was it recorded?" assertion can see.
 *
 * ── The ordering rule, which is the whole point ──
 *
 * A footprint is a breadcrumb back to the spot the user LEFT, so it must be
 * written BEFORE the seek/skip, and only when the press actually leaves. Both
 * halves are load-bearing and both are easy to break silently:
 *
 *  - Record after the transport call and the breadcrumb points at the
 *    destination instead of the origin. The tests assert call ORDER for this.
 *  - Record before asking where in the Queue we are, and a press at the last
 *    queue item leaves a breadcrumb back to a spot it never left —
 *    `skipToNext()` there RESOLVES having moved nothing, so the no-op is
 *    invisible from the call. `resolveNextPress` asks first.
 *
 * Both recorder callbacks run before their action and neither may block it:
 * a footprint failure must never cost the user their press.
 */
export type NextPress = {
  bookId: string;
  /**
   * The library-store entry for `bookId`, if it has one. The progress half is
   * the shared reading `markBookFinishedOnce` guards on, not a second
   * structural spelling of the same field.
   */
  book: (NextPressBook & BookProgressReading) | undefined;
  /**
   * Whether this Book loads as ONE queue item — `queueShapeOf`'s verdict,
   * which folds in the clipped-chapters memory gate. Passed in rather than
   * re-derived here: a clipped Book is stored as one file but is a chapter
   * queue at runtime, so only the Queue shape answers this.
   */
  oneItemQueue: boolean;
  /**
   * The shared chapter-change detector, handed over so the finish branch can
   * rewind it through the shared reset. Passed in rather than imported so the
   * finish branch's rewind is assertable with a tracker the test controls.
   */
  chapterTracking: SingleFileChapterTracking;
  /** Records a `chapter_change` footprint. Awaited before the seek/skip. */
  onBeforeChapterChange: () => Promise<void> | void;
  /**
   * Records the breadcrumb for a press that leaves the Book entirely (the
   * last chapter of a single-file Book). Labeled `seek`, not
   * `chapter_change`: no chapter changed, and the reset that follows destroys
   * the position it points at — which makes it the most perishable footprint
   * in the app, so it is written before the finished-mark too.
   */
  onBeforeLeaveBook: () => Promise<void> | void;
};

export async function handleNextPress({
  bookId,
  book,
  oneItemQueue,
  chapterTracking,
  onBeforeChapterChange,
  onBeforeLeaveBook,
}: NextPress): Promise<void> {
  const action = await resolveNextPress(book, oneItemQueue);

  switch (action.kind) {
    // The press moves nothing, so there is nothing to leave a breadcrumb to.
    case 'none':
      return;

    case 'chapter':
      await withoutBlockingThePress(onBeforeChapterChange);
      await seekTo(action.seekSeconds);
      return;

    case 'skip':
      await withoutBlockingThePress(onBeforeChapterChange);
      await skipToNext();
      return;

    case 'finish':
      // Last chapter of a single-file Book: mark finished, reset and stop.
      // The stop is deliberate — unlike the 1 Hz lead-time mark, this is a
      // user press asking to leave the last chapter, and there is nowhere
      // left to play. It is also what `Event.PlaybackQueueEnded` does, and
      // all three finish paths must leave one state: `stop()` reaches the
      // sleep timer's STOPPED handler, which clears an armed timer, where
      // `pause()` would freeze it to resume later against a different Book.
      await withoutBlockingThePress(onBeforeLeaveBook);

      // Guard and swallow both live in the verb; the store entry is handed
      // over rather than read there, which is what keeps this function
      // assertable without a store.
      await markBookFinishedOnce(bookId, book);
      await seekTo(0);
      await stop();

      // The same rewind `Event.PlaybackQueueEnded` performs — the two paths
      // both finish a Book and must leave it in the same state. Omitting it
      // here is what left the chapter list highlighting the last chapter of
      // a Book that had just been reset to 0.
      //
      // Last, and deliberately so, for two reasons. It is bookkeeping
      // behind a press that has already been served, so a DB failure inside
      // it must not cost the user the seek or the stop they asked for —
      // hence the same swallow the recorders get. And
      // a 1 Hz progress tick can still land on either await above: after the
      // seek the Book really is at 0, so the worst that tick can do is write
      // the same zeroes we are about to write. Resetting FIRST would leave
      // the tracker at chapter 0 while the position is still in the last
      // chapter, and that tick would write the stale index straight back.
      await withoutBlockingThePress(() =>
        resetBookToStart(bookId, chapterTracking),
      );
      return;
  }
}

/**
 * A skip-forward press from a surface that knows which Book is loaded.
 *
 * The composition root: it holds the four wiring decisions that must be the
 * SAME on every surface, so that a press behaves identically whether it came
 * from the app, the notification or Android Auto.
 *
 *  - the queue-shape verdict comes from the one shared `queueShapeOf`;
 *  - the tracker is the one shared instance, so the finish branch rewinds the
 *    same object the progress handler advances each tick;
 *  - both branches that MOVE record a footprint — the press type decides,
 *    not the surface (see `activeBookFootprints`'s header). The last-queue-item
 *    branch moves nothing and so records nothing;
 *  - the leave-the-Book breadcrumb is a `seek`, not a `chapter_change`: no
 *    chapter changed, and the rewind that follows destroys the position it
 *    points at.
 *
 * `book` is the library store's entry, which is legitimately `undefined` on
 * the cold-start path where the service runs before the store is populated.
 */
export async function pressNext(
  bookId: string,
  book: Book | undefined,
): Promise<void> {
  await handleNextPress({
    bookId,
    book,
    oneItemQueue: queueShapeOf(book?.chapters) === 'one-item',
    chapterTracking: singleFileChapterTracking,
    onBeforeChapterChange: () => recordActiveBookChapterChangeFootprint(bookId),
    onBeforeLeaveBook: () => recordActiveBookSeekFootprint(bookId),
  });
}
