import { useEffect } from 'react';
import { useSharedValue, SharedValue } from 'react-native-reanimated';
import {
  Event,
  getProgress,
  type Progress,
  subscribe,
} from '@/player/trackPlayer';
import { useAppStateStore } from '@/store/appState';

export type ProgressReanimated = {
  position: SharedValue<number>;
  duration: SharedValue<number>;
  buffered: SharedValue<number>;
};

/**
 * A Reanimated-based progress hook that updates shared values directly
 * without triggering React re-renders. This is ideal for progress bars
 * and time displays that need frequent updates during playback.
 *
 * Unlike the standard useProgress hook which causes React re-renders
 * every update interval, this hook updates Reanimated shared values
 * that can drive UI animations on the UI thread.
 */
export const useProgressReanimated = (): ProgressReanimated => {
  const position = useSharedValue(0);
  const duration = useSharedValue(0);
  const buffered = useSharedValue(0);

  useEffect(() => {
    // Get initial progress values
    const getInitialProgress = async () => {
      try {
        const progress: Progress = await getProgress();
        position.value = progress.position;
        duration.value = progress.duration;
        buffered.value = progress.buffered;
      } catch (error) {
        // Player might not be initialized yet, ignore
      }
    };

    getInitialProgress();

    // Subscribe to playback progress updates via event listener
    // This fires at the interval configured in updateOptions (typically 1 second)
    const progressSubscription = subscribe(
      Event.PlaybackProgressUpdated,
      (event) => {
        // Dormant while backgrounded: the screen is invisible, and freezing
        // the shared values here also stops PlayerProgressBar's per-second
        // useAnimatedReaction cascade. Self-heals on the next tick after
        // resume. See src/store/appState.ts.
        if (!useAppStateStore.getState().isActive) return;
        position.value = event.position;
        duration.value = event.duration;
        buffered.value = event.buffered;
      }
    );

    // Also listen for track changes to reset progress
    const trackChangedSubscription = subscribe(
      Event.PlaybackActiveTrackChanged,
      async () => {
        if (!useAppStateStore.getState().isActive) return;
        try {
          const progress: Progress = await getProgress();
          position.value = progress.position;
          duration.value = progress.duration;
          buffered.value = progress.buffered;
        } catch (error) {
          // Ignore errors during track transitions
        }
      }
    );

    // Listen for seek completion to update position immediately
    const seekSubscription = subscribe(
      Event.PlaybackState,
      async () => {
        if (!useAppStateStore.getState().isActive) return;
        try {
          const progress: Progress = await getProgress();
          position.value = progress.position;
          duration.value = progress.duration;
          buffered.value = progress.buffered;
        } catch (error) {
          // Ignore errors
        }
      }
    );

    return () => {
      progressSubscription.remove();
      trackChangedSubscription.remove();
      seekSubscription.remove();
    };
  }, [position, duration, buffered]);

  return { position, duration, buffered };
};
