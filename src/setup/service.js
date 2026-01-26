import TrackPlayer, { Event, State } from 'react-native-track-player';
import { useLibraryStore } from '@/store/library';
import { usePlayerStateStore } from '@/store/playerState';
import {
  getTimerSettings,
  updateSleepTime,
  updateTimerActive,
  updateChapterTimer,
} from '@/db/settingsQueries';
import {
  updateChapterProgressInDB,
  updateChapterIndexInDB,
} from '@/db/chapterQueries';
import { getBookById } from '@/db/bookQueries';
import { isWithinBedtimeWindow } from '@/helpers/bedtimeUtils';
import { BookProgressState } from '@/helpers/handleBookPlay';
import { recordFootprint } from '@/db/footprintQueries';
import {
  findChapterIndexByPosition,
  calculateProgressWithinChapter,
  hasValidChapterData,
} from '@/helpers/singleFileBook';

const { setPlaybackIndex, setPlaybackProgress } =
  useLibraryStore.getState();
const { setRemainingSleepTimeMs } = usePlayerStateStore.getState();

// Sleep timer fade state (module-scope)
let fadeState = {
  isFading: false,
  baselineVolume: 1,
  lastAppliedVolume: 1,
  lastSetVolumeAt: 0,
};

// Single-file book chapter tracking state (module-scope)
let singleFileChapterState = {
  lastChapterIndex: -1,
  bookId: null,
};

// Cached timer settings to avoid DB reads each tick
let cachedTimer = {
  sleepTime: null,
  timerActive: false,
  fadeoutDuration: 0,
  lastRefreshedAt: 0,
  // Bedtime fields
  bedtimeModeEnabled: false,
  bedtimeStart: null,
  bedtimeEnd: null,
  timerDuration: null,
  timerChapters: null,
};

// Refresh interval for cached settings (ms)
const SETTINGS_REFRESH_INTERVAL = 1000; // 1s is enough for UI updates
// Throttle interval for volume updates (ms)
const VOLUME_THROTTLE_MS = 100;
//! these will come from the settings db
const skip_back_duration = 30;
const skip_forward_duration = 30;

// Periodic progress save interval (defense in depth for force-close scenarios)
const PROGRESS_SAVE_INTERVAL = 30000; // 30 seconds
let lastProgressSaveTime = 0;

