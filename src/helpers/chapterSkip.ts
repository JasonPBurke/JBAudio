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
  getPreviousPressTarget,
  PreviousPressKind,
} from '@/helpers/singleFileBook';

/**
 * Skip-to-previous with a restart-current-chapter threshold.
 *
 * More than RESTART_CHAPTER_THRESHOLD_SECONDS into a chapter, the press
 * restarts that chapter; at or under the threshold it goes to the previous
 * chapter. Shared by the RemotePrevious handler in setup/service.js
 * (notification / Android Auto) and the in-app SkipToPreviousButton so
 * both press-sites behave identically — same pattern as relativeSeek.ts.
 *
 * The threshold compares playback position, so at 2× speed the window
 * passes in half the wall-clock time.
 *
 * At the FIRST chapter of a book, a within-threshold press restarts the book
 * rather than doing nothing — on both queue shapes, and reported as
 * 'restart' so the footprint names what actually happened.
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
  const queue = await getQueue();
  const { position } = await getProgress();

  const notifyBeforeSkip = async (kind: PreviousPressKind) => {
    if (!onBeforeSkip) return;
    try {
      await onBeforeSkip(kind);
    } catch {
      // Footprint/bookkeeping failures must not block the seek.
    }
  };

  if (queue.length === 1) {
    // Legacy single-file book: one track, chapters are absolute seek offsets.
    const activeBookId = await getActiveBookId();
    const book = activeBookId
      ? useLibraryStore.getState().books[activeBookId]
      : undefined;

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

  // Multi-file or clipped-chapter book: one queue item per chapter, so
  // `position` is already chapter-relative and "restart" is seekTo(0).
  if (position > RESTART_CHAPTER_THRESHOLD_SECONDS) {
    await notifyBeforeSkip('restart');
    await seekTo(0);
    return;
  }

  // At the first queue item there is no previous chapter, so the press
  // restarts the book — the same thing the single-file branch above does at
  // the first chapter.
  //
  // This has to be ASKED, not discovered from a failure: `skipToPrevious()`
  // at index 0 RESOLVES having moved nothing. Native `previous()` is
  // `exoPlayer.seekToPreviousMediaItem()`, documented as "does nothing if
  // there is no previous item", and `MusicModule` resolves the promise
  // unconditionally — there is no rejection to catch.
  //
  // `undefined` means the index could not be read, NOT index 0: treating it
  // as 0 would turn a transient read failure into a spurious restart, so an
  // unknown index takes the ordinary previous-chapter path.
  const activeIndex = await getActiveTrackIndex();
  if (activeIndex === 0) {
    await notifyBeforeSkip('restart');
    await seekTo(0);
    return;
  }

  await notifyBeforeSkip('previous');
  await skipToPrevious();
}
