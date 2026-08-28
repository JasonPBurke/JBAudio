import { pause, seekTo, skipToNext } from '@/player/trackPlayer';
import { getBookById } from '@/db/bookQueries';
import { BookProgressState } from '@/helpers/bookProgressState';
import { resolveNextPress, type NextPressBook } from '@/helpers/chapterSkip';
import {
  resetBookToStart,
  type SingleFileChapterTracking,
} from '@/helpers/resetBookToStart';

/**
 * Handles Event.RemoteNext — the skip-forward button on the notification
 * player and Android Auto. There is no in-app skip-forward surface:
 * `SkipToNextButton` is exported from PlayerControls.tsx but has zero render
 * sites, so this is the only path a user reaches.
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
export type RemoteNextPress = {
  bookId: string;
  /** The library-store entry for `bookId`, if it has one. */
  book: (NextPressBook & { bookProgressValue?: number }) | undefined;
  /**
   * Whether this Book loads as ONE queue item. The playback service holds
   * that verdict (it folds in the clipped-chapters memory gate), so it is
   * passed in rather than re-derived here — a clipped Book is single-file in
   * the DB and a chapter queue at runtime.
   */
  treatAsSingleFile: boolean;
  /**
   * The playback service's module-scope chapter-change detector, handed over
   * so the finish branch can rewind it through the shared reset. Passed in
   * because the progress handler in `setup/service.ts` owns it.
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

/**
 * Bookkeeping around a press — footprints going in, the reset coming out —
 * must never block the press itself.
 */
const withoutBlockingThePress = async (
  work: () => Promise<void> | void,
) => {
  try {
    await work();
  } catch {
    // Non-fatal — playback must proceed even if the bookkeeping fails.
  }
};

export async function handleRemoteNextPress({
  bookId,
  book,
  treatAsSingleFile,
  chapterTracking,
  onBeforeChapterChange,
  onBeforeLeaveBook,
}: RemoteNextPress): Promise<void> {
  const action = await resolveNextPress(book, treatAsSingleFile);

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
      // Last chapter of a single-file Book: mark finished, reset and pause.
      // The stop is deliberate — unlike the 1 Hz lead-time mark, this is a
      // user press asking to leave the last chapter, and there is nowhere
      // left to play.
      await withoutBlockingThePress(onBeforeLeaveBook);

      // Only the MARK is guarded: a press inside the lead window must not
      // rewrite an already-set `finished_at`. Guarded on the STORE, never on
      // finishMarkedBookId — see the latch's comment in service.ts. A
      // lead-time mark landed at least a tick ago and the observer refreshes
      // within about one, so the store is the reliable reading here and it
      // cannot go stale across listens.
      if (book?.bookProgressValue !== BookProgressState.Finished) {
        const bookModel = await getBookById(bookId);
        if (bookModel) {
          await bookModel.updateBookProgress(BookProgressState.Finished);
        }
      }
      await seekTo(0);
      await pause();

      // The same rewind `Event.PlaybackQueueEnded` performs — the two paths
      // both finish a Book and must leave it in the same state. Omitting it
      // here is what left the chapter list highlighting the last chapter of
      // a Book that had just been reset to 0.
      //
      // Last, and deliberately so, for two reasons. It is bookkeeping
      // behind a press that has already been served, so a DB failure inside
      // it must not cost the user the seek or the pause they asked for —
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
