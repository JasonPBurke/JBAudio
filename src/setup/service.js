import TrackPlayer, { Event, State } from 'react-native-track-player';
import { useLibraryStore } from '@/store/library';
import {
  getTimerSettings,
  updateSleepTime,
  updateTimerActive,
  updateChapterTimer,
  getTimerFadeoutDuration,
} from '@/db/settingsQueries';
import {
  updateChapterProgressInDB,
  updateChapterIndexInDB,
} from '@/db/chapterQueries';

const { setPlaybackIndex, setPlaybackProgress } =
  useLibraryStore.getState();

// Sleep timer fade state (module-scope)
let fadeState = {
  isFading: false,
  baselineVolume: 1,
  lastAppliedVolume: 1,
  lastSetVolumeAt: 0,
};

// Cached timer settings to avoid DB reads each tick
let cachedTimer = {
  sleepTime: null,
  timerActive: false,
  fadeoutDuration: 0,
  lastRefreshedAt: 0,
};

// Refresh interval for cached settings (ms)
const SETTINGS_REFRESH_INTERVAL = 1000; // 1s is enough for UI updates
// Throttle interval for volume updates (ms)
const VOLUME_THROTTLE_MS = 100;
//! these will come from the settings db
const skip_back_duration = 30;
const skip_forward_duration = 30;

export default module.exports = async function () {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () =>
    TrackPlayer.pause()
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
    TrackPlayer.skipToNext()
  );
  TrackPlayer.addEventListener(Event.RemotePrevious, () =>
    TrackPlayer.skipToPrevious()
  );

  TrackPlayer.addEventListener(
    Event.PlaybackProgressUpdated,
    async ({ position, track }) => {
      //? event {"buffered": 107.232, "duration": 4626.991, "position": 0.526, "track": 3}
      const trackToUpdate = await TrackPlayer.getTrack(track);

      //? trackToUpdate ["title", "album", "url", "artwork", "bookId", "artist"]
      setPlaybackProgress(trackToUpdate.bookId, position - 1);

      // Refresh cached settings at most every SETTINGS_REFRESH_INTERVAL
      const nowTs = Date.now();
      if (
        !cachedTimer.lastRefreshedAt ||
        nowTs - cachedTimer.lastRefreshedAt >= SETTINGS_REFRESH_INTERVAL
      ) {
        const { sleepTime, timerActive } = await getTimerSettings();
        const fadeoutDuration = await getTimerFadeoutDuration();
        cachedTimer.sleepTime = sleepTime;
        cachedTimer.timerActive = !!timerActive;
        cachedTimer.fadeoutDuration =
          typeof fadeoutDuration === 'number' ? fadeoutDuration : 0;
        cachedTimer.lastRefreshedAt = nowTs;
      }

      const { sleepTime, timerActive, fadeoutDuration } = cachedTimer;

      // Single source of truth for stopping at or after sleep time for both fade and non-fade
      if (
        sleepTime !== null &&
        timerActive === true &&
        sleepTime <= Date.now()
      ) {
        // End of timer reached: ensure pause and cleanup
        const usedFade =
          typeof fadeoutDuration === 'number' && fadeoutDuration > 0;

        // If fading was enabled, ensure we end at silence at exactly sleep time
        if (usedFade) {
          await TrackPlayer.setVolume(0);
        }

        await TrackPlayer.setVolume(0);
        await TrackPlayer.pause();

        // In this app model, internal TrackPlayer volume is always 1 except during fade.
        // Restore it to 1 so next playback is audible and consistent.
        if (usedFade) {
          await TrackPlayer.setVolume(1);
        }

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
        if (now < beginFadeout && fadeState.isFading) {
          // If the timer is reset to be longer than the fadeout,
          // and a fade was already in progress, reset volume to 1.
          await TrackPlayer.setVolume(1);
          fadeState.isFading = false;
          fadeState.lastAppliedVolume = 1;
          fadeState.baselineVolume = 1;
        }
        const now = Date.now();
        const beginFadeout = sleepTime - fadeoutDuration;

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
            Math.max(0, (now - beginFadeout) / fadeoutDuration)
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
    }
  );

  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async (event) => {
    const { track, position } = event;
    const steppedPosition = position - 1;
    //?trackToUpdate.bookId ["title", "album", "url", "artwork", "bookId", "artist"]
    const trackToUpdate = await TrackPlayer.getTrack(track);
    // Perform the WatermelonDB update here
    setPlaybackProgress(trackToUpdate.bookId, steppedPosition);
    setPlaybackIndex(trackToUpdate.bookId, track);

    await updateChapterProgressInDB(trackToUpdate.bookId, steppedPosition);
    await updateChapterIndexInDB(trackToUpdate.bookId, track);
  });

  TrackPlayer.addEventListener(Event.PlaybackState, async (event) => {
    if (
      event.state === State.Paused ||
      event.state === State.Stopped ||
      event.state === State.Buffering
    ) {
      const { bookId } = await TrackPlayer.getActiveTrack();
      const { position } = await TrackPlayer.getProgress();
      await updateChapterProgressInDB(bookId, position - 1);
    }
    if (event.state === State.Stopped) {
      await updateChapterTimer(null);
      updateTimerActive(false);
    }
  });

  TrackPlayer.addEventListener(
    Event.PlaybackActiveTrackChanged,
    async (event) => {
      const { timerChapters, timerActive } = await getTimerSettings();
      if (timerActive && timerChapters !== null && timerChapters > 0) {
        await updateChapterTimer(timerChapters - 1);
      } else if (timerActive && timerChapters === 0) {
        await TrackPlayer.setVolume(0);
        await TrackPlayer.pause();
        updateTimerActive(false);
      }
    }
  );
};
