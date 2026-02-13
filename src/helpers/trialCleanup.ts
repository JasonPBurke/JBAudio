import {
  setBedtimeModeEnabled,
  getAutoChapterInterval,
  setAutoChapterInterval,
  getTimerFadeoutDuration,
  updateTimerFadeoutDuration,
  getBedtimeSettings,
} from '@/db/settingsQueries';
import { removeAllAutoChapters } from '@/helpers/autoChapterGenerator';
import { useThemeStore } from '@/store/themeStore';

/**
 * Runs idempotent cleanup of pro features when the user is no longer pro.
 * Each action checks its own condition before reverting, so this is safe
 * to call multiple times.
 */
export async function runTrialExpiredCleanup(): Promise<void> {
  // 1. Disable bedtime mode if enabled
  try {
    const bedtimeSettings = await getBedtimeSettings();
    if (bedtimeSettings.bedtimeModeEnabled) {
      await setBedtimeModeEnabled(false);
    }
  } catch (error) {
    console.error('Trial cleanup: failed to disable bedtime mode', error);
  }

  // 2. Remove all auto-generated chapters
  try {
    await removeAllAutoChapters();
  } catch (error) {
    console.error('Trial cleanup: failed to remove auto-chapters', error);
  }

  // 3. Disable auto-chapter setting
  try {
    const interval = await getAutoChapterInterval();
    if (interval !== null) {
      await setAutoChapterInterval(null);
    }
  } catch (error) {
    console.error('Trial cleanup: failed to clear auto-chapter interval', error);
  }

  // 4. Clamp fadeout duration to 1 minute (60000ms)
  try {
    const fadeout = await getTimerFadeoutDuration();
    if (fadeout !== null && fadeout > 60000) {
      await updateTimerFadeoutDuration(60000);
    }
  } catch (error) {
    console.error('Trial cleanup: failed to clamp fadeout duration', error);
  }

  // 5. Reset custom theme color
  try {
    const customColor = useThemeStore.getState().customPrimaryColor;
    if (customColor !== null) {
      await useThemeStore.getState().setCustomPrimaryColor(null);
    }
  } catch (error) {
    console.error('Trial cleanup: failed to reset custom color', error);
  }
}
