import { pause, seekTo, skipToNext } from '@/player/trackPlayer';
import { getBookById } from '@/db/bookQueries';
import { BookProgressState } from '@/helpers/bookProgressState';
import { resolveNextPress, type NextPressBook } from '@/helpers/chapterSkip';

/**
 * Handles Event.RemoteNext — the skip-forward button on the notification
 * player and Android Auto. There is no in-app skip-forward surface:
 * `SkipToNextButton` is exported from PlayerControls.tsx but has zero render
 * sites, so this is the only path a user reaches.
 *
 * Extracted from the playback service for the same reason
 * `handleRemotePlayPause` was: `setup/service.js` has no test lane, and the
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

/** A recorder failure must never block the press. */
const record = async (recorder: () => Promise<void> | void) => {
  try {
    await recorder();
  } catch {
    // Non-fatal — playback must proceed even if footprinting fails.
  }
};

export async function handleRemoteNextPress({
  bookId,
  book,
  treatAsSingleFile,
  onBeforeChapterChange,
  onBeforeLeaveBook,
}: RemoteNextPress): Promise<void> {
  const action = await resolveNextPress(book, treatAsSingleFile);

  switch (action.kind) {
    // The press moves nothing, so there is nothing to leave a breadcrumb to.
    case 'none':
      return;

    case 'chapter':
      await record(onBeforeChapterChange);
      await seekTo(action.seekSeconds);
      return;

    case 'skip':
      await record(onBeforeChapterChange);
      await skipToNext();
      return;

    case 'finish':
      // Last chapter of a single-file Book: mark finished, reset and pause.
      // The stop is deliberate — unlike the 1 Hz lead-time mark, this is a
      // user press asking to leave the last chapter, and there is nowhere
      // left to play.
      await record(onBeforeLeaveBook);

      // Only the MARK is guarded: a press inside the lead window must not
      // rewrite an already-set `finished_at`. Guarded on the STORE, never on
      // finishMarkedBookId — see the latch's comment in service.js. A
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
      return;
  }
}
