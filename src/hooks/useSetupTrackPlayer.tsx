import { useEffect, useRef } from 'react';
import TrackPlayer, {
  AndroidAudioContentType,
  Capability,
  RepeatMode,
  Track,
} from 'react-native-track-player';
import * as MediaLibrary from 'expo-media-library';
import { usePermission } from '@/contexts/PermissionContext';
import {
  getLastActiveBook,
  updateLastActiveBook,
} from '@/db/settingsQueries';
import { getBookById } from '@/db/bookQueries';
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
    console.log('Audio access already granted!');
    return 'granted';
  }

  // If not granted, request permissions
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status === 'granted') {
    console.log('Audio access granted!');
    return 'granted';
  } else {
    console.log('Audio access denied.');
    return 'denied';
  }
}

const setupPlayer = async () => {
  const userJumpInterval = 30;
  await TrackPlayer.setupPlayer({
    autoHandleInterruptions: true,
    androidAudioContentType: AndroidAudioContentType.Speech,
    maxCacheSize: 1024 * 10, //* more useful for server access of media
    // autoUpdateMetadata: false,
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
        // console.log('Player was already initialized.');
      }
      console.log('before second try');
      // Now that the player is ready, load the last active book.
      try {
        isInitialized.current = true;
        const lastActiveBookId = await getLastActiveBook();
        if (lastActiveBookId) {
          const book = await getBookById(lastActiveBookId);
          if (book) {
            const queue = await TrackPlayer.getQueue();
            // Only load tracks if queue is empty or has the wrong book.
            if (!queue.length || queue[0]?.bookId !== lastActiveBookId) {
              await TrackPlayer.reset();
              const chapters = await (book.chapters as any).fetch();
              const tracks: Track[] = chapters.map((chapter: any) => ({
                url: chapter.url,
                title: chapter.title,
                artist: book.narrator ?? 'Unknown',
                artwork: book.artwork ?? unknownBookImageUri,
                album: book.title,
                bookId: book.id,
              }));
              const progressInfo = await getChapterProgressInDB(book.id);
              await TrackPlayer.add(tracks);
              if (progressInfo?.chapterIndex) {
                await TrackPlayer.skip(progressInfo.chapterIndex);
              }
            }
            // Always update the active book in our own state
            setActiveBookId(book.id);
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
