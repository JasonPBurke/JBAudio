import TrackPlayer, { Event } from 'react-native-track-player';
import { useLibraryStore } from '@/store/library'; // Changed import
import { updateChapterProgressInDB } from '@/db/chapterQueries';
import database from '@/db';
import BookModel from '@/db/models/Book';

// create a local reference for the `setPlaybackProgress` function
const setPlaybackProgress = useLibraryStore.getState().setPlaybackProgress; // Changed reference

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
      console.log('TrackPlayer.PlaybackProgressUpdated', position, track);
      // get the track to fetch your unique ID property (if applicable)
      const trackToUpdate = await TrackPlayer.getTrack(track);
      console.log('trackToUpdate', trackToUpdate);
      console.log('setPlaybackProgress called with:', {
        bookId: trackToUpdate.bookId,
        position,
      }); // Added console log
      // write progress to the zustand store
      setPlaybackProgress(trackToUpdate.bookId, position); // Changed function call
    }
  );
  // New listener for when a track finishes
  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async (event) => {
    const { track, position } = event;

    console.log('TrackPlayer.PlaybackQueueEnded', event);

    // Perform the WatermelonDB update here
    await updateChapterProgressInDB(track, position);
  });
  TrackPlayer.addEventListener(Event.ActiveTrackChanged, async (event) => {
    const { track, position } = event;

    console.log('TrackPlayer.PlaybackQueueEnded', event);

    // Perform the WatermelonDB update here
    await updateChapterProgressInDB(track, position);
  });
  // Add other remote event listeners as needed (e.g., RemoteStop, RemoteSeek)
};
