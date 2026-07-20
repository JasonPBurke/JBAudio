import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Slider } from 'react-native-awesome-slider';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import { CircleMinus, CirclePlus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors, screenPadding, colorTokens } from '@/constants/tokens';
import { withOpacity } from '@/helpers/colorUtils';
import { useTheme } from '@/hooks/useTheme';
import { useSettingsStore } from '@/store/settingsStore';
import {
  RATE_MIN,
  RATE_MAX,
  RATE_STEP,
  RATE_PRESETS,
  quantizeRate,
  formatRate,
} from '@/helpers/playbackRate';

// 40 segments of 0.05 across 0.5–2.5; mark index 10 is exactly 1.0×
const RATE_STEPS = Math.round((RATE_MAX - RATE_MIN) / RATE_STEP);
const ONE_X_MARK_INDEX = Math.round((1.0 - RATE_MIN) / RATE_STEP);

const PlaybackSpeedOptions = () => {
  const { colors: themeColors, activeColorScheme } = useTheme();
  const rate = useSettingsStore((s) => s.playbackRate);
  const setPlaybackRate = useSettingsStore((s) => s.setPlaybackRate);

  // In-flight value while the thumb is being dragged; null when idle.
  // Drags only apply on release — this feeds the readout preview.
  const [draftRate, setDraftRate] = useState<number | null>(null);
  const displayRate = draftRate ?? rate;

  const progress = useSharedValue(rate);
  const minimumValue = useSharedValue(RATE_MIN);
  const maximumValue = useSharedValue(RATE_MAX);

  // Follow external rate changes (presets, steppers) with a short glide.
  // After a drag-release this re-sets progress to the value it already has.
  useEffect(() => {
    progress.value = withTiming(rate, { duration: 120 });
  }, [rate, progress]);

  // Same inverted-active treatment as SleepTimerOptions buttons
  const getActiveButtonBackground = () => {
    return activeColorScheme === 'dark'
      ? colorTokens.light.background
      : colorTokens.dark.background;
  };

  const getActiveButtonTextColor = () => {
    return activeColorScheme === 'dark'
      ? colorTokens.light.text
      : colorTokens.dark.text;
  };

  const handlePresetPress = useCallback(
    (preset: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPlaybackRate(preset);
    },
    [setPlaybackRate],
  );

  const handleNudge = useCallback(
    (direction: 1 | -1) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const current = useSettingsStore.getState().playbackRate;
      setPlaybackRate(current + direction * RATE_STEP);
    },
    [setPlaybackRate],
  );

  const handleValueChange = useCallback((value: number) => {
    const next = quantizeRate(value);
    setDraftRate((prev) => (prev === next ? prev : next));
  }, []);

  const handleSlidingComplete = useCallback(
    (value: number) => {
      setDraftRate(null);
      // Write progress synchronously: on the tap path the (patched)
      // slider re-enables its progress->thumb sync one frame later, and
      // without this it would rubber-band to the stale value until the
      // store round-trip lands.
      progress.set(quantizeRate(value));
      setPlaybackRate(value);
    },
    [setPlaybackRate, progress],
  );

  const handleStepHaptic = useCallback(() => {
    Haptics.selectionAsync();
  }, []);

  const renderMark = useCallback(({ index }: { index: number }) => {
    if (index !== ONE_X_MARK_INDEX) return null;
    return (
      <View style={styles.markAnchor}>
        <View style={styles.markNotch} />
      </View>
    );
  }, []);

  // Permanent speed bubble riding the thumb — same idea as the progress
  // bar's scrub bubble, but always visible, so the removed readout row
  // isn't missed. Re-created on draft/rate change to keep the text live.
  const renderThumb = useCallback(
    () => (
      <View style={styles.thumbWrap}>
        <Text style={styles.thumbLabel}>{formatRate(displayRate)}</Text>
        <View
          style={[
            styles.thumbCircle,
            { backgroundColor: themeColors.primary },
          ]}
        />
      </View>
    ),
    [displayRate, themeColors.primary],
  );

  const renderBubble = useCallback(() => null, []);

  const atMin = rate <= RATE_MIN;
  const atMax = rate >= RATE_MAX;

  return (
    //! will need a slight redesign to include the header at 20%
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: themeColors.textMuted }]}>
          Playback Speed
        </Text>
      </View>

      <View style={styles.buttonRow}>
        {RATE_PRESETS.map((preset) => {
          const isActive = rate === preset;
          return (
            <TouchableOpacity
              key={preset}
              style={[
                styles.button,
                {
                  backgroundColor: isActive
                    ? getActiveButtonBackground()
                    : themeColors.background,
                  borderColor: isActive
                    ? themeColors.primary
                    : themeColors.textMuted,
                },
              ]}
              onPress={() => handlePresetPress(preset)}
            >
              <Text
                style={[
                  styles.buttonText,
                  {
                    color: isActive
                      ? getActiveButtonTextColor()
                      : themeColors.textMuted,
                  },
                ]}
              >
                {formatRate(preset)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.sliderRow}>
        <TouchableOpacity
          style={styles.stepperButton}
          onPress={() => handleNudge(-1)}
          disabled={atMin}
        >
          <CircleMinus
            size={28}
            color={
              atMin
                ? withOpacity(themeColors.textMuted, 0.43)
                : themeColors.textMuted
            }
            strokeWidth={1.5}
            absoluteStrokeWidth
          />
        </TouchableOpacity>

        <View style={styles.sliderColumn}>
          <Slider
            progress={progress}
            minimumValue={minimumValue}
            maximumValue={maximumValue}
            steps={RATE_STEPS}
            forceSnapToStep
            markWidth={2}
            renderMark={renderMark}
            renderThumb={renderThumb}
            hapticMode='step'
            onHapticFeedback={handleStepHaptic}
            renderBubble={renderBubble}
            theme={{
              minimumTrackTintColor: themeColors.primary,
              maximumTrackTintColor: themeColors.maximumTrackTintColor,
            }}
            thumbWidth={16}
            sliderHeight={5}
            containerStyle={styles.slider}
            onValueChange={handleValueChange}
            onSlidingComplete={handleSlidingComplete}
          />
          <View style={styles.endpointRow}>
            <Text
              style={[
                styles.endpointLabel,
                { color: themeColors.textMuted },
              ]}
            >
              {formatRate(RATE_MIN)}
            </Text>
            <Text
              style={[
                styles.endpointLabel,
                { color: themeColors.textMuted },
              ]}
            >
              {formatRate(RATE_MAX)}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.stepperButton}
          onPress={() => handleNudge(1)}
          disabled={atMax}
        >
          <CirclePlus
            size={28}
            color={
              atMax
                ? withOpacity(themeColors.textMuted, 0.43)
                : themeColors.textMuted
            }
            strokeWidth={1.5}
            absoluteStrokeWidth
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default PlaybackSpeedOptions;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: screenPadding.horizontal,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginRight: 6,
  },
  title: {
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: 15,
    marginStart: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginHorizontal: 4,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: 'Rubik',
    fontWeight: '600',
    alignSelf: 'center',
    fontSize: 14,
  },
  // Extra top margin reserves room for the thumb label riding above the bar
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  stepperButton: {
    padding: 10,
  },
  // Endpoint labels are absolute so they don't add flow height; the bar is
  // vertically centered in this column, so anchoring them at 50% + 10px
  // puts them just under the 16px thumb regardless of the column's height
  // (the slider's own container is flex:1 and can stretch it).
  sliderColumn: {
    flex: 1,
    marginHorizontal: 4,
    justifyContent: 'center',
  },
  slider: {
    borderRadius: 4,
  },
  endpointRow: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  endpointLabel: {
    fontFamily: 'Rubik',
    fontSize: 12,
    opacity: 0.75,
  },
  // Zero-footprint anchor at the mark position; children overflow it.
  // zIndex sends the line behind the track so it reads as passing under
  // the bar.
  markAnchor: {
    width: 2,
    zIndex: -1,
  },
  // The library's visual-mark and thumb-snap positions use different
  // formulas; at the 1x index they differ by (thumbWidth - markWidth) *
  // (1/2 - index/steps) = 3.5px, hence `left`. `top` centers the line on
  // the 5px bar with a ~1px upward bias measured on device.
  markNotch: {
    position: 'absolute',
    left: 3.5,
    top: -14,
    width: 2,
    height: 30,
    borderRadius: 1,
    backgroundColor: colors.textMuted,
    opacity: 0.5,
  },
  thumbWrap: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  // Styled like CountdownTimer's text over the sleep-timer bell
  thumbLabel: {
    position: 'absolute',
    top: -24,
    width: 48,
    left: -16,
    textAlign: 'center',
    fontFamily: 'Rubik',
    fontSize: 12,
    letterSpacing: 0.7,
    color: colors.textMuted,
  },
});
