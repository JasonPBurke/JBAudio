import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useState } from 'react';
import { Timer, CirclePlus, CircleMinus } from 'lucide-react-native';
import { TimerPickerModal } from 'react-native-timer-picker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import SettingsCard from '@/components/settings/SettingsCard';
import { colorTokens } from '@/constants/tokens';
import {
  chapterStepperView,
  normalizeChapterCount,
} from '@/helpers/chapterTimerStepper';
import type {
  TimerGesture,
  TimerSelection,
} from '@/helpers/sleepTimerSelection';
import { withOpacity } from '@/helpers/colorUtils';
import { useTheme } from '@/hooks/useTheme';

const PRESET_DURATIONS_MS = new Set([
  900000, 1800000, 2700000, 3600000, 5400000, 7200000,
]);

const PRESETS = [
  { minutes: 15, label: '15 mins' },
  { minutes: 30, label: '30 mins' },
  { minutes: 45, label: '45 mins' },
  { minutes: 60, label: '1 hr' },
  { minutes: 90, label: '1.5 hrs' },
  { minutes: 120, label: '2 hrs' },
];

type SleepTimerDurationCardProps = {
  /** Which option is highlighted. The ONLY thing that decides a highlight. */
  timerMode: TimerSelection;
  /** The dialed duration. Highlights a preset only together with `timerMode`. */
  timerDuration: number | null;
  /** The dialed chapter count. Never the remaining one. */
  timerChapters: number | null;
  customTimer: { hours: number; minutes: number };
  /**
   * Emits the press as a gesture rather than as a decision. The card used to
   * take `onPresetSelect` / `onChapterChange`, which meant it had already
   * decided what a press meant — and it decided differently from the player
   * modal, so the two surfaces enforced "one option selected" separately and
   * drifted. Both now hand the gesture to `resolveTimerGesture`.
   */
  onGesture: (gesture: TimerGesture) => void;
  onCustomTimerConfirm: (value: { hours: number; minutes: number }) => void;
  /** `null` while the ceiling is not known — see `chapterStepperView`. */
  maxChapters: number | null;
  hasActiveBook: boolean;
};

