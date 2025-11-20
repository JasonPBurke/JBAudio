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
};

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
    TrackPlayer.seekBy(30);
  });
  TrackPlayer.addEventListener(Event.RemoteJumpBackward, () => {
    TrackPlayer.seekBy(-30);
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

      const { sleepTime, timerActive } = await getTimerSettings();
      const fadeoutDuration = await getTimerFadeoutDuration();

      // Single source of truth for stopping at or after sleep time for both fade and non-fade
      if (
        sleepTime !== null &&
        timerActive === true &&
        sleepTime <= Date.now()
      ) {
        // End of timer reached: ensure pause and cleanup
        fadeState.isFading = false;
        fadeState.baselineVolume = 1;
        // Set volume to 0 only if fade was used; otherwise leave as-is
        if (typeof fadeoutDuration === 'number' && fadeoutDuration > 0) {
          await TrackPlayer.setVolume(0);
        }
        await TrackPlayer.pause();
        await TrackPlayer.setVolume(1);
        updateTimerActive(false);
        updateSleepTime(null);
        return; // nothing more to do on this tick
      }

      // const fadeoutTimePoints = [
      //   0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.75, 0.85, 0.9, 0.95, 0.96, 0.97, 0.98,
      //   0.99, 1,
      // ];
      // const fadeoutPercentages = [
      //   95, 90, 85, 80, 75, 65, 50, 40, 30, 25, 20, 15, 10, 5, 0,
      // ];
      // const fadeoutTimes = [{0: 95}, {.1: 90}, {.2: 85}, {.3: 80}, {.4: 75}, {.5: 65}, {.75: 50}, {.85: 40}, {.9: 30}, {.95: 25}, {.96: 20}, {.97: 15}, {.98: 10}, {.99: 5}, {1: 0}]

      //! this is a starting point and will fine tune later
      // const fadeoutTimePoints = [.01, 0.2, 0.4, 0.6, 0.8, 1]; // 1 = beginFadeout 0=stop
      // const fadeoutPercentages = [.9, .8, .6, .4, .2, 0];

      // const fadeoutTimePointsReversed = [.8, .6, .4, .2, .01];
      // const fadeoutPercentagesReversed = [.20, .40, .60, .80, .90];

      //* fadeout timer logic
      if (
        sleepTime !== null &&
        timerActive &&
        typeof fadeoutDuration === 'number' &&
        fadeoutDuration > 0
      ) {
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
            try {
              const currentVol = await TrackPlayer.getVolume?.();
              if (typeof currentVol === 'number') {
                fadeState.baselineVolume = Math.max(
                  0,
                  Math.min(1, currentVol)
                );
              } else {
                fadeState.baselineVolume = 1;
              }
            } catch {
              fadeState.baselineVolume = 1;
            }
            fadeState.lastAppliedVolume = fadeState.baselineVolume;
          }
          // Compute linear fade from baseline -> 0
          const t = Math.min(
            1,
            Math.max(0, (now - beginFadeout) / fadeoutDuration)
          );
          const volume = Math.max(0, fadeState.baselineVolume * (1 - t));

          // Only set if change is meaningful
          if (Math.abs(volume - fadeState.lastAppliedVolume) >= 0.01) {
            await TrackPlayer.setVolume(volume);
            fadeState.lastAppliedVolume = volume;
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
        await TrackPlayer.pause();
        updateTimerActive(false);
      }
    }
  );
};
