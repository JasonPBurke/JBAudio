import TrackPlayer, { Event, State } from 'react-native-track-player';
import { useLibraryStore } from '@/store/library';
import { useSettingsStore } from '@/store/settingsStore';
import {
  updateChapterProgressInDB,
  updateChapterIndexInDB,
} from '@/db/chapterQueries';
import { getBookById } from '@/db/bookQueries';
import {
  handleBookPlay,
  BookProgressState,
} from '@/helpers/handleBookPlay';
import { recordFootprint } from '@/db/footprintQueries';
import {
  findChapterIndexByPosition,
  calculateProgressWithinChapter,
  hasValidChapterData,
  getNextChapterStartSeconds,
  getPreviousChapterStartSeconds,
} from '@/helpers/singleFileBook';
import * as sleepTimer from '@/setup/sleepTimer';
import { useQueueStore } from '@/store/queue';

const { setPlaybackIndex, setPlaybackProgress } =
  useLibraryStore.getState();

// Single-file book chapter tracking state (module-scope)
let singleFileChapterState = {
  lastChapterIndex: -1,
  bookId: null,
};

// Periodic progress save interval (defense in depth for force-close scenarios)
const PROGRESS_SAVE_INTERVAL = 30000; // 30 seconds
let lastProgressSaveTime = 0;

// Guard against spurious RemoteStop from Android MediaSession after Doze.
// After extended background, the OS can fire RemoteStop immediately after playback starts.
// We ignore RemoteStop if Playing state was reached within this window.
let lastPlayingStateAt = 0;
const REMOTE_STOP_GUARD_MS = 500;

