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
      //? event {"buffered": 107.232, "duration": 4626.991, "position": 0.526, "track": 3}
      const trackToUpdate = await TrackPlayer.getTrack(track);

      // console.log('trackToUpdate.bookId', Object.keys(trackToUpdate));
      // console.log('event', event.position);
      // console.log('trackToUpdate', trackToUpdate.bookId);
      // console.log('PlaybackProgressUpdated on book:', trackToUpdate.name);

      //? trackToUpdate ["title", "album", "url", "artwork", "bookId", "artist"]
      // write progress to the zustand store
      setPlaybackProgress(trackToUpdate.bookId, position);
    }
  );
  // New listener for when a track finishes
  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async (event) => {
    const { track, position } = event;
    //?trackToUpdate.bookId ["title", "album", "url", "artwork", "bookId", "artist"]
    const trackToUpdate = await TrackPlayer.getTrack(track);
    // Perform the WatermelonDB update here
    //! if the queue is empty, we should reset the progress to 0 as the book has finished
    await updateChapterProgressInDB(trackToUpdate.bookId, position); //! maybe -1 if completed
  });
  // TrackPlayer.addEventListener(
  //   Event.PlaybackActiveTrackChanged,
  //   async (event) => {
  //     const { track, position } = event;
  //     const trackToUpdate = await TrackPlayer.getTrack(track);

  //     //* don't want to update state in this case, only DB
  //     // setPlaybackProgress(event.track.bookId, event.lastPosition);
  //     //* reset the DB progress to 0 when the track changes
  //     await updateChapterProgressInDB(trackToUpdate.bookId, position);

  //     // Perform the WatermelonDB update here
  //     // await updateChapterProgressInDB(
  //     //   console.log('using updateChapterProgressInDB'),
  //     //   event.track.bookId,
  //     //   event.lastPosition
  //     // ).then((res) => {
  //     //   console.log('updateChapterProgressInDB', res);
  //     // });
  //   }
  // );
};
