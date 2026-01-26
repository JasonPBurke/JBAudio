import { useEffect, useRef } from 'react';
import TrackPlayer, {
  AndroidAudioContentType,
  Capability,
  RepeatMode,
  Track,
} from 'react-native-track-player';
import * as MediaLibrary from 'expo-media-library';
import * as Sentry from '@sentry/react-native';
import { usePermission } from '@/contexts/PermissionContext';
import { getLastActiveBook } from '@/db/settingsQueries';
import { getBookWithChaptersForRestoration } from '@/db/bookQueries';
import { useQueueStore } from '@/store/queue';
import { getChapterProgressInDB } from '@/db/chapterQueries';
import { unknownBookImageUri } from '@/constants/images';
import {
  isSingleFileBook,
  calculateAbsolutePosition,
  hasValidChapterData,
} from '@/helpers/singleFileBook';

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
    maxCacheSize: 1024 * 5,
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
    notificationCapabilities: [
      Capability.Play,
      Capability.JumpForward,
      Capability.JumpBackward,
      Capability.Stop,
      // Capability.SeekTo,
      // Capability.Pause,
    ],
    //! this is the default behavior already
    // android: {
    //   appKilledPlaybackBehavior: 'ContinuePlayback' as any,
    // },
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
          // Read directly from WatermelonDB to avoid race condition with Zustand store
          // The store may not be populated yet when this runs during app startup
          const bookData = await getBookWithChaptersForRestoration(lastActiveBookId);
          if (!bookData) {
            console.warn('Position restoration: Book not found in database');
            setPlayerReady(true);
            onLoad?.();
            return;
          }

          const { chapters, ...bookInfo } = bookData;

          const queue = await TrackPlayer.getQueue();
          // Only load tracks if queue is empty or has the wrong book.
          if (!queue.length || queue[0]?.bookId !== lastActiveBookId) {
            await TrackPlayer.reset();

            const singleFile = isSingleFileBook(chapters);
            const progressInfo = await getChapterProgressInDB(bookInfo.bookId);

            if (singleFile) {
              // Single-file book: load only 1 track
              // Use chapter title/duration when valid chapter data exists
              const hasChapterData = hasValidChapterData(chapters);
              const chapterIndex = progressInfo?.chapterIndex || 0;
              const validChapterIndex = Math.min(chapterIndex, chapters.length - 1);
              const initialChapter = hasChapterData ? chapters[validChapterIndex] : null;

              const track: Track = {
                url: chapters[0].url,
                title: initialChapter?.chapterTitle ?? bookInfo.bookTitle,
                artist: bookInfo.author,
                artwork: bookInfo.artwork ?? unknownBookImageUri,
                album: bookInfo.bookTitle,
                bookId: bookInfo.bookId,
                duration: initialChapter?.chapterDuration,
              };
              await TrackPlayer.add(track);

              // Restore position by calculating absolute position from chapter + progress
              if (progressInfo) {
                const absolutePosition = calculateAbsolutePosition(
                  chapters,
                  progressInfo.chapterIndex || 0,
                  progressInfo.progress || 0
                );

                // Validate position is within bounds
                if (absolutePosition < 0 || absolutePosition > bookInfo.bookDuration) {
                  Sentry.captureMessage('Position restoration: Out of bounds', {
                    level: 'warning',
                    extra: {
                      bookId: lastActiveBookId,
                      chapterIndex: progressInfo.chapterIndex,
                      progress: progressInfo.progress,
                      calculatedPosition: absolutePosition,
                      bookDuration: bookInfo.bookDuration,
                      chapterCount: chapters.length,
                    },
                  });
                  // Clamp to valid range
                  const clampedPosition = Math.max(0, Math.min(absolutePosition, bookInfo.bookDuration - 1));
                  await TrackPlayer.seekTo(clampedPosition);
                } else {
                  await TrackPlayer.seekTo(absolutePosition);
                }

                Sentry.addBreadcrumb({
                  category: 'position-restoration',
                  message: 'Single-file position restored',
                  data: {
                    bookId: lastActiveBookId,
                    bookTitle: bookInfo.bookTitle,
                    chapterIndex: progressInfo.chapterIndex,
                    progress: progressInfo.progress,
                    absolutePosition,
                    chapterCount: chapters.length,
                  },
                  level: 'info',
                });
              }
            } else {
              // Multi-file book: load N tracks (one per chapter)
              const tracks: Track[] = chapters.map((chapter) => ({
                url: chapter.url,
                title: chapter.chapterTitle,
                artist: bookInfo.author,
                artwork: bookInfo.artwork ?? unknownBookImageUri,
                album: bookInfo.bookTitle,
                bookId: bookInfo.bookId,
                duration: chapter.chapterDuration,
              }));

              await TrackPlayer.add(tracks);

              if (progressInfo?.chapterIndex !== undefined && progressInfo.chapterIndex !== null) {
                // Validate chapter index is within bounds
                if (progressInfo.chapterIndex >= chapters.length) {
                  Sentry.captureMessage('Position restoration: Invalid chapter index', {
                    level: 'warning',
                    extra: {
                      bookId: lastActiveBookId,
                      chapterIndex: progressInfo.chapterIndex,
                      chapterCount: chapters.length,
                    },
                  });
                  // Fall back to last valid chapter
                  const safeChapterIndex = Math.max(0, chapters.length - 1);
                  await TrackPlayer.skip(safeChapterIndex);
                } else if (progressInfo.chapterIndex > 0) {
                  await TrackPlayer.skip(progressInfo.chapterIndex);
                  await TrackPlayer.seekTo(progressInfo.progress || 0);
                } else {
                  // chapterIndex is 0, just seek within first track
                  await TrackPlayer.seekTo(progressInfo.progress || 0);
                }

                Sentry.addBreadcrumb({
                  category: 'position-restoration',
                  message: 'Multi-file position restored',
                  data: {
                    bookId: lastActiveBookId,
                    bookTitle: bookInfo.bookTitle,
                    chapterIndex: progressInfo.chapterIndex,
                    progress: progressInfo.progress,
                    chapterCount: chapters.length,
                  },
                  level: 'info',
                });
              }
            }
          }
          // Always update the active book in our own state
          setActiveBookId(bookInfo.bookId);
        }
      } catch (error) {
        isInitialized.current = false;
        console.error('Error during post-setup book loading:', error);
        Sentry.captureException(error, {
          tags: { component: 'useSetupTrackPlayer' },
        });
      } finally {
        // Ensure we always hide the splash screen
        setPlayerReady(true);
        onLoad?.();
      }
    };

    setup();
  }, [onLoad, setAudioPermissionStatus, setActiveBookId, setPlayerReady]);
};
