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
  updateTimerDuration,
  updateCustomTimer,
  updateChapterTimer,
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
  const [customTimer, setCustomTimer] = useState({ hours: 0, minutes: 0 });
  // 20 is an arbitrary seed, not a computed default. It has been this
  // screen's initial ceiling since the screen was written (`661eb1f`,
  // 2026-02-07) and was never justified anywhere; it survives as the answer
  // this surface gives when the real ceiling is not known, and nothing else
  // depends on the number itself.
  const [maxChapters, setMaxChapters] = useState(20);
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
            const hasTimer =
              timerSettings.timerDuration !== null ||
              timerSettings.timerChapters !== null;
            setHasTimerConfigured(hasTimer);
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
          // Player read that failed. This surface answers that with its seed,
          // which is what it has always shown with no Book loaded.
          const remaining = await remainingChapterCount();
          if (isActive) {
            setMaxChapters(remaining ?? 20);
          }
        } catch {
          // The Book read itself failed. Same seed as above, same reason: the
          // ceiling is not known, and 20 is this surface's answer to that.
          if (isActive) {
            setMaxChapters(20);
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

  const handlePresetSelect = async (durationMinutes: number) => {
    const totalMs = durationMinutes * 60000;
    if (timerDuration === totalMs) {
      // Deselect
      await updateTimerDuration(null);
      setTimerDuration(null);
      setHasTimerConfigured(false);
    } else {
      // Select preset, clear chapters
      await updateTimerDuration(totalMs);
      await updateChapterTimer(null);
      setTimerDuration(totalMs);
      setTimerChapters(null);
      setHasTimerConfigured(true);
    }
  };

  const handleChapterChange = async (chapters: number | null) => {
    if (chapters === null) {
      // Deactivate chapter timer
      await updateChapterTimer(null);
      setTimerChapters(null);
      setHasTimerConfigured(timerDuration !== null);
    } else {
      // Activate/update chapter timer, clear duration
      await updateChapterTimer(chapters);
      await updateTimerDuration(null);
      setTimerChapters(chapters);
      setTimerDuration(null);
      setHasTimerConfigured(true);
    }
  };

  const handleCustomTimerConfirm = async (value: {
    hours: number;
    minutes: number;
  }) => {
    const totalMs = value.hours * 3600000 + value.minutes * 60000;
    if (totalMs === 0) {
      await updateTimerDuration(null);
      await updateCustomTimer(null, null);
      setTimerDuration(null);
      setCustomTimer({ hours: 0, minutes: 0 });
      setHasTimerConfigured(timerChapters !== null);
    } else {
      await updateTimerDuration(totalMs);
      await updateCustomTimer(value.hours, value.minutes);
      await updateChapterTimer(null);
      setTimerDuration(totalMs);
      setCustomTimer(value);
      setTimerChapters(null);
      setHasTimerConfigured(true);
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
          const { timerDuration, timerChapters } = await getTimerSettings();
          // Arm via activate() rather than raw DB writes: it updates the
          // service's in-memory cache (no longer refreshed by per-tick DB
          // polling), schedules the Doze backup timer, and syncs the store.
          if (timerDuration !== null) {
            await sleepTimer.activate({
              kind: 'duration',
              durationMs: timerDuration,
            });
          } else if (timerChapters !== null) {
            await sleepTimer.activate({
              kind: 'chapter',
              chaptersRemaining: timerChapters,
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
          timerDuration={timerDuration}
          timerChapters={timerChapters}
          customTimer={customTimer}
          onPresetSelect={handlePresetSelect}
          onChapterChange={handleChapterChange}
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
