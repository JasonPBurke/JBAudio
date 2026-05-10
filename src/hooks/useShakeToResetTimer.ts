import { useEffect } from 'react';
import RNShake from 'react-native-shake';
import * as Haptics from 'expo-haptics';
import { useSleepTimerStore, resetFromShake } from '@/setup/sleepTimer';
import { useSettingsStore } from '@/store/settingsStore';

/**
 * Listens for device shakes and re-arms the sleep timer when the user shakes
 * during the fade-out phase (duration mode) or within the 2-minute post-expiry
 * grace window (both modes).
 *
 * The RNShake listener is attached only when the feature is enabled AND the
 * timer is in one of those two windows, so the accelerometer is idle the rest
 * of the time.
 */
export function useShakeToResetTimer(): void {
  const enabled = useSettingsStore((s) => s.shakeToResetEnabled);
  const isFading = useSleepTimerStore((s) => s.isFading);
  const expiredAt = useSleepTimerStore((s) => s.expiredAt);

  // expiredAt is nulled by sleepTimer.ts after the grace window passes,
  // so a non-null value reliably means "still in grace".
  const inGrace = expiredAt !== null;
  const shouldListen = enabled && (isFading || inGrace);

  useEffect(() => {
    if (!shouldListen) return;

    const subscription = RNShake.addListener(() => {
      resetFromShake().then((didReset) => {
        if (didReset) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
            () => {},
          );
        }
      });
    });

    return () => subscription.remove();
  }, [shouldListen]);
}
