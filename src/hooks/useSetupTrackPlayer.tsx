import { useEffect, useRef } from 'react';
import TrackPlayer, {
  AndroidAudioContentType,
  Capability,
  RepeatMode,
  Track,
} from 'react-native-track-player';
import * as MediaLibrary from 'expo-media-library';
import { usePermission } from '@/contexts/PermissionContext';
import { getLastActiveBook } from '@/db/settingsQueries';
import { useLibraryStore } from '@/store/library';
import { useQueueStore } from '@/store/queue';
import { getChapterProgressInDB } from '@/db/chapterQueries';
import { unknownBookImageUri } from '@/constants/images';

async function requestAudioPermission(): Promise<
  'granted' | 'denied' | 'undetermined'
> {
  // Check for existing permissions
  const { status: existingStatus } =
    await MediaLibrary.getPermissionsAsync();
  if (existingStatus === 'granted') {
    return 'granted';
  }

  // If not granted, request permissions
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status === 'granted') {
    return 'granted';
  } else {
    return 'denied';
  }
}

const setupPlayer = async () => {
  const userJumpInterval = 30;
  await TrackPlayer.setupPlayer({
    autoHandleInterruptions: true,
    androidAudioContentType: AndroidAudioContentType.Speech,
    maxCacheSize: 1024 * 10, //* more useful for server access of media
  });

  await TrackPlayer.updateOptions({
    progressUpdateEventInterval: 1,
    forwardJumpInterval: userJumpInterval,
    backwardJumpInterval: userJumpInterval,
    capabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.JumpForward,
      Capability.JumpBackward,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
      Capability.SeekTo,
      Capability.Stop,
    ],
  });

  await TrackPlayer.setRepeatMode(RepeatMode.Off);
};

export const useSetupTrackPlayer = ({
  onLoad,
}: {
  onLoad?: () => void;
}) => {
  const isInitialized = useRef(false);
  const { setAudioPermissionStatus } = usePermission();
  const { setActiveBookId, setPlayerReady } = useQueueStore();

  useEffect(() => {
    const setup = async () => {
      const status = await requestAudioPermission();
      setAudioPermissionStatus(status);
      if (status !== 'granted') {
        setPlayerReady(true);
        onLoad?.();
        return;
      }

      // First, see if the player is already set up. If not, set it up.
      try {
        await setupPlayer();
      } catch (error) {
        console.log('Player was already initialized.');
      }

      // Now that the player is ready, load the last active book.
      try {
        isInitialized.current = true;
        const lastActiveBookId = await getLastActiveBook();
        if (lastActiveBookId) {
          const book = useLibraryStore.getState().books[lastActiveBookId];
          if (book) {
            const queue = await TrackPlayer.getQueue();
            // Only load tracks if queue is empty or has the wrong book.
            if (!queue.length || queue[0]?.bookId !== lastActiveBookId) {
              await TrackPlayer.reset();
              const tracks: Track[] = book.chapters.map((chapter) => ({
                url: chapter.url,
                title: chapter.chapterTitle,
                artist: book.author,
                artwork: book.artwork ?? unknownBookImageUri,
                album: book.bookTitle,
                bookId: book.bookId,
              }));

              const progressInfo = await getChapterProgressInDB(book.bookId);
              await TrackPlayer.add(tracks);

              if (progressInfo?.chapterIndex) {
                await TrackPlayer.skip(progressInfo.chapterIndex);
                await TrackPlayer.seekTo(progressInfo.progress || 0);
              }
            }
            // Always update the active book in our own state
            setActiveBookId(book.bookId);
          }
        }
      } catch (error) {
        isInitialized.current = false;
        console.error('Error during post-setup book loading:', error);
      } finally {
        // Ensure we always hide the splash screen
        setPlayerReady(true);
        onLoad?.();
      }
    };

    setup();
  }, [onLoad, setAudioPermissionStatus, setActiveBookId, setPlayerReady]);
};
