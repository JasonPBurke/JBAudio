import { setRate } from '@/player/trackPlayer';
import { getPlaybackRate } from '@/db/settingsQueries';
import { useSettingsStore } from '@/store/settingsStore';
import { quantizeRate } from '@/helpers/playbackRate';

/**
 * Re-applies the persisted playback rate to the Player. The Player's reset()
 * (run on every book load) drops the rate back to 1×, so both queue-load
 * choke points (handleBookPlay, restoreLastActiveBook) call this right
 * after their add(...). Reads the settings store when
 * initialized; falls back to the DB because restoreLastActiveBook can run
 * headlessly before store init (Android Auto / media resumption).
 */
export async function applyPersistedPlaybackRate(): Promise<void> {
  const { isInitialized, playbackRate } = useSettingsStore.getState();
  const rate = quantizeRate(
    isInitialized ? playbackRate : await getPlaybackRate(),
  );
  if (rate !== 1.0) {
    await setRate(rate);
  }
}
