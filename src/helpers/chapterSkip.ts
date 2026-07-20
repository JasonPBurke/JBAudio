import TrackPlayer from 'react-native-track-player';
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
 * `onBeforeSkip` receives the resolved kind ('restart' | 'previous') and is
 * awaited BEFORE the seek/skip — footprint recording needs the pre-press
 * position, but only this helper knows which action the press resolves to.
 * A callback failure never blocks the playback action.
 */
const RESTART_CHAPTER_THRESHOLD_SECONDS = 15;

export async function skipToPreviousChapter(
  onBeforeSkip?: (kind: PreviousPressKind) => void | Promise<void>,
): Promise<void> {
  const queue = await TrackPlayer.getQueue();
  const { position } = await TrackPlayer.getProgress();

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
    const activeTrack = await TrackPlayer.getActiveTrack();
    const book = activeTrack?.bookId
      ? useLibraryStore.getState().books[activeTrack.bookId]
      : undefined;

    if (book?.chapters && book.chapters.length > 1) {
      const { targetSeconds, kind } = getPreviousPressTarget(
        book.chapters,
        position,
        RESTART_CHAPTER_THRESHOLD_SECONDS,
      );
      await notifyBeforeSkip(kind);
      await TrackPlayer.seekTo(targetSeconds);
    } else {
      // Single-chapter book (or chapters not loaded): restart the track.
      await notifyBeforeSkip('restart');
      await TrackPlayer.seekTo(0);
    }
    return;
  }

  // Multi-file or clipped-chapter book: one queue item per chapter, so
  // `position` is already chapter-relative and "restart" is seekTo(0).
  if (position > RESTART_CHAPTER_THRESHOLD_SECONDS) {
    await notifyBeforeSkip('restart');
    await TrackPlayer.seekTo(0);
  } else {
    await notifyBeforeSkip('previous');
    try {
      await TrackPlayer.skipToPrevious();
    } catch {
      // First queue item has no previous — restart the book instead.
      await TrackPlayer.seekTo(0);
    }
  }
}
