import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useRouter } from 'expo-router';
import { usePlayerStateStore } from '@/store/playerState';
import { useQueueStore } from '@/store/queue';

/**
 * Hook to restore the player screen when app returns from background.
 *
 * This hook should be used ONCE at the root level of the app (_layout.tsx).
 * It listens for AppState changes and restores the player screen when:
 * 1. App transitions from background to active
 * 2. The player screen was dismissed due to backgrounding
 * 3. The player is ready (TrackPlayer is initialized)
 *
 * @example
 * // In src/app/_layout.tsx
 * const App = () => {
 *   usePlayerScreenRestoration();
 *   // ... rest of component
 * };
 */
export const usePlayerScreenRestoration = () => {
  const router = useRouter();
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const wasPlayerScreenDismissedToBackground = usePlayerStateStore(
    (state) => state.wasPlayerScreenDismissedToBackground
  );
  const setWasPlayerScreenDismissedToBackground = usePlayerStateStore(
    (state) => state.setWasPlayerScreenDismissedToBackground
  );
  const isPlayerReady = useQueueStore((state) => state.isPlayerReady);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState) => {
        // Check if coming FROM background TO active
        if (
          appState.current === 'background' &&
          nextAppState === 'active'
        ) {
          // Restore player screen if it was dismissed due to backgrounding
          if (wasPlayerScreenDismissedToBackground && isPlayerReady) {
            // Small delay to ensure navigation is ready after app resumes
            setTimeout(() => {
              router.navigate('/player');
              setWasPlayerScreenDismissedToBackground(false);
            }, 100);
          } else {
            // Reset the flag even if we don't navigate (e.g., player not ready)
            setWasPlayerScreenDismissedToBackground(false);
          }
        }
        appState.current = nextAppState;
      }
    );

    return () => subscription.remove();
  }, [
    router,
    wasPlayerScreenDismissedToBackground,
    setWasPlayerScreenDismissedToBackground,
    isPlayerReady,
  ]);
};
