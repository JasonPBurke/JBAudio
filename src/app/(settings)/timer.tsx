import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  ScrollView,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import {
  Info,
  Sunrise,
  Sunset,
  Moon,
  ClockFading,
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
  updateTimerActive,
  updateSleepTime,
  updateTimerDuration,
  updateCustomTimer,
  updateChapterTimer,
} from '@/db/settingsQueries';
import RNDateTimePicker from '@react-native-community/datetimepicker';
import TrackPlayer, { State } from 'react-native-track-player';
import {
  isWithinBedtimeWindow,
  dateToMinutesSinceMidnight,
  minutesSinceMidnightToDate,
} from '@/helpers/bedtimeUtils';
import { useRequiresPro } from '@/hooks/useRequiresPro';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import SleepTimerDurationCard from '@/components/settings/SleepTimerDurationCard';
import { useLibraryStore } from '@/store/library';
import { findChapterIndexByPosition } from '@/helpers/singleFileBook';

const TimerSettingsScreen = () => {
  const { colors: themeColors } = useTheme();
  const { isProUser, presentPaywall } = useRequiresPro();
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
  const [maxChapters, setMaxChapters] = useState(20);
  const [hasActiveTrack, setHasActiveTrack] = useState(false);
  const enabledValue = useSharedValue(0);

  const fadeOutDurationInfo =
    'When the sleep timer is activated, the audio will begin to fade out when the sleep time remaining is the same as the fade-out duration you have set.  If the fade-out duration exceeds the timer duration, fade-out will begin when the timer begins.';

  // Hard cap at 30 minutes for fade duration picker options
  const numbers = Array.from({ length: 30 }, (_, index) => index + 1);

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

        // Compute maxChapters from TrackPlayer state
        try {
          const activeTrack = await TrackPlayer.getActiveTrack();
          if (isActive) {
            setHasActiveTrack(
              activeTrack !== null && activeTrack !== undefined,
            );
          }
          const queue = await TrackPlayer.getQueue();
          const isSingleFile = queue.length === 1;

          if (isSingleFile) {
            if (activeTrack?.bookId) {
              const book =
                useLibraryStore.getState().books[activeTrack.bookId];
              if (book?.chapters && book.chapters.length > 1) {
                const { position } = await TrackPlayer.getProgress();
                const currentChapterIndex = findChapterIndexByPosition(
                  book.chapters,
                  position,
                );
                if (isActive) {
                  setMaxChapters(
                    book.chapters.length - 1 - currentChapterIndex,
                  );
                }
              } else if (isActive) {
                setMaxChapters(0);
              }
            } else if (isActive) {
              setMaxChapters(0);
            }
          } else if (queue.length > 1) {
            const currentTrackIndex =
              await TrackPlayer.getActiveTrackIndex();
            if (isActive) {
              if (currentTrackIndex !== undefined) {
                setMaxChapters(queue.length - 1 - currentTrackIndex);
              } else {
                setMaxChapters(0);
              }
            }
          } else if (isActive) {
            setMaxChapters(20);
          }
        } catch {
          // No track playing — use fallback
          if (isActive) {
            setMaxChapters(20);
            setHasActiveTrack(false);
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
      await presentPaywall();
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
        const playerState = await TrackPlayer.getPlaybackState();
        if (playerState.state === State.Playing) {
          const { timerDuration, timerChapters } = await getTimerSettings();
          if (timerDuration !== null) {
            await updateTimerActive(true);
            await updateSleepTime(Date.now() + timerDuration);
          } else if (timerChapters !== null) {
            await updateTimerActive(true);
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
                // Gate: non-Pro users cannot select durations above 1 minute
                if (itemIndex > 1 && !isProUser) {
                  await presentPaywall();
                  const nowPro = useSubscriptionStore.getState().isProUser;
                  if (!nowPro) return;
                }

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
          hasActiveTrack={hasActiveTrack}
        />

        <SettingsCard title='Bedtime Mode' icon={Moon}>
          <CompactSettingsRow
            label='Enable Bedtime Mode'
            control={
              <ToggleSwitch
                value={enabledValue}
                onPress={
                  hasTimerConfigured
                    ? toggleSwitch
                    : () => {
                        Alert.alert(
                          'No Timer Configured',
                          'Please configure a sleep timer before enabling Bedtime Mode.',
                          [{ text: 'OK' }],
                        );
                      }
                }
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
    paddingBottom: 20,
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
    fontFamily: 'Rubik-SemiBold',
    fontSize: 15,
  },
});
