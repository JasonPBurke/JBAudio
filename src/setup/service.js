import TrackPlayer, { Event, State } from 'react-native-track-player';
import { useLibraryStore } from '@/store/library';
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

const { setPlaybackIndex, setPlaybackProgress } =
  useLibraryStore.getState();

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

      if (
        sleepTime !== null &&
        timerActive === true &&
        sleepTime <= Date.now()
      ) {
        await TrackPlayer.pause();
        updateTimerActive(false);
        updateSleepTime(null);
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
