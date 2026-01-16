import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useState, useCallback } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import { Info } from 'lucide-react-native';
import SettingsHeader from '@/components/SettingsHeader';
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
} from '@/db/settingsQueries';
import RNDateTimePicker from '@react-native-community/datetimepicker';
import TrackPlayer, { State } from 'react-native-track-player';
import {
  isWithinBedtimeWindow,
  dateToMinutesSinceMidnight,
  minutesSinceMidnightToDate,
} from '@/helpers/bedtimeUtils';

const TimerSettingsScreen = () => {
  const { colors: themeColors } = useTheme();
  const [fadeoutDuration, setFadeoutDuration] = useState('10');
  const [maxFadeMinutes, setMaxFadeMinutes] = useState<number>(30);
  const [modalVisible, setModalVisible] = useState(false);
  const [bedtimeStartValue, setBedtimeStartValue] = useState<Date>(new Date());
  const [bedtimeEndValue, setBedtimeEndValue] = useState<Date>(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [bedtimeModeEnabled, setBedtimeModeEnabledLocal] = useState(false);
  const [hasTimerConfigured, setHasTimerConfigured] = useState(false);
  const enabledValue = useSharedValue(0);

  const fadeOutDurationInfo =
    'When the sleep timer is activated, the audio will begin to fade out when the sleep time remaining is the same as the fade-out duration you have set.  If the fade-out duration exceeds the timer duration, fade-out will begin when the timer begins.';

  const numbers = Array.from(
    { length: Math.max(0, maxFadeMinutes) },
    (_, index) => index + 1
  );

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
          const timerDurationMinutes =
            timerSettings.timerDuration !== null
              ? Math.floor(timerSettings.timerDuration / 60000)
              : null;

          const cap = Math.min(30, timerDurationMinutes ?? 30);
          if (isActive) setMaxFadeMinutes(cap);

          if (fadeoutValueMinutes !== null && fadeoutValueMinutes > cap) {
            await updateTimerFadeoutDuration(cap > 0 ? cap * 60000 : null);
            fadeoutValueMinutes = cap > 0 ? cap : null;
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
          }
        } catch (error) {
          console.error('Failed to fetch fadeout/timer settings:', error);
        }

        try {
          const bedtimeSettings = await getBedtimeSettings();
          if (isActive) {
            if (bedtimeSettings.bedtimeStart !== null) {
              setBedtimeStartValue(
                minutesSinceMidnightToDate(bedtimeSettings.bedtimeStart)
              );
            }
            if (bedtimeSettings.bedtimeEnd !== null) {
              setBedtimeEndValue(
                minutesSinceMidnightToDate(bedtimeSettings.bedtimeEnd)
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
    }, [])
  );

  const toggleSwitch = async () => {
    if (!hasTimerConfigured && !bedtimeModeEnabled) {
      Alert.alert(
        'No Timer Configured',
        'Please configure a sleep timer duration or chapter count before enabling Bedtime Mode.',
        [{ text: 'OK', style: 'default' }]
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
      <View>
        <View style={styles.rowStyle}>
          <Pressable onPress={() => setModalVisible(true)}>
            <Text style={[styles.content, { color: themeColors.textMuted }]}>
              Fadeout Duration{' '}
              <Info
                color={themeColors.textMuted}
                size={12}
                style={{ marginStart: 5 }}
                strokeWidth={1}
                absoluteStrokeWidth
              />
            </Text>
          </Pressable>
          <Picker
            style={{
              width: 125,
              height: 50,
              color: themeColors.text,
              backgroundColor: themeColors.background,
            }}
            itemStyle={{
              borderColor: themeColors.primary,
              borderWidth: 1,
            }}
            dropdownIconColor={themeColors.primary}
            selectedValue={fadeoutDuration}
            onValueChange={(itemValue, itemIndex) => {
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
        <InfoDialogPopup
          isVisible={modalVisible}
          onClose={() => setModalVisible(false)}
          title='Fadeout Duration'
          message={fadeOutDurationInfo}
        />
        <View
          style={[styles.rowStyle, !hasTimerConfigured && { opacity: 0.5 }]}
        >
          <Text style={[styles.content, { color: themeColors.textMuted }]}>
            Toggle Bedtime Mode
          </Text>
          <ToggleSwitch
            value={enabledValue}
            onPress={
              hasTimerConfigured
                ? toggleSwitch
                : () => {
                    Alert.alert(
                      'No Timer Configured',
                      'Please configure a sleep timer before enabling Bedtime Mode.',
                      [{ text: 'OK' }]
                    );
                  }
            }
            style={{ width: 72, height: 36, padding: 5 }}
            trackColors={{
              on: themeColors.primary,
              off: themeColors.overlay,
            }}
          />
        </View>
        <Pressable
          onPress={() => setShowStartPicker(true)}
          style={styles.rowStyle}
        >
          <Text style={[styles.content, { color: themeColors.textMuted }]}>
            Bedtime Start
          </Text>
          <Text style={[styles.content, { color: themeColors.primary }]}>
            {bedtimeStartValue.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            })}
          </Text>
        </Pressable>
        {showStartPicker && (
          <RNDateTimePicker
            value={bedtimeStartValue}
            mode='time'
            display='spinner'
            onChange={(event, selectedDate) => {
              if (event.type === 'set' && selectedDate) {
                setBedtimeStartValue(selectedDate);
                const startMinutes = dateToMinutesSinceMidnight(selectedDate);
                const endMinutes = dateToMinutesSinceMidnight(bedtimeEndValue);
                setBedtimeSettings(startMinutes, endMinutes);
              }
              setShowStartPicker(false);
            }}
          />
        )}
        <Pressable
          onPress={() => setShowEndPicker(true)}
          style={styles.rowStyle}
        >
          <Text style={[styles.content, { color: themeColors.textMuted }]}>
            Bedtime End
          </Text>
          <Text style={[styles.content, { color: themeColors.primary }]}>
            {bedtimeEndValue.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            })}
          </Text>
        </Pressable>
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
      </View>
    </View>
  );
};

export default TimerSettingsScreen;

const styles = StyleSheet.create({
  container: {
    paddingTop: 50,
    flex: 1,
    gap: 20,
    paddingHorizontal: screenPadding.horizontal,
  },
  rowStyle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 30,
    alignItems: 'center',
  },
  content: {
    fontSize: 16,
    marginVertical: 10,
  },
});
