import {
  AndroidAudioContentType,
  AppKilledPlaybackBehavior,
  Capability,
  RepeatMode,
  setRepeatMode,
  setupPlayer,
  updateOptions,
} from '@/player/trackPlayer';
import {
  getSkipBackDuration,
  getSkipForwardDuration,
} from '@/db/settingsQueries';
import { useQueueStore } from '@/store/queue';

/**
 * The single source of truth for the Player's options. updateOptions REPLACES
 * capability arrays (and resets omitted android options) rather than merging,
 * so every caller must pass the complete set — never a hand-copied subset.
 * Used at setup and whenever the jump intervals change in settings.
 */
export const applyPlayerOptions = async (
  skipBack: number,
  skipForward: number,
) => {
  await updateOptions({
    android: {
      // Swipe-away from recents while playing keeps playing (explicit default).
      appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
      // Demote the foreground service immediately on pause so the app leaves
      // Android's "Active apps" list; the notification persists for resume.
      stopForegroundGracePeriod: 0,
    },
    progressUpdateEventInterval: 1,
    forwardJumpInterval: skipForward,
    backwardJumpInterval: skipBack,
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
      Capability.SkipToNext,
      Capability.SkipToPrevious,
      Capability.Stop,
      // Enables COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM for external controllers —
      // without it, Android Auto's progress-bar scrubbing is dead.
      Capability.SeekTo,
      // Capability.Pause,
    ],
  });
};

/**
 * Core Player initialization (native player + options). Shared by the
 * UI path (useSetupTrackPlayer) and the headless path (ensurePlayerSetup).
 * Throws if the native player is already initialized — callers catch that.
 */
export const setupPlayerCore = async () => {
  const [skipBack, skipForward] = await Promise.all([
    getSkipBackDuration(),
    getSkipForwardDuration(),
  ]);

  await setupPlayer({
    autoHandleInterruptions: true,
    androidAudioContentType: AndroidAudioContentType.Speech,
    maxCacheSize: 1024 * 5,
  });

  await applyPlayerOptions(skipBack, skipForward);

  await setRepeatMode(RepeatMode.Off);
};

/**
 * Guarantees the player is initialized before remote commands act on it.
 * In a headless runtime (Android Auto connects while the app has no UI),
 * useSetupTrackPlayer never runs — without this, remote play requests throw
 * "Player has not been initialized" and get silently swallowed.
 *
 * Publishes its promise to the queue store so a UI mounting mid-setup (or a
 * concurrent remote command) awaits the same setup instead of racing it.
 */
export async function ensurePlayerSetup(): Promise<void> {
  const { isPlayerReady, playerSetupPromise } = useQueueStore.getState();
  if (isPlayerReady) return;
  if (playerSetupPromise) {
    await playerSetupPromise;
    return;
  }

  const setup = (async () => {
    try {
      await setupPlayerCore();
    } catch {
      // Native player already initialized (e.g. UI raced us) — safe to mark ready
    }
    useQueueStore.getState().setPlayerReady(true);
  })();

  useQueueStore.getState().setPlayerSetupPromise(setup);
  await setup;
}
