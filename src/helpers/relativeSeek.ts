import TrackPlayer, { State } from 'react-native-track-player';
import { getBookById } from '@/db/bookQueries';
import { BookProgressState } from '@/helpers/handleBookPlay';

/**
 * Relative seek with chapter/track-boundary crossing.
 *
 * Native seekBy() clamps within the CURRENT queue item, so on multi-track
 * queues (multi-file books, and single-file books under clipped chapters —
 * one queue item per chapter) a remote jump-back would stop dead at the
 * chapter start. These helpers compute the overshoot in JS and issue an
 * explicit skip + seek instead, so the notification player, Android Auto
 * (RemoteJumpBackward/Forward) and the in-app buttons all behave the same:
 * 15s into chapter 2 minus 30s lands 15s before the end of chapter 1.
 *
 * Single-item queues (legacy single-file books) keep absolute positions, so
 * an in-track seek already crosses virtual chapters; only the book edges
 * need clamping/finishing.
 */

async function isPlayingNow(): Promise<boolean> {
  const { state } = await TrackPlayer.getPlaybackState();
  return state === State.Playing || state === State.Buffering;
}

// Guard: restore play state if the seek/skip caused an unexpected pause
async function restorePlayStateIfNeeded(wasPlaying: boolean): Promise<void> {
  if (!wasPlaying) return;
  if (!(await isPlayingNow())) {
    await TrackPlayer.play();
  }
}

export async function seekBack(seconds: number): Promise<void> {
  const wasPlaying = await isPlayingNow();

  const currentTrackIndex = await TrackPlayer.getActiveTrackIndex();
  const { position } = await TrackPlayer.getProgress();
  const newPosition = position - seconds;

  const queue = await TrackPlayer.getQueue();
  const isSingleFile = queue.length === 1;

  if (newPosition < 0) {
    if (isSingleFile || currentTrackIndex === 0) {
      // Single-file book or first track: clamp to start
      await TrackPlayer.seekTo(0);
    } else {
      // Multi-track queue: land the remainder before the previous track's end
      await TrackPlayer.skipToPrevious();
      const { duration } = await TrackPlayer.getProgress();
      await TrackPlayer.seekTo(duration + newPosition);
    }
  } else {
    await TrackPlayer.seekTo(newPosition);
  }

  await restorePlayStateIfNeeded(wasPlaying);
}

export async function seekForward(seconds: number): Promise<void> {
  const wasPlaying = await isPlayingNow();

  const currentTrackIndex = await TrackPlayer.getActiveTrackIndex();
  const queue = await TrackPlayer.getQueue();
  const { position, duration } = await TrackPlayer.getProgress();
  const newPosition = position + seconds;

  const isSingleFile = queue.length === 1;

  if (newPosition > duration) {
    if (
      isSingleFile ||
      (currentTrackIndex !== undefined &&
        currentTrackIndex === queue.length - 1)
    ) {
      // Single-file book or last track: mark as finished, reset and stop
      const activeTrack = await TrackPlayer.getActiveTrack();
      if (activeTrack?.bookId) {
        const bookModel = await getBookById(activeTrack.bookId);
        if (bookModel) {
          await bookModel.updateBookProgress(BookProgressState.Finished);
        }
      }
      if (isSingleFile) {
        await TrackPlayer.seekTo(0);
      } else {
        await TrackPlayer.skip(0);
        await TrackPlayer.seekTo(0);
      }
      // Intentional pause — skip the play-state guard
      await TrackPlayer.pause();
      return;
    }
    // Multi-track queue: carry the overshoot into the next track
    await TrackPlayer.skipToNext();
    await TrackPlayer.seekTo(newPosition - duration);
  } else {
    await TrackPlayer.seekTo(newPosition);
  }

  await restorePlayStateIfNeeded(wasPlaying);
}