export default module.exports = async function () {
  // Hydrate sleep timer store from DB so UI shows correct state immediately on start
  try {
    await sleepTimer.syncFromDB();
  } catch {
    // Non-critical — store will be populated on first progress tick
  }

  TrackPlayer.addEventListener(Event.RemotePlay, async () => {
    // Record footprint for remote play (lock screen, headphones, etc.)
    try {
      const activeTrack = await TrackPlayer.getActiveTrack();
      if (activeTrack?.bookId) {
        await recordFootprint(activeTrack.bookId, 'play');
      }
    } catch {
      // Silently fail if footprint recording fails
    }
    await TrackPlayer.play();
  });
  // TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => {
    TrackPlayer.pause();
  });
  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    const msSincePlaying = Date.now() - lastPlayingStateAt;
    if (msSincePlaying < REMOTE_STOP_GUARD_MS) {
      return;
    }
    TrackPlayer.stop();
  });
  TrackPlayer.addEventListener(Event.RemoteSeek, ({ position }) => {
    TrackPlayer.seekTo(position);
  });
  TrackPlayer.addEventListener(Event.RemoteJumpForward, () => {
    const { skipForwardDuration } = useSettingsStore.getState();
    TrackPlayer.seekBy(skipForwardDuration);
  });
  TrackPlayer.addEventListener(Event.RemoteJumpBackward, () => {
    const { skipBackDuration } = useSettingsStore.getState();
    TrackPlayer.seekBy(-skipBackDuration);
  });
  TrackPlayer.addEventListener(Event.RemoteNext, async () => {
    const activeTrack = await TrackPlayer.getActiveTrack();
    if (!activeTrack?.bookId) {
      await TrackPlayer.skipToNext();
      return;
    }

    const book = useLibraryStore.getState().books[activeTrack.bookId];
    if (book?.isSingleFile && book.chapters && book.chapters.length > 1) {
      const { position } = await TrackPlayer.getProgress();
      const nextStart = getNextChapterStartSeconds(book.chapters, position);

      if (nextStart !== null) {
        await TrackPlayer.seekTo(nextStart);
      } else {
        // At last chapter: mark finished, reset and pause
        const bookModel = await getBookById(activeTrack.bookId);
        if (bookModel) {
          await bookModel.updateBookProgress(BookProgressState.Finished);
        }
        await TrackPlayer.seekTo(0);
        await TrackPlayer.pause();
      }
    } else {
      await TrackPlayer.skipToNext();
    }
  });
  TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
    const activeTrack = await TrackPlayer.getActiveTrack();
    if (!activeTrack?.bookId) {
      await TrackPlayer.skipToPrevious();
      return;
    }

    const book = useLibraryStore.getState().books[activeTrack.bookId];
    if (book?.isSingleFile && book.chapters && book.chapters.length > 1) {
      const { position } = await TrackPlayer.getProgress();
      const prevStart = getPreviousChapterStartSeconds(book.chapters, position);
      await TrackPlayer.seekTo(prevStart);
    } else {
      await TrackPlayer.skipToPrevious();
    }
  });
  TrackPlayer.addEventListener('remote-play-book', async ({ bookId }) => {
    const { books } = useLibraryStore.getState();
    const { activeBookId, setActiveBookId } = useQueueStore.getState();
    const book = books[bookId];
    if (!book) return;
    if (activeBookId === bookId) {
      await TrackPlayer.play();
      return;
    }
    // playing=true is unused here: isActiveBook=false bypasses handleBookPlay's guard
    await handleBookPlay(book, true, false, activeBookId, setActiveBookId);
  });

  TrackPlayer.addEventListener(
    Event.PlaybackProgressUpdated,
    async ({ position, track }) => {
      //? event {"buffered": 107.232, "duration": 4626.991, "position": 0.526, "track": 3}
      const trackToUpdate = await TrackPlayer.getTrack(track);

      //? trackToUpdate ["title", "album", "url", "artwork", "bookId", "artist"]

      // Get book data from library store - use isSingleFile from DB to avoid queue race condition
      const book = useLibraryStore.getState().books[trackToUpdate.bookId];

      // Use isSingleFile from database (set at scan time) instead of queue.length
      // This eliminates the race condition where queue isn't ready after app restart
      const isSingleFile = book?.isSingleFile ?? false;

      if (
        isSingleFile &&
        book &&
        book.chapters &&
        book.chapters.length > 1
      ) {
        const chapters = book.chapters;
        const currentChapterIndex = findChapterIndexByPosition(
          chapters,
          position,
        );
        const progressWithinChapter = calculateProgressWithinChapter(
          chapters,
          position,
        );

        // Update progress in store using progress within chapter
        setPlaybackProgress(trackToUpdate.bookId, progressWithinChapter);

        //! this was unstable and did not update the notification player w/chapter durations.
        // // Update now playing metadata with chapter-relative position for lock screen
        // // This makes the progress bar show chapter progress instead of full book progress
        // if (hasValidChapterData(chapters)) {
        //   const currentChapter = chapters[currentChapterIndex];
        //   if (currentChapter) {
        //     await TrackPlayer.updateNowPlayingMetadata({
        //       elapsedTime: progressWithinChapter,
        //       duration: currentChapter.chapterDuration,
        //     });
        //   }
        // }

        // Check if chapter changed
        if (
          singleFileChapterState.bookId !== trackToUpdate.bookId ||
          singleFileChapterState.lastChapterIndex !== currentChapterIndex
        ) {
          const wasChapterChange =
            singleFileChapterState.bookId === trackToUpdate.bookId &&
            singleFileChapterState.lastChapterIndex !== -1 &&
            singleFileChapterState.lastChapterIndex !== currentChapterIndex;

          // Update state
          singleFileChapterState.bookId = trackToUpdate.bookId;
          singleFileChapterState.lastChapterIndex = currentChapterIndex;

          // Update Zustand store for UI reactivity
          setPlaybackIndex(trackToUpdate.bookId, currentChapterIndex);
          // Update database for persistence - save BOTH chapterIndex AND progress atomically
          // This ensures they're always in sync, even if app is force-closed
          await updateChapterIndexInDB(
            trackToUpdate.bookId,
            currentChapterIndex,
          );
          await updateChapterProgressInDB(
            trackToUpdate.bookId,
            progressWithinChapter,
          );

          // Update track metadata for lock screen/notification
          if (hasValidChapterData(chapters)) {
            const currentChapter = chapters[currentChapterIndex];
            if (currentChapter) {
              await TrackPlayer.updateMetadataForTrack(track, {
                title: currentChapter.chapterTitle,
                duration: currentChapter.chapterDuration,
                // Preserve existing metadata that shouldn't change
                artwork: book.artwork,
                artist: book.author,
                album: book.bookTitle,
              });
            }
          }

          // Handle sleep timer chapter countdown on chapter change
          if (wasChapterChange) {
            await sleepTimer.onChapterChanged();
          }
        }

        // Periodic progress save (defense in depth for force-close scenarios)
        // Saves at most every 30 seconds during playback to limit data loss
        const now = Date.now();
        if (now - lastProgressSaveTime >= PROGRESS_SAVE_INTERVAL) {
          lastProgressSaveTime = now;
          await updateChapterProgressInDB(
            trackToUpdate.bookId,
            progressWithinChapter,
          );
        }

        // Book end detection: check if position is near end of book
        const { duration } = await TrackPlayer.getProgress();
        const END_THRESHOLD = 0.2; // .2 seconds before end to trigger
        if (duration > 0 && position >= duration - END_THRESHOLD) {
          // Mark book as finished
          const bookModel = await getBookById(trackToUpdate.bookId);
          if (bookModel) {
            await bookModel.updateBookProgress(BookProgressState.Finished);
          }

          // Save final progress
          await updateChapterProgressInDB(trackToUpdate.bookId, 0);
          await updateChapterIndexInDB(trackToUpdate.bookId, 0);

          // Reset to beginning and stop
          await TrackPlayer.seekTo(0);
          await TrackPlayer.pause();

          // Reset chapter tracking state
          singleFileChapterState.lastChapterIndex = 0;

          return;
        }
      } else {
        // Multi-file book OR single-chapter book - just update progress normally
        setPlaybackProgress(trackToUpdate.bookId, position);
      }

      await sleepTimer.onProgressTick(position);
    },
  );

  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async (event) => {
    const { track, position } = event;
    const trackToUpdate = await TrackPlayer.getTrack(track);
    if (!trackToUpdate?.bookId) return;

    // Get book data from library store - use isSingleFile from DB to avoid queue race condition
    const book = useLibraryStore.getState().books[trackToUpdate.bookId];

    // Use isSingleFile from database (set at scan time) instead of queue.length
    const isSingleFile = book?.isSingleFile ?? false;

    if (isSingleFile && book && book.chapters && book.chapters.length > 1) {
      // Single-file book with chapters: reset to beginning
      setPlaybackProgress(trackToUpdate.bookId, 0);
      setPlaybackIndex(trackToUpdate.bookId, 0);

      await updateChapterProgressInDB(trackToUpdate.bookId, 0);
      await updateChapterIndexInDB(trackToUpdate.bookId, 0);

      // Reset chapter tracking state
      singleFileChapterState.lastChapterIndex = 0;
      singleFileChapterState.bookId = trackToUpdate.bookId;
    } else if (!isSingleFile && book) {
      // Multi-file book: use track index as chapter index
      setPlaybackProgress(trackToUpdate.bookId, position);
      setPlaybackIndex(trackToUpdate.bookId, track);

      await updateChapterProgressInDB(trackToUpdate.bookId, position);
      await updateChapterIndexInDB(trackToUpdate.bookId, track);
    } else {
      // Single chapter book or book not in Zustand: just reset progress
      setPlaybackProgress(trackToUpdate.bookId, 0);
      await updateChapterProgressInDB(trackToUpdate.bookId, 0);
    }

    // Mark book as finished when queue ends
    const bookModel = await getBookById(trackToUpdate.bookId);
    if (bookModel) {
      await bookModel.updateBookProgress(BookProgressState.Finished);
    }

    // Reset to beginning and stop playback
    if (isSingleFile) {
      await TrackPlayer.seekTo(0);
    } else {
      await TrackPlayer.skip(0);
    }
    await TrackPlayer.stop();
  });

  TrackPlayer.addEventListener(Event.PlaybackState, async (event) => {
    if (
      event.state === State.Paused ||
      event.state === State.Stopped ||
      event.state === State.Buffering
    ) {
      const activeTrack = await TrackPlayer.getActiveTrack();
      if (!activeTrack?.bookId) return;

      const { position } = await TrackPlayer.getProgress();

      // Get book data from library store - use isSingleFile from DB to avoid queue race condition
      const book = useLibraryStore.getState().books[activeTrack.bookId];

      // Use isSingleFile from database (set at scan time) instead of queue.length
      // This eliminates the race condition where queue isn't ready after app restart
      const isSingleFile = book?.isSingleFile ?? false;

      if (
        isSingleFile &&
        book &&
        book.chapters &&
        book.chapters.length > 1
      ) {
        // Single-file book with chapters: save progress within chapter
        const progressWithinChapter = calculateProgressWithinChapter(
          book.chapters,
          position,
        );
        await updateChapterProgressInDB(
          activeTrack.bookId,
          progressWithinChapter,
        );
      } else if (book) {
        // Multi-file book OR single-chapter book: save progress directly
        await updateChapterProgressInDB(activeTrack.bookId, position);
      }
      // If book not in Zustand yet, skip saving to avoid corruption
    }

    if (event.state === State.Paused) {
      await sleepTimer.onPlaybackPaused();
    }

    if (event.state === State.Stopped) {
      await sleepTimer.onPlaybackStopped();
    }

    // On play: resume timer from saved remaining time (if any), or bedtime auto-activate
    if (event.state === State.Playing) {
      lastPlayingStateAt = Date.now();
      await sleepTimer.onPlaybackResumed();
    }
  });

  TrackPlayer.addEventListener(
    Event.PlaybackActiveTrackChanged,
    async (event) => {
      // CRITICAL FIX: Only process valid track indices (>= 0)
      // The event.index can be undefined during queue reset, which would corrupt chapter index
      if (typeof event.index !== 'number' || event.index < 0) return;

      // CRITICAL FIX: Use getTrack(index) instead of getActiveTrack()
      // getActiveTrack() can return stale data during queue transitions
      const trackAtIndex = await TrackPlayer.getTrack(event.index);
      if (!trackAtIndex?.bookId) return;

      // Skip chapter index updates for single-file books - handled in PlaybackProgressUpdated
      const queue = await TrackPlayer.getQueue();
      const isSingleFile = queue.length === 1;
      if (isSingleFile) return;

      // Multi-file book: Update Zustand store immediately for UI reactivity
      setPlaybackIndex(trackAtIndex.bookId, event.index);
      // Update database for persistence
      await updateChapterIndexInDB(trackAtIndex.bookId, event.index);

      // Handle sleep timer chapter countdown (multi-file books only)
      await sleepTimer.onChapterChanged();
    },
  );
};
