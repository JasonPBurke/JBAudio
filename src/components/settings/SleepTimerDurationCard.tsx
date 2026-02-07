import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useState } from 'react';
import { Timer, CirclePlus, CircleMinus } from 'lucide-react-native';
import { TimerPickerModal } from 'react-native-timer-picker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import SettingsCard from '@/components/settings/SettingsCard';
import { colorTokens } from '@/constants/tokens';
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
  timerDuration: number | null;
  timerChapters: number | null;
  customTimer: { hours: number; minutes: number };
  onPresetSelect: (durationMinutes: number) => void;
  onChapterChange: (chapters: number | null) => void;
  onCustomTimerConfirm: (value: { hours: number; minutes: number }) => void;
  maxChapters: number;
  hasActiveTrack: boolean;
};

const SleepTimerDurationCard = ({
  timerDuration,
  timerChapters,
  customTimer,
  onPresetSelect,
  onChapterChange,
  onCustomTimerConfirm,
  maxChapters,
  hasActiveTrack,
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

  const chapterTimerActive = timerChapters !== null;
  const chaptersToEnd = timerChapters ?? 0;

  const customMs =
    customTimer.hours * 3600000 + customTimer.minutes * 60000;
  const isCustomActive =
    timerDuration !== null &&
    timerDuration === customMs &&
    customMs > 0 &&
    !PRESET_DURATIONS_MS.has(timerDuration);

  const chapterLabel =
    chaptersToEnd === maxChapters && maxChapters > 0
      ? 'End of Book'
      : chaptersToEnd > 0
        ? `End of ${chaptersToEnd + 1} Chapters`
        : 'End of Chapter';

  return (
    <SettingsCard title='Sleep Timer' icon={Timer}>
      {/* Preset grid */}
      <View style={styles.presetGrid}>
        {PRESETS.map(({ minutes, label }) => {
          const ms = minutes * 60000;
          const isActive = timerDuration === ms;
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
              onPress={() => onPresetSelect(minutes)}
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
        onPress={() => {
          if (chapterTimerActive) {
            onChapterChange(null);
          } else {
            onChapterChange(0);
          }
        }}
      >
        <Pressable
          style={styles.stepperButton}
          onPress={() => {
            if (chaptersToEnd > 0) {
              onChapterChange(chaptersToEnd - 1);
            }
          }}
          hitSlop={8}
        >
          <CircleMinus
            size={26}
            color={
              chaptersToEnd === 0
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
          {chapterLabel}
        </Text>

        <Pressable
          style={styles.stepperButton}
          onPress={() => {
            if (chaptersToEnd < maxChapters) {
              onChapterChange(chaptersToEnd + 1);
            }
          }}
          hitSlop={8}
        >
          <CirclePlus
            size={26}
            color={
              chaptersToEnd >= maxChapters
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
            onPresetSelect(totalCustomMinutes);
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
          button: { borderRadius: 4, fontFamily: 'Rubik-Medium' },
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
    fontFamily: 'Rubik-SemiBold',
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
    fontFamily: 'Rubik-SemiBold',
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
    fontFamily: 'Rubik-SemiBold',
    fontSize: 15,
  },
  customValue: {
    fontFamily: 'Rubik-SemiBold',
    fontSize: 15,
  },
});