const SleepTimerDurationCard = ({
  timerMode,
  timerDuration,
  timerChapters,
  customTimer,
  onGesture,
  onCustomTimerConfirm,
  maxChapters,
  hasActiveBook,
}: SleepTimerDurationCardProps) => {
  const [showPicker, setShowPicker] = useState(false);
  const { colors: themeColors, activeColorScheme } = useTheme();

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

  const healedChapters = normalizeChapterCount(timerChapters);
  // Reads the selection, NOT whether a count happens to be stored. A dialed
  // count with a duration selected must leave this row dark — that inference
  // is what lit two options at once.
  const chapterTimerActive = timerMode === 'chapter';
  const chaptersToEnd = healedChapters ?? 0;

  // One derivation feeds the label, the dimming and the press, so the number
  // the row names is the number a press steps from — and a count the Book has
  // outgrown is bounded before it is shown, not after it is pressed.
  const stepper = chapterStepperView(chaptersToEnd, maxChapters);

  // Shared with the player's SleepTimerOptions modal so a press at a bound
  // means the same thing on both surfaces.
  const stepChapters = (delta: number) => {
    // Dead while the ceiling is unknown: a press then resolves against a
    // guess and persists it.
    if (maxChapters === null) return;
    onGesture({
      kind: 'stepChapter',
      delta,
      displayedCount: stepper.count,
      maxChapters,
    });
  };

  const customMs =
    customTimer.hours * 3600000 + customTimer.minutes * 60000;
  const isCustomActive =
    timerMode === 'duration' &&
    timerDuration !== null &&
    timerDuration === customMs &&
    customMs > 0 &&
    !PRESET_DURATIONS_MS.has(timerDuration);

  return (
    <SettingsCard title='Sleep Timer' icon={Timer}>
      {/* Preset grid */}
      <View style={styles.presetGrid}>
        {PRESETS.map(({ minutes, label }) => {
          const ms = minutes * 60000;
          const isActive = timerMode === 'duration' && timerDuration === ms;
          return (
            <Pressable
              key={minutes}
              style={[
                styles.presetButton,
                {
                  backgroundColor: isActive
                    ? getActiveButtonBackground()
                    : themeColors.background,
                  borderColor: isActive
                    ? themeColors.primary
                    : themeColors.textMuted,
                },
              ]}
              onPress={() =>
                onGesture({ kind: 'pickDuration', durationMs: ms })
              }
            >
              <Text
                style={[
                  styles.presetText,
                  {
                    color: isActive
                      ? getActiveButtonTextColor()
                      : themeColors.textMuted,
                  },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Divider */}
      <View
        style={[
          styles.divider,
          { backgroundColor: withOpacity(themeColors.divider, 0.2) },
        ]}
      />

      {/* Chapter timer row */}
      <Pressable
        style={[
          styles.chapterRow,
          {
            backgroundColor: chapterTimerActive
              ? getActiveButtonBackground()
              : 'transparent',
            borderColor: chapterTimerActive
              ? themeColors.primary
              : 'transparent',
            borderWidth: chapterTimerActive ? 1 : 0,
          },
        ]}
        // One gesture for both directions: `resolveTimerGesture` answers a
        // press on the lit row with a deselect, so the card does not need to
        // know which case it is in — and cannot get it wrong differently from
        // the modal.
        onPress={() =>
          onGesture({ kind: 'pickChapter', count: stepper.count })
        }
      >
        <Pressable
          style={styles.stepperButton}
          onPress={() => stepChapters(-1)}
          hitSlop={8}
        >
          <CircleMinus
            size={26}
            color={
              !stepper.canStepDown
                ? withOpacity(
                    chapterTimerActive
                      ? getActiveButtonTextColor()
                      : themeColors.textMuted,
                    0.43,
                  )
                : chapterTimerActive
                  ? getActiveButtonTextColor()
                  : themeColors.textMuted
            }
            strokeWidth={1.5}
            absoluteStrokeWidth
          />
        </Pressable>

        <Text
          style={[
            styles.chapterLabel,
            {
              color: chapterTimerActive
                ? getActiveButtonTextColor()
                : themeColors.textMuted,
            },
          ]}
        >
          {stepper.label}
        </Text>

        <Pressable
          style={styles.stepperButton}
          onPress={() => stepChapters(1)}
          hitSlop={8}
        >
          <CirclePlus
            size={26}
            color={
              !stepper.canStepUp
                ? withOpacity(
                    chapterTimerActive
                      ? getActiveButtonTextColor()
                      : themeColors.textMuted,
                    0.43,
                  )
                : chapterTimerActive
                  ? getActiveButtonTextColor()
                  : themeColors.textMuted
            }
            strokeWidth={1.5}
            absoluteStrokeWidth
          />
        </Pressable>
      </Pressable>

      {/* Divider */}
      <View
        style={[
          styles.divider,
          { backgroundColor: withOpacity(themeColors.divider, 0.2) },
        ]}
      />

      {/* Custom timer row */}
      <Pressable
        style={[
          styles.customRow,
          {
            backgroundColor: isCustomActive
              ? getActiveButtonBackground()
              : 'transparent',
            borderColor: isCustomActive
              ? themeColors.primary
              : 'transparent',
            borderWidth: isCustomActive ? 1 : 0,
          },
        ]}
        onPress={() => {
          const totalCustomMinutes =
            customTimer.hours * 60 + customTimer.minutes;
          if (totalCustomMinutes === 0) {
            setShowPicker(true);
          } else {
            // Toggle: tap to select/deselect, long-press to edit
            onGesture({
              kind: 'pickDuration',
              durationMs: totalCustomMinutes * 60000,
            });
          }
        }}
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          const totalCustomMinutes =
            customTimer.hours * 60 + customTimer.minutes;
          if (totalCustomMinutes !== 0) {
            setShowPicker(true);
          }
        }}
        delayLongPress={400}
      >
        <Text
          style={[
            styles.customLabel,
            {
              color: isCustomActive
                ? getActiveButtonTextColor()
                : themeColors.textMuted,
            },
          ]}
        >
          Custom
        </Text>
        {(customTimer.hours !== 0 || customTimer.minutes !== 0) && (
          <Text
            style={[
              styles.customValue,
              {
                color: isCustomActive
                  ? getActiveButtonTextColor()
                  : themeColors.primary,
              },
            ]}
          >
            {customTimer.hours}:
            {customTimer.minutes < 10
              ? `0${customTimer.minutes}`
              : `${customTimer.minutes}`}
          </Text>
        )}
      </Pressable>

      <TimerPickerModal
        visible={showPicker}
        setIsVisible={setShowPicker}
        closeOnOverlayPress
        hideSeconds
        initialValue={{
          hours: customTimer.hours,
          minutes: customTimer.minutes,
        }}
        maximumHours={12}
        modalTitle='Custom Timer'
        modalTitleProps={{ style: { color: themeColors.text } }}
        confirmButtonText='   Set   '
        LinearGradient={LinearGradient}
        onCancel={() => setShowPicker(false)}
        onConfirm={(value) => {
          onCustomTimerConfirm(value);
          setShowPicker(false);
        }}
        styles={{
          text: { fontFamily: 'Rubik' },
          pickerLabel: { paddingBottom: 4, fontFamily: 'Rubik' },
          theme: activeColorScheme,
          contentContainer: {
            backgroundColor: themeColors.modalBackground,
          },
          backgroundColor: themeColors.modalBackground,
          button: { borderRadius: 4, fontFamily: 'Rubik', fontWeight: '500' },
          cancelButton: {
            backgroundColor: themeColors.background,
            color: themeColors.text,
          },
          confirmButton: {
            backgroundColor: themeColors.background,
            borderColor: themeColors.primary,
            color: themeColors.text,
          },
          modalTitle: {
            color: themeColors.text,
            fontFamily: 'Rubik',
          },
        }}
      />
    </SettingsCard>
  );
};

export default SleepTimerDurationCard;

const styles = StyleSheet.create({
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  presetButton: {
    width: '31%',
    flexGrow: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetText: {
    fontFamily: 'Rubik', fontWeight: '600',
    fontSize: 15,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 8,
    paddingVertical: 8,
  },
  stepperButton: {
    padding: 10,
  },
  chapterLabel: {
    fontFamily: 'Rubik', fontWeight: '600',
    fontSize: 15,
    textAlign: 'center',
    flex: 1,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  customLabel: {
    fontFamily: 'Rubik', fontWeight: '600',
    fontSize: 15,
  },
  customValue: {
    fontFamily: 'Rubik', fontWeight: '600',
    fontSize: 15,
  },
});
