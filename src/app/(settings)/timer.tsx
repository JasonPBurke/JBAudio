import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  ScrollView,
} from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import {
  Info,
  Sunrise,
  Sunset,
  Moon,
  ClockFading,
  Vibrate,
} from 'lucide-react-native';
import SettingsHeader from '@/components/SettingsHeader';
import SettingsCard from '@/components/settings/SettingsCard';
import CompactSettingsRow from '@/components/settings/CompactSettingsRow';
import SettingsGrid from '@/components/settings/SettingsGrid';
import { screenPadding } from '@/constants/tokens';
import { useTheme } from '@/hooks/useTheme';
import InfoDialogPopup from '@/modals/InfoDialogPopup';
import ToggleSwitch from '@/components/animations/ToggleSwitch';
import {
  updateTimerFadeoutDuration,
  getTimerFadeoutDuration,
  getTimerSettings,
  getBedtimeSettings,
  setBedtimeSettings,
  setBedtimeModeEnabled,
  updateCustomTimer,
} from '@/db/settingsQueries';
import * as sleepTimer from '@/setup/sleepTimer';
import RNDateTimePicker from '@react-native-community/datetimepicker';
import {
  getActiveBookId,
  getPlaybackState,
  State,
} from '@/player/trackPlayer';
import {
  isWithinBedtimeWindow,
  dateToMinutesSinceMidnight,
  minutesSinceMidnightToDate,
} from '@/helpers/bedtimeUtils';
import { useRequiresPro } from '@/hooks/useRequiresPro';
import { ProBadge } from '@/components/ProBadge';
import ProFeaturePopup from '@/modals/ProFeaturePopup';
import SleepTimerDurationCard from '@/components/settings/SleepTimerDurationCard';
import { useSettingsStore } from '@/store/settingsStore';
import { remainingChapterCount } from '@/helpers/remainingChapterCount';
import {
  resolveTimerGesture,
  type TimerGesture,
  type TimerSelection,
} from '@/helpers/sleepTimerSelection';
import { applyTimerCommand } from '@/setup/applyTimerCommand';

