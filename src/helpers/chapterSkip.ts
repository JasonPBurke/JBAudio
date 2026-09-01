import {
  getActiveBookId,
  getActiveTrackIndex,
  getProgress,
  getQueue,
  seekTo,
  skipToPrevious,
} from '@/player/trackPlayer';
import { useLibraryStore } from '@/store/library';
import {
  getNextChapterStartSeconds,
  getPreviousPressTarget,
  PreviousPressKind,
} from '@/helpers/singleFileBook';
import { queueShapeOf } from '@/helpers/queueShape';
import { Chapter } from '@/types/Book';

/**
 * The two transport press decisions — skip-to-previous below,
 * skip-to-next (`resolveNextPress`) at the bottom of the file. They share one
 * home because they are the same question at opposite ends of the Queue:
 * *where in the Queue is this press happening?* Neither native skip reports
 * that it moved nothing, so both ends have to ASK before they act.
 *
 * ── Skip-to-previous with a restart-current-chapter threshold ──
 *
 * More than RESTART_CHAPTER_THRESHOLD_SECONDS into a chapter, the press
 * restarts that chapter; at or under the threshold it goes to the previous
 * chapter. Shared by the RemotePrevious handler in setup/service.ts
 * (notification / Android Auto) and the in-app SkipToPreviousButton so
 * both press-sites behave identically — same pattern as relativeSeek.ts.
 *
 * The threshold compares playback position, so at 2× speed the window
 * passes in half the wall-clock time.
 *
 * At the START of a book — the first chapter on a one-item Queue, the first
 * QUEUE ITEM on a multi-item one — a within-threshold press restarts the book
 * rather than doing nothing, and reports 'restart' so the footprint names
 * what actually happened.
 *
 * `onBeforeSkip` receives the resolved kind ('restart' | 'previous') and is
 * awaited BEFORE the seek/skip — footprint recording needs the pre-press
 * position, but only this helper knows which action the press resolves to.
 * A callback failure never blocks the playback action.
 */
const RESTART_CHAPTER_THRESHOLD_SECONDS = 15;

export async function skipToPreviousChapter(
  onBeforeSkip?: (kind: PreviousPressKind) => void | Promise<void>,
): Promise<void> {
  // The shape comes from the BOOK, not from `queue.length`. A Queue read
  // answers about whichever Book happens to be loaded — which disagrees with
  // the Book this press is about for the length of every Book switch — and it
  // marshals the whole track list across the bridge to learn one boolean.
  const [activeBookId, { position }] = await Promise.all([
    getActiveBookId(),
    getProgress(),
  ]);
  const book = activeBookId
    ? useLibraryStore.getState().books[activeBookId]
    : undefined;

  const notifyBeforeSkip = async (kind: PreviousPressKind) => {
    if (!onBeforeSkip) return;
    try {
      await onBeforeSkip(kind);
    } catch {
      // Footprint/bookkeeping failures must not block the seek.
    }
  };

  if (queueShapeOf(book?.chapters) === 'one-item') {
    // ONE-ITEM Queue: one track for the whole Book, so chapters are absolute
    // seek offsets inside it.
    if (book?.chapters && book.chapters.length > 1) {
      const { targetSeconds, kind } = getPreviousPressTarget(
        book.chapters,
        position,
        RESTART_CHAPTER_THRESHOLD_SECONDS,
      );
      await notifyBeforeSkip(kind);
      await seekTo(targetSeconds);
    } else {
      // Single-chapter book (or chapters not loaded): restart the track.
      await notifyBeforeSkip('restart');
      await seekTo(0);
    }
    return;
  }

  // MULTI-ITEM Queue: one queue item per Chapter, so `position` is already
  // chapter-relative and "restart" is seekTo(0).
  if (position > RESTART_CHAPTER_THRESHOLD_SECONDS) {
    await notifyBeforeSkip('restart');
    await seekTo(0);
    return;
  }

  // At the first queue item there is no previous chapter, so the press
  // restarts the book — the same thing the one-item branch above does at the
  // first chapter.
  //
  // This has to be ASKED, not discovered from a failure: `skipToPrevious()`
  // at index 0 RESOLVES having moved nothing. Native `previous()` is
  // `exoPlayer.seekToPreviousMediaItem()`, documented as "does nothing if
  // there is no previous item", and `MusicModule` resolves the promise
  // unconditionally — there is no rejection to catch.
  //
  // `undefined` means the index could not be read, NOT index 0: treating it
  // as 0 would turn a transient read failure into a spurious restart, so an
  // unknown index takes the ordinary previous-chapter path. That path is
  // deliberately unguarded — after this fix it always acts, so a "did
  // anything move?" check would be dead code — which leaves one accepted
  // residual: an unreadable index that was really 0 still records a
  // `chapter_change` for a press that went nowhere.
  const activeIndex = await getActiveTrackIndex();
  if (activeIndex === 0) {
    await notifyBeforeSkip('restart');
    await seekTo(0);
    return;
  }

  await notifyBeforeSkip('previous');
  await skipToPrevious();
}

