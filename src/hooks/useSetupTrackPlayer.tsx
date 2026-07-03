import { useEffect, useRef } from 'react';
import * as MediaLibrary from 'expo-media-library';
import * as Sentry from '@sentry/react-native';
import { usePermission } from '@/contexts/PermissionContext';
import { useQueueStore } from '@/store/queue';
import { setupPlayerCore } from '@/helpers/playerSetup';
import { restoreLastActiveBook } from '@/helpers/restoreLastActiveBook';

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

export const useSetupTrackPlayer = ({
  onLoad,
}: {
  onLoad?: () => void;
}) => {
  const isInitialized = useRef(false);
  const { setAudioPermissionStatus } = usePermission();
  const { setPlayerReady, setPlayerSetupPromise } = useQueueStore();

  useEffect(() => {
    let resolveSetupPromise: () => void = () => {};
    const setupPromise = new Promise<void>((resolve) => {
      resolveSetupPromise = resolve;
    });
    setPlayerSetupPromise(setupPromise);

    const setup = async () => {
      const status = await requestAudioPermission();
      setAudioPermissionStatus(status);
      if (status !== 'granted') {
        setPlayerReady(true);
        resolveSetupPromise();
        onLoad?.();
        return;
      }

      // First, see if the player is already set up. If not, set it up.
      // (A headless start — Android Auto before the UI — may have run
      // ensurePlayerSetup already; setupPlayerCore throws in that case.)
      try {
        await setupPlayerCore();
      } catch (error) {
        console.log('Player was already initialized.');
      }

      // Now that the player is ready, load the last active book.
      try {
        isInitialized.current = true;
        await restoreLastActiveBook();
      } catch (error) {
        isInitialized.current = false;
        console.error('Error during post-setup book loading:', error);
        Sentry.captureException(error, {
          tags: { component: 'useSetupTrackPlayer' },
        });
      } finally {
        // Ensure we always hide the splash screen
        setPlayerReady(true);
        resolveSetupPromise();
        onLoad?.();
      }
    };

    setup();
  }, [
    onLoad,
    setAudioPermissionStatus,
    setPlayerReady,
    setPlayerSetupPromise,
  ]);
};