const TimerSettingsScreen = () => {
  const { colors: themeColors } = useTheme();
  const { isProUser, hasPurchasedPro } = useRequiresPro();
  const [showProPopup, setShowProPopup] = useState(false);
  const [fadeoutDuration, setFadeoutDuration] = useState('10');
  const [modalVisible, setModalVisible] = useState(false);
  const [bedtimeStartValue, setBedtimeStartValue] = useState<Date>(
    new Date(),
  );
  const [bedtimeEndValue, setBedtimeEndValue] = useState<Date>(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [bedtimeModeEnabled, setBedtimeModeEnabledLocal] = useState(false);
  const [hasTimerConfigured, setHasTimerConfigured] = useState(false);
  const [timerDuration, setTimerDuration] = useState<number | null>(null);
  const [timerChapters, setTimerChapters] = useState<number | null>(null);
  // The SELECTION, and whether a timer happens to be running. This screen only
  // ever writes the first; the second is read so that changing a selection can
  // re-target a timer already counting down, rather than leaving the highlight
  // and the countdown naming two different timers.
  const [timerMode, setTimerMode] = useState<TimerSelection>(null);
  const [timerActive, setTimerActive] = useState(false);
  const [customTimer, setCustomTimer] = useState({ hours: 0, minutes: 0 });
  // `null` means the ceiling is not known — not yet resolved, no Book
  // loaded, or a Player read that failed — and the stepper renders and
  // presses accordingly rather than guessing. It replaces a seed of 20 that
  // had been this screen's initial ceiling since it was written (`661eb1f`,
  // 2026-02-07) and was never a fact about any Book: an early press against
  // it wrote an over-count the Book could not honour.
  const [maxChapters, setMaxChapters] = useState<number | null>(null);
  const [hasActiveBook, setHasActiveBook] = useState(false);
  const [shakeInfoVisible, setShakeInfoVisible] = useState(false);
  const enabledValue = useSharedValue(0);
  const shakeEnabledValue = useSharedValue(0);

  const shakeToResetEnabled = useSettingsStore((s) => s.shakeToResetEnabled);
  const setShakeToResetEnabled = useSettingsStore(
    (s) => s.setShakeToResetEnabled,
  );

  const shakeInfo =
    'When enabled, shake your device to reset the sleep timer in two situations: while the audio is fading out, or within 2 minutes after the timer has stopped playback. The timer restarts at its full duration.';

  const fadeOutDurationInfo =
    'When the sleep timer is activated, the audio will begin to fade out when the sleep time remaining is the same as the fade-out duration you have set.  If the fade-out duration exceeds the timer duration, fade-out will begin when the timer begins.';

  useEffect(() => {
    shakeEnabledValue.value = shakeToResetEnabled ? 1 : 0;
  }, [shakeToResetEnabled, shakeEnabledValue]);

  const toggleShakeToReset = async () => {
    const newValue = !shakeToResetEnabled;
    shakeEnabledValue.set(newValue ? 1 : 0);
    await setShakeToResetEnabled(newValue);
  };

  // Non-pro users are limited to 1 minute; pro users get up to 30 minutes
  const numbers = isProUser
    ? Array.from({ length: 30 }, (_, index) => index + 1)
    : [1];

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const fetchSettingsState = async () => {
        try {
          const DbFadeoutValue = await getTimerFadeoutDuration();
          let fadeoutValueMinutes: number | null =
            DbFadeoutValue !== null
              ? Math.floor(DbFadeoutValue / 60000)
              : null;

          const timerSettings = await getTimerSettings();

          // Auto-clamp: non-Pro user with fadeout > 1 min (e.g. trial expired) → clamp to 1 min
          if (
            !isProUser &&
            fadeoutValueMinutes !== null &&
            fadeoutValueMinutes > 1
          ) {
            await updateTimerFadeoutDuration(60000);
            fadeoutValueMinutes = 1;
          }

          if (
            isActive &&
            fadeoutValueMinutes !== null &&
            fadeoutValueMinutes > 0
          ) {
            setFadeoutDuration(fadeoutValueMinutes.toString());
          } else if (isActive) {
            setFadeoutDuration('');
          }

          if (isActive) {
            setHasTimerConfigured(timerSettings.timerMode !== null);
            setTimerMode(timerSettings.timerMode);
            setTimerActive(timerSettings.timerActive === true);
            setTimerDuration(timerSettings.timerDuration);
            setTimerChapters(timerSettings.timerChapters);
            if (timerSettings.customTimer !== null) {
              const hours = Math.floor(timerSettings.customTimer / 60);
              const minutes = timerSettings.customTimer % 60;
              setCustomTimer({ hours, minutes });
            } else {
              setCustomTimer({ hours: 0, minutes: 0 });
            }
          }
        } catch (error) {
          console.error('Failed to fetch fadeout/timer settings:', error);
        }

        // Compute maxChapters from the Player's state
        try {
          // One read answers both questions: every queue item this app builds
          // carries a bookId, so "is a Book loaded?" and "which Book?" have
          // the same answer. Checked across all five track-construction
          // shapes (handleBookPlay x2, restoreLastActiveBook x2,
          // clippedChapters x1), not assumed.
          //
          // Asked here rather than of `remainingChapterCount`: it is a
          // different question, and the ceiling unit deliberately does not
          // answer it.
          const activeBookId = await getActiveBookId();
          if (isActive) {
            setHasActiveBook(activeBookId !== null);
          }
          // `null` means the ceiling is not known — no Book loaded, or a
          // Player read that failed — and it is carried through to the card
          // rather than answered with a number here.
          const remaining = await remainingChapterCount();
          if (isActive) {
            setMaxChapters(remaining);
          }
        } catch {
          // The Book read itself failed, so the ceiling is not known either.
          if (isActive) {
            setMaxChapters(null);
            setHasActiveBook(false);
          }
        }

        try {
          const bedtimeSettings = await getBedtimeSettings();
          if (isActive) {
            if (bedtimeSettings.bedtimeStart !== null) {
              setBedtimeStartValue(
                minutesSinceMidnightToDate(bedtimeSettings.bedtimeStart),
              );
            }
            if (bedtimeSettings.bedtimeEnd !== null) {
              setBedtimeEndValue(
                minutesSinceMidnightToDate(bedtimeSettings.bedtimeEnd),
              );
            }
            setBedtimeModeEnabledLocal(bedtimeSettings.bedtimeModeEnabled);
            enabledValue.value = bedtimeSettings.bedtimeModeEnabled ? 1 : 0;
          }
        } catch (error) {
          console.error('Failed to fetch bedtime settings:', error);
        }
      };
      fetchSettingsState();

      return () => {
        isActive = false;
      };
    }, []),
  );

  /**
   * Every press on the timer card goes through here, resolved by the same
   * function the player modal uses. The only difference is the surface flag:
   * 'settings' never takes a disarmed timer to armed. It DOES re-target one
   * that is already running, so this screen can never leave the highlight and
   * the countdown stating two different timers.
   */
  const press = async (gesture: TimerGesture) => {
    const command = resolveTimerGesture(
      {
        mode: timerMode,
        durationMs: timerDuration,
        chapters: timerChapters,
        active: timerActive,
      },
      gesture,
      'settings',
    );

    const action = await applyTimerCommand(command);

    if (command.patch.mode !== undefined) {
      setTimerMode(command.patch.mode);
      setHasTimerConfigured(command.patch.mode !== null);
    }
    if (command.patch.durationMs !== undefined) {
      setTimerDuration(command.patch.durationMs);
    }
    if (command.patch.chapters !== undefined) {
      setTimerChapters(command.patch.chapters);
    }
    if (action.kind === 'arm') setTimerActive(true);
    if (action.kind === 'cancel') setTimerActive(false);
  };

  const handleCustomTimerConfirm = async (value: {
    hours: number;
    minutes: number;
  }) => {
    const totalMinutes = value.hours * 60 + value.minutes;
    if (totalMinutes === 0) {
      // Zero clears the custom VALUE. It deselects only if the custom timer is
      // what is currently selected — resolving it as a press on the lit option
      // unconditionally would select and arm a zero-length duration timer
      // whenever something else was selected.
      if (timerMode === 'duration' && timerDuration !== null) {
        await press({ kind: 'pickDuration', durationMs: timerDuration });
      }
      await updateCustomTimer(null, null);
      setCustomTimer({ hours: 0, minutes: 0 });
    } else {
      await updateCustomTimer(value.hours, value.minutes);
      await press({
        kind: 'pickDuration',
        durationMs: totalMinutes * 60000,
      });
      setCustomTimer(value);
    }
  };

  const toggleSwitch = async () => {
    // Check for Pro when trying to enable bedtime mode
    if (!bedtimeModeEnabled && !isProUser) {
      setShowProPopup(true);
      return;
    }

    if (!hasTimerConfigured && !bedtimeModeEnabled) {
      Alert.alert(
        'No Timer Configured',
        'Please configure a sleep timer duration or chapter count before enabling Bedtime Mode.',
        [{ text: 'OK', style: 'default' }],
      );
      return;
    }

    const newValue = !bedtimeModeEnabled;

    enabledValue.value = newValue ? 1 : 0;
    setBedtimeModeEnabledLocal(newValue);

    await setBedtimeModeEnabled(newValue);

    if (newValue) {
      const { bedtimeStart, bedtimeEnd } = await getBedtimeSettings();
      if (isWithinBedtimeWindow(bedtimeStart, bedtimeEnd)) {
        const playerState = await getPlaybackState();
        if (playerState.state === State.Playing) {
          const settings = await getTimerSettings();
          // Arm via activate() rather than raw DB writes: it updates the
          // service's in-memory cache (no longer refreshed by per-tick DB
          // polling), schedules the Doze backup timer, and syncs the store.
          //
          // Branches on the SELECTION. It used to test timerDuration first and
          // fall through to timerChapters, which is the same duration-first
          // inference that lived in four places and drifted.
          if (
            settings.timerMode === 'duration' &&
            settings.timerDuration !== null
          ) {
            await sleepTimer.activate({
              kind: 'duration',
              durationMs: settings.timerDuration,
            });
          } else if (settings.timerMode === 'chapter') {
            // The DIALED count, bounded by this book.
            const ceiling = await remainingChapterCount();
            const dialed = settings.timerChapters ?? 0;
            await sleepTimer.activate({
              kind: 'chapter',
              chaptersRemaining:
                ceiling === null ? dialed : Math.min(dialed, Math.max(ceiling, 0)),
            });
          }
        }
      }
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: themeColors.modalBackground },
      ]}
    >
      <SettingsHeader title='Timer' />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SettingsCard title='Fadeout Settings' icon={ClockFading}>
          <View style={styles.fadeoutSection}>
            <View style={styles.fadeoutHeader}>
              <Text
                style={[
                  styles.fadeoutLabel,
                  { color: themeColors.textMuted },
                ]}
              >
                Fadeout Duration
              </Text>
              <Pressable
                onPress={() => setModalVisible(true)}
                hitSlop={10}
                style={styles.infoButton}
              >
                <Info
                  color={themeColors.textMuted}
                  size={16}
                  strokeWidth={1.5}
                />
              </Pressable>
            </View>
            <Picker
              style={{
                width: '100%',
                height: 50,
                color: themeColors.text,
                backgroundColor: themeColors.modalBackground,
              }}
              itemStyle={{
                borderColor: themeColors.primary,
                borderWidth: 1,
              }}
              dropdownIconColor={themeColors.primary}
              selectedValue={fadeoutDuration}
              onValueChange={async (itemValue, itemIndex) => {
                setFadeoutDuration(itemValue);
                if (itemIndex > 0) {
                  updateTimerFadeoutDuration(itemIndex * 60000);
                } else {
                  updateTimerFadeoutDuration(null);
                }
              }}
              mode='dropdown'
            >
              <Picker.Item label='None' value='' />
              {numbers.map((number) => (
                <Picker.Item
                  key={number}
                  label={`${number.toString()} min${number > 1 ? 's' : ''}`}
                  value={number.toString()}
                />
              ))}
            </Picker>
          </View>
        </SettingsCard>
        <SleepTimerDurationCard
          timerMode={timerMode}
          timerDuration={timerDuration}
          timerChapters={timerChapters}
          customTimer={customTimer}
          onGesture={press}
          onCustomTimerConfirm={handleCustomTimerConfirm}
          maxChapters={maxChapters}
          hasActiveBook={hasActiveBook}
        />

        <SettingsCard title='Shake to Reset Timer' icon={Vibrate}>
          <CompactSettingsRow
            label='Enable Shake to Reset'
            onInfoPress={() => setShakeInfoVisible(true)}
            showDivider={false}
            control={
              <ToggleSwitch
                value={shakeEnabledValue}
                onPress={toggleShakeToReset}
                style={{ width: 72, height: 36, padding: 5 }}
                trackColors={{
                  on: themeColors.primary,
                  off: themeColors.modalBackground,
                }}
              />
            }
          />
        </SettingsCard>

        <SettingsCard
          title='Bedtime Mode'
          icon={Moon}
          rightAccessory={!hasPurchasedPro ? <ProBadge /> : undefined}
        >
          <CompactSettingsRow
            label='Enable Bedtime Mode'
            control={
              <ToggleSwitch
                value={enabledValue}
                onPress={toggleSwitch}
                style={{ width: 72, height: 36, padding: 5 }}
                trackColors={{
                  on: themeColors.primary,
                  off: themeColors.modalBackground,
                }}
              />
            }
          />

          <SettingsGrid>
            <View style={styles.timePickerContainer}>
              <Sunset
                size={16}
                color={themeColors.primary}
                style={styles.timeIcon}
              />
              <View style={styles.timePickerContent}>
                <Text
                  style={[
                    styles.timeLabel,
                    { color: themeColors.textMuted },
                  ]}
                >
                  Start
                </Text>
                <Pressable onPress={() => setShowStartPicker(true)}>
                  <Text
                    style={[
                      styles.timeValue,
                      { color: themeColors.primary },
                    ]}
                  >
                    {bedtimeStartValue.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.timePickerContainer}>
              <Sunrise
                size={16}
                color={themeColors.primary}
                style={styles.timeIcon}
              />
              <View style={styles.timePickerContent}>
                <Text
                  style={[
                    styles.timeLabel,
                    { color: themeColors.textMuted },
                  ]}
                >
                  End
                </Text>
                <Pressable onPress={() => setShowEndPicker(true)}>
                  <Text
                    style={[
                      styles.timeValue,
                      { color: themeColors.primary },
                    ]}
                  >
                    {bedtimeEndValue.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </Text>
                </Pressable>
              </View>
            </View>
          </SettingsGrid>
        </SettingsCard>
      </ScrollView>

      {showStartPicker && (
        <RNDateTimePicker
          value={bedtimeStartValue}
          mode='time'
          display='spinner'
          onChange={(event, selectedDate) => {
            if (event.type === 'set' && selectedDate) {
              setBedtimeStartValue(selectedDate);
              const startMinutes = dateToMinutesSinceMidnight(selectedDate);
              const endMinutes =
                dateToMinutesSinceMidnight(bedtimeEndValue);
              setBedtimeSettings(startMinutes, endMinutes);
            }
            setShowStartPicker(false);
          }}
        />
      )}
      {showEndPicker && (
        <RNDateTimePicker
          value={bedtimeEndValue}
          mode='time'
          display='spinner'
          onChange={(event, selectedDate) => {
            if (event.type === 'set' && selectedDate) {
              setBedtimeEndValue(selectedDate);
              const startMinutes =
                dateToMinutesSinceMidnight(bedtimeStartValue);
              const endMinutes = dateToMinutesSinceMidnight(selectedDate);
              setBedtimeSettings(startMinutes, endMinutes);
            }
            setShowEndPicker(false);
          }}
        />
      )}

      <InfoDialogPopup
        isVisible={modalVisible}
        onClose={() => setModalVisible(false)}
        title='Fadeout Duration'
        message={fadeOutDurationInfo}
      />

      <InfoDialogPopup
        isVisible={shakeInfoVisible}
        onClose={() => setShakeInfoVisible(false)}
        title='Shake to Reset Timer'
        message={shakeInfo}
      />

      <ProFeaturePopup
        isVisible={showProPopup}
        onClose={() => setShowProPopup(false)}
      />
    </View>
  );
};

export default TimerSettingsScreen;

const styles = StyleSheet.create({
  container: {
    paddingTop: 50,
    flex: 1,
  },
  scrollView: {
    paddingTop: 20,
  },
  scrollContent: {
    paddingHorizontal: screenPadding.horizontal,
    paddingBottom: 300,
    flexGrow: 1,
  },
  fadeoutSection: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    gap: 8,
  },
  fadeoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fadeoutLabel: {
    fontFamily: 'Rubik',
    fontSize: 16,
  },
  infoButton: {
    padding: 4,
  },
  timePickerContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  timeIcon: {
    flexShrink: 0,
  },
  timePickerContent: {
    flex: 1,
  },
  timeLabel: {
    fontFamily: 'Rubik',
    fontSize: 12,
    marginBottom: 2,
  },
  timeValue: {
    fontFamily: 'Rubik', fontWeight: '600',
    fontSize: 15,
  },
});