/**
 * What a skip-to-NEXT press resolves to, before anything acts on it.
 *
 * Deciding this up front is the whole point: at the LAST item of a multi-item
 * Queue `skipToNext()` RESOLVES having moved nothing (native
 * `seekToNextMediaItem()` is documented as "does nothing if there is no next
 * item" and `MusicModule` resolves the promise unconditionally), so a caller
 * that acts first and records afterwards cannot tell a real chapter change
 * from a press that went nowhere. That is how `Event.RemoteNext` came to write
 * a `chapter_change` footprint for a no-op press. A footprint is a breadcrumb
 * back to a spot the user left; if the press does not leave, there is no
 * breadcrumb — so the caller needs the verdict BEFORE it records.
 *
 * The mirror of `skipToPreviousChapter`'s index check at the other end of the
 * Queue, and it reads the same way: `undefined` from `getActiveTrackIndex()`
 * means the index could not be READ, not that it is the last item, so an
 * unreadable index takes the ordinary acting path rather than silently
 * swallowing a press.
 *
 * `'finish'` is the last chapter on a ONE-ITEM Queue: a deliberate press
 * asking to leave a chapter there has nowhere left to play, so the caller
 * marks the Book finished instead of seeking. It is NOT a chapter change, and
 * its footprint is labeled accordingly by the caller.
 */
export type NextPressAction =
  /** One-item Queue: seek to the next chapter's absolute start. */
  | { kind: 'chapter'; seekSeconds: number }
  /** Chapter queue: `skipToNext()` will move to the next queue item. */
  | { kind: 'skip' }
  /** Last chapter on a one-item Queue: end of the Book. */
  | { kind: 'finish' }
  /** Last queue item: the press moves nothing, so nothing should be recorded. */
  | { kind: 'none' };

/** The only thing this decision needs from the Book. */
export type NextPressBook = { chapters?: Chapter[] } | undefined;

/**
 * `oneItemQueue` is passed in rather than derived here: the Queue shape
 * verdict is `queueShapeOf`'s (`helpers/queueShape.ts`) and the caller — the
 * composition root in `nextPress.ts` — already holds it.
 *
 * ⚠ NAMED FOR THE QUEUE, NOT FOR THE BOOK ON DISK. It used to carry the name
 * of a since-deleted "treat as single file" predicate — wording CONTEXT.md's
 * **Queue shape** entry lists under _Avoid_ for exactly the confusion it
 * caused here: a Book stored as one file that clears the clipped-chapters
 * memory gate is single-file in the DB and a MULTI-ITEM Queue at runtime, so
 * the two words are not the same question.
 */
export async function resolveNextPress(
  book: NextPressBook,
  oneItemQueue: boolean,
): Promise<NextPressAction> {
  if (oneItemQueue && book?.chapters && book.chapters.length > 1) {
    const { position } = await getProgress();
    const nextStart = getNextChapterStartSeconds(book.chapters, position);
    return nextStart !== null
      ? { kind: 'chapter', seekSeconds: nextStart }
      : { kind: 'finish' };
  }

  const [activeIndex, queue] = await Promise.all([
    getActiveTrackIndex(),
    getQueue(),
  ]);

  // An unreadable index or an empty queue read is not evidence that the press
  // is a no-op — act, exactly as the previous side does.
  if (
    activeIndex !== undefined &&
    queue.length > 0 &&
    activeIndex >= queue.length - 1
  ) {
    return { kind: 'none' };
  }

  return { kind: 'skip' };
}
