import { useQueueStore } from '@/store/queue';

/**
 * Awaits TrackPlayer setup completion if it hasn't finished yet. Safe to call
 * from any play-initiating code path. No-op if the player is already ready.
 *
 * Protects against the cold-start window where the library screen is visible
 * before `useSetupTrackPlayer` has finished `setupPlayer()`. Calling
 * `TrackPlayer.reset()` (and most other methods) before setup completes throws
 * "Player has not been initialized."
 */
export const awaitPlayerReady = async (): Promise<void> => {
  const { isPlayerReady, playerSetupPromise } = useQueueStore.getState();
  if (isPlayerReady || !playerSetupPromise) return;
  await playerSetupPromise;
};
