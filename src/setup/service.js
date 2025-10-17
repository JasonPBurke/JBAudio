import TrackPlayer, { Event } from 'react-native-track-player';
import database from '@/db';
import BookModel from '@/db/models/Book';

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
      console.log('PlaybackProgressUpdated event:', position, track);
      // get the track to fetch your unique ID property (if applicable)
      const trackToUpdate = await TrackPlayer.getTrack(track);
      // const bookToUpdate = await database.collections.get
      //! update progress and track queue index to database
      console.log('trackToUpdate', trackToUpdate);
      if (trackToUpdate?.id) {
        await database.write(async () => {
          const book = await database.collections
            .get('books')
            .find(trackToUpdate.id);
          await book.update((record) => {
            record.currentChapterProgress = position;
          });
        });
      }
    }
  );
  // Add other remote event listeners as needed (e.g., RemoteStop, RemoteSeek)
};
