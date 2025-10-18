import TrackPlayer, { Event } from 'react-native-track-player';
import { useLibraryStore } from '@/store/library';
import { updateChapterProgressInDB } from '@/db/chapterQueries';

// create a local reference for the `setPlaybackProgress` function
const setPlaybackProgress = useLibraryStore.getState().setPlaybackProgress;

export default module.exports = async function () {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () =>
    TrackPlayer.pause()
  );
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.stop());
  TrackPlayer.addEventListener(Event.RemoteSeek, ({ position }) => {
    console.log('TrackPlayer.RemoteSeek', position);
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
      const trackToUpdate = await TrackPlayer.getTrack(track);

      // write progress to the zustand store
      setPlaybackProgress(trackToUpdate.bookId, position);
    }
  );
  // New listener for when a track finishes
  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async (event) => {
    const { track, position } = event;

    // Perform the WatermelonDB update here
    //! if the queue is empty, we should reset the progress to 0 as the book has finished
    await updateChapterProgressInDB(track.bookId, position);
  });
  TrackPlayer.addEventListener(
    Event.PlaybackActiveTrackChanged,
    async (event) => {
      setPlaybackProgress(event.track.bookId, event.lastPosition);

      // Perform the WatermelonDB update here
      await updateChapterProgressInDB(
        event.track.bookId,
        event.lastPosition
      );
    }
  );
};