export default module.exports = async function () {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () =>
    TrackPlayer.pause(),
  );
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.stop());
  TrackPlayer.addEventListener(Event.RemoteSeek, ({ position }) => {
    TrackPlayer.seekTo(position);
  });
  TrackPlayer.addEventListener(Event.RemoteJumpForward, () => {
    TrackPlayer.seekBy(skip_forward_duration);
  });
  TrackPlayer.addEventListener(Event.RemoteJumpBackward, () => {
    TrackPlayer.seekBy(-skip_back_duration);
  });
  TrackPlayer.addEventListener(Event.RemoteNext, () =>
    TrackPlayer.skipToNext(),
  );
  TrackPlayer.addEventListener(Event.RemotePrevious, () =>
    TrackPlayer.skipToPrevious(),
  );

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

      if (isSingleFile && book && book.chapters && book.chapters.length > 1) {
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
              singleFileChapterState.lastChapterIndex !==
                currentChapterIndex;

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
              const { timerChapters, timerActive } =
                await getTimerSettings();
              if (
                timerActive &&
                timerChapters !== null &&
                timerChapters > 0
              ) {
                await updateChapterTimer(timerChapters - 1);
              } else if (timerActive && timerChapters === 0) {
                await TrackPlayer.setVolume(0);
                await TrackPlayer.pause();
                await TrackPlayer.setVolume(1);
                await updateTimerActive(false);
              }
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
              await bookModel.updateBookProgress(
                BookProgressState.Finished,
              );
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

      // Refresh cached settings at most every SETTINGS_REFRESH_INTERVAL
      const nowTs = Date.now();
      if (
        !cachedTimer.lastRefreshedAt ||
        nowTs - cachedTimer.lastRefreshedAt >= SETTINGS_REFRESH_INTERVAL
      ) {
        const timerSettings = await getTimerSettings();
        cachedTimer.sleepTime = timerSettings.sleepTime;
        cachedTimer.timerActive = !!timerSettings.timerActive;
        cachedTimer.fadeoutDuration =
          typeof timerSettings.fadeoutDuration === 'number'
            ? timerSettings.fadeoutDuration
            : 0;
        // Bedtime fields
        cachedTimer.bedtimeModeEnabled = !!timerSettings.bedtimeModeEnabled;
        cachedTimer.bedtimeStart = timerSettings.bedtimeStart;
        cachedTimer.bedtimeEnd = timerSettings.bedtimeEnd;
        cachedTimer.timerDuration = timerSettings.timerDuration;
        cachedTimer.timerChapters = timerSettings.timerChapters;
        cachedTimer.lastRefreshedAt = nowTs;
      }

      const { sleepTime, timerActive, fadeoutDuration } = cachedTimer;

      // // Debug: trace timer logic
      // console.log('[TIMER DEBUG]', {
      //   sleepTime,
      //   timerActive,
      //   fadeoutDuration,
      //   now: Date.now(),
      //   shouldStop: sleepTime !== null && timerActive === true && sleepTime <= Date.now(),
      //   sleepTimeCheck: sleepTime !== null,
      //   timerActiveCheck: timerActive === true,
      //   timeCheck: sleepTime ? sleepTime <= Date.now() : 'N/A',
      // });

      // Single source of truth for stopping at or after sleep time for both fade and non-fade
      if (
        sleepTime !== null &&
        timerActive === true &&
        sleepTime <= Date.now()
      ) {
        // console.log('[TIMER DEBUG] Timer stop condition met! Stopping playback...');
        // End of timer reached: ensure pause and cleanup
        const usedFade =
          typeof fadeoutDuration === 'number' && fadeoutDuration > 0;

        // If fading was enabled, ensure we end at silence at exactly sleep time
        if (usedFade) {
          await TrackPlayer.setVolume(0);
        }

        await TrackPlayer.pause();
        await TrackPlayer.setVolume(1);

        // Cleanup state (reflect restored volume = 1)
        fadeState.isFading = false;
        fadeState.lastAppliedVolume = 1;
        fadeState.baselineVolume = 1;

        updateTimerActive(false);
        updateSleepTime(null);
        return; // nothing more to do on this tick
      }

      //* fadeout timer logic
      if (
        sleepTime !== null &&
        timerActive &&
        typeof fadeoutDuration === 'number' &&
        fadeoutDuration > 0
      ) {
        const now = Date.now();
        const beginFadeout = sleepTime - fadeoutDuration;

        if (now < beginFadeout && fadeState.isFading) {
          // If the timer is reset to be longer than the fadeout,
          // and a fade was already in progress, reset volume to 1.
          await TrackPlayer.setVolume(1);
          fadeState.isFading = false;
          fadeState.lastAppliedVolume = 1;
          fadeState.baselineVolume = 1;
        }

        if (now < beginFadeout) {
          // Before fade window: reset fade state and don't force user volume
          if (fadeState.isFading) {
            fadeState.isFading = false;
            fadeState.baselineVolume = 1;
          }
        } else if (now >= beginFadeout && now < sleepTime) {
          // Entering fade window: capture baseline once
          if (!fadeState.isFading) {
            fadeState.isFading = true;
            // In this app, TrackPlayer internal volume is always 1 before fade.
            fadeState.baselineVolume = 1;
            fadeState.lastAppliedVolume = 1;
          }
          // Compute linear fade from baseline -> 0
          const t = Math.min(
            1,
            Math.max(0, (now - beginFadeout) / fadeoutDuration),
          );
          const volume = Math.max(0, fadeState.baselineVolume * (1 - t));

          // Only set if change is meaningful and respect throttle
          const nowSet = Date.now();
          if (
            Math.abs(volume - fadeState.lastAppliedVolume) >= 0.01 &&
            nowSet - fadeState.lastSetVolumeAt >= VOLUME_THROTTLE_MS
          ) {
            await TrackPlayer.setVolume(volume);
            fadeState.lastAppliedVolume = volume;
            fadeState.lastSetVolumeAt = nowSet;
          }
        }
        // When now >= sleepTime the earlier single-source block already handled stopping/cleanup
      }
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

      if (isSingleFile && book && book.chapters && book.chapters.length > 1) {
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

    // On pause: freeze the timer by saving remaining time
    if (event.state === State.Paused) {
      const { sleepTime, timerActive } = await getTimerSettings();
      if (timerActive && sleepTime !== null) {
        const remaining = Math.max(0, sleepTime - Date.now());
        setRemainingSleepTimeMs(remaining);
      }
    }

    if (event.state === State.Stopped) {
      await updateChapterTimer(null);
      await updateTimerActive(false);
      setRemainingSleepTimeMs(null);
    }

    // On play: resume timer from saved remaining time (if any)
    if (event.state === State.Playing) {
      const playerState = usePlayerStateStore.getState();
      const remainingMs = playerState.remainingSleepTimeMs;

      if (remainingMs !== null && remainingMs > 0) {
        // Resume timer: recalculate sleepTime from remaining duration
        await updateSleepTime(Date.now() + remainingMs);
        setRemainingSleepTimeMs(null);
      }

      const timerSettings = await getTimerSettings();

      // Check all conditions for bedtime mode activation:
      // 1. Bedtime mode is enabled
      // 2. Timer is not already active
      // 3. Current time is within bedtime window
      // 4. A timer duration or chapter count is configured
      if (
        timerSettings.bedtimeModeEnabled &&
        !timerSettings.timerActive &&
        isWithinBedtimeWindow(
          timerSettings.bedtimeStart,
          timerSettings.bedtimeEnd,
        )
      ) {
        // Record footprint for bedtime auto-activation
        try {
          const activeTrack = await TrackPlayer.getActiveTrack();
          if (activeTrack?.bookId) {
            await recordFootprint(activeTrack.bookId, 'timer_activation');
          }
        } catch {
          // Silently fail if footprint recording fails
        }

        // Activate the timer based on what's configured
        if (timerSettings.timerDuration !== null) {
          await updateTimerActive(true);
          await updateSleepTime(Date.now() + timerSettings.timerDuration);
        } else if (timerSettings.timerChapters !== null) {
          await updateTimerActive(true);
          // Chapter timer doesn't need sleepTime
        }
      }
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
      const { timerChapters, timerActive } = await getTimerSettings();
      if (timerActive && timerChapters !== null && timerChapters > 0) {
        await updateChapterTimer(timerChapters - 1);
      } else if (timerActive && timerChapters === 0) {
        await TrackPlayer.setVolume(0);
        await TrackPlayer.pause();
        await TrackPlayer.setVolume(1);
        await updateTimerActive(false);
      }
    },
  );
};
