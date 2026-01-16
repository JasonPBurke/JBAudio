import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import { Info, ArrowLeft, Trash2 } from 'lucide-react-native';
import { ColorPickerModal } from '@/components/ColorPicker';
import { screenPadding } from '@/constants/tokens';
import { withOpacity } from '@/helpers/colorUtils';
import { useTheme } from '@/hooks/useTheme';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { useRouter } from 'expo-router';
import InfoDialogPopup from '@/modals/InfoDialogPopup';
import ToggleSwitch from '@/components/animations/ToggleSwitch';
import { useSettingsStore } from '@/store/settingsStore';
import { refreshLibraryStore } from '@/store/library';
import {
  updateTimerFadeoutDuration,
  getTimerFadeoutDuration,
  getTimerSettings,
  getLibraryFolders,
  removeLibraryFolder,
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

const SettingsScreen = ({ navigation }: any) => {
  const { colors: themeColors } = useTheme();
  const { numColumns, setNumColumns } = useSettingsStore();
  const [fadeoutDuration, setFadeoutDuration] = useState('10');
  const [maxFadeMinutes, setMaxFadeMinutes] = useState<number>(30);
  const [libraryFolders, setLibraryFolders] = useState<string[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  const bedtimeDefaultStart = new Date();
  bedtimeDefaultStart.setHours(0, 0, 0, 0);
  const [bedtimeStartValue, setBedtimeStartValue] = useState<Date>(
    new Date()
  );
  const [bedtimeEndValue, setBedtimeEndValue] = useState<Date>(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [bedtimeModeEnabled, setBedtimeModeEnabledLocal] = useState(false);
  const [hasTimerConfigured, setHasTimerConfigured] = useState(false);
  const router = useRouter();
  const fadeOutDurationInfo =
    'When the sleep timer is activated, the audio will begin to fade out when the sleep time remaining is the same as the fade-out duration you have set.  If the fade-out duration exceeds the timer duration, fade-out will begin when the timer begins.';
  //! calculate length based off currentTimer (max of 30) or 30 as default
  //! the fadeout duration should always max out at the currentTimer value if > 30 or 30
  const numbers = Array.from(
    { length: Math.max(0, maxFadeMinutes) },
    (_, index) => index + 1
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const fetchSettingsState = async () => {
        // Fetch library folders
        const folders = await getLibraryFolders();
        if (isActive) {
          setLibraryFolders(folders);
        }
        try {
          // Get current fadeout value (ms or null)
          const DbFadeoutValue = await getTimerFadeoutDuration();
          let fadeoutValueMinutes: number | null =
            DbFadeoutValue !== null
              ? Math.floor(DbFadeoutValue / 60000)
              : null;

          // Get current timer settings to derive cap (minutes)
          const timerSettings = await getTimerSettings();
          const timerDurationMinutes =
            timerSettings.timerDuration !== null
              ? Math.floor(timerSettings.timerDuration / 60000)
              : null;

          // Compute cap: min(timerDurationMinutes, 30); default 30 when timer not set
          const cap = Math.min(30, timerDurationMinutes ?? 30);
          if (isActive) setMaxFadeMinutes(cap);

          // If stored fadeout exceeds cap, correct it in DB and UI
          if (fadeoutValueMinutes !== null && fadeoutValueMinutes > cap) {
            await updateTimerFadeoutDuration(cap > 0 ? cap * 60000 : null);
            fadeoutValueMinutes = cap > 0 ? cap : null;
          }

          // Update picker selection
          if (
            isActive &&
            fadeoutValueMinutes !== null &&
            fadeoutValueMinutes > 0
          ) {
            setFadeoutDuration(fadeoutValueMinutes.toString());
          } else if (isActive) {
            setFadeoutDuration('');
          }

          // Check if timer is configured
          if (isActive) {
            const hasTimer =
              timerSettings.timerDuration !== null ||
              timerSettings.timerChapters !== null;
            setHasTimerConfigured(hasTimer);
          }
        } catch (error) {
          console.error('Failed to fetch fadeout/timer settings:', error);
        }

        // Fetch bedtime settings
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

  const handleRemoveFolder = (folderPath: string) => {
    Alert.alert(
      'Remove Library',
      `Are you sure you want to remove this folder and all of its books from your library?\n\n${folderPath}`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeLibraryFolder(folderPath);
            // Force refresh the library store to sync with database
            await refreshLibraryStore();
            // Update local state to reflect the removal immediately
            setLibraryFolders((prev) =>
              prev.filter((path) => path !== folderPath)
            );
          },
        },
      ]
    );
  };

  const showColorPicker = () => {
    setColorPickerVisible(true);
  };

  const enabledValue = useSharedValue(0);
  const toggleSwitch = async () => {
    // Check if timer is configured
    if (!hasTimerConfigured && !bedtimeModeEnabled) {
      Alert.alert(
        'No Timer Configured',
        'Please configure a sleep timer duration or chapter count before enabling Bedtime Mode.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    const newValue = !bedtimeModeEnabled;

    // Update UI immediately
    enabledValue.value = newValue ? 1 : 0;
    setBedtimeModeEnabledLocal(newValue);

    // Persist to database
    await setBedtimeModeEnabled(newValue);

    // If enabling within window AND audio playing, activate timer immediately
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
      <View>
        <Pressable
          hitSlop={10}
          style={{ paddingLeft: 13, paddingTop: 13 }}
          onPress={() => {
            router.back();
          }}
        >
          <ArrowLeft size={24} color={themeColors.textMuted} />
        </Pressable>
        <Text style={[styles.headerStyle, { color: themeColors.text }]}>
          Settings
        </Text>
      </View>
      <View style={{ gap: 8 }}>
        <Text
          style={[styles.sectionHeaderStyle, { color: themeColors.text }]}
        >
          General
        </Text>
        <View style={styles.rowStyle}>
          <Text style={[styles.content, { color: themeColors.textMuted }]}>
            Number of Columns:
          </Text>
          <SegmentedControl
            style={{ flex: 1, height: 40 }}
            backgroundColor={themeColors.background}
            activeFontStyle={{ color: themeColors.primary }}
            fontStyle={{ color: themeColors.textMuted }}
            values={['One', 'Two', 'Three']}
            selectedIndex={numColumns - 1}
            onChange={(event) => {
              const numberOfColumns =
                event.nativeEvent.selectedSegmentIndex + 1;
              setNumColumns(numberOfColumns);
            }}
          />
        </View>
        <View style={styles.rowStyle}>
          <Text style={[styles.content, { color: themeColors.textMuted }]}>
            Change Primary Color:
          </Text>
          <Pressable onPress={showColorPicker}>
            <View
              style={[
                styles.showPrimaryColor,

                { backgroundColor: themeColors.primary, borderRadius: 50 },
              ]}
            />
          </Pressable>
        </View>
      </View>
      <View>
        <Text
          style={[styles.sectionHeaderStyle, { color: themeColors.text }]}
        >
          Sleep Timer
        </Text>
        <View style={styles.rowStyle}>
          <Pressable onPress={() => setModalVisible(true)}>
            <Text
              style={[styles.content, { color: themeColors.textMuted }]}
            >
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
                updateTimerFadeoutDuration(itemIndex * 60000); // converting to ms
              } else {
                updateTimerFadeoutDuration(null);
              }
            }}
            mode='dropdown'
          >
            <Picker.Item label='None' value='' />
            {numbers.map((number) => (
              <Picker.Item
                // color={themeColors.text}
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
                const startMinutes =
                  dateToMinutesSinceMidnight(selectedDate);
                const endMinutes =
                  dateToMinutesSinceMidnight(bedtimeEndValue);
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
      <View>
        <Text
          style={[styles.sectionHeaderStyle, { color: themeColors.text }]}
        >
          Player
        </Text>
      </View>
      <View>
        <Text
          style={[styles.sectionHeaderStyle, { color: themeColors.text }]}
        >
          Library Folders
        </Text>
        {libraryFolders.map((folder, index) => (
          <View key={index} style={styles.rowStyle}>
            <Text
              style={[
                styles.content,
                { flex: 1, color: themeColors.textMuted },
              ]}
              numberOfLines={2}
            >
              {folder}
            </Text>
            <TouchableOpacity
              onPress={() => handleRemoveFolder(folder)}
              style={[
                styles.removeButton,
                { backgroundColor: withOpacity(themeColors.danger, 0.1) },
              ]}
            >
              <Trash2 size={20} color={themeColors.danger} />
              <Text
                style={[
                  styles.removeButtonText,
                  { color: themeColors.danger },
                ]}
              >
                Remove
              </Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
      <ColorPickerModal
        isVisible={colorPickerVisible}
        onClose={() => setColorPickerVisible(false)}
      />
    </View>
  );
};

export default SettingsScreen;

const styles = StyleSheet.create({
  container: {
    paddingTop: 50,
    flex: 1,
    gap: 20,
    // backgroundColor moved to inline for theme support
    paddingHorizontal: screenPadding.horizontal,
  },
  headerStyle: {
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 50,
    fontSize: 36,
    fontWeight: 'bold',
    // color moved to inline for theme support
  },
  sectionHeaderStyle: {
    fontSize: 24,
    fontWeight: 'bold',
    // color moved to inline for theme support
  },
  rowStyle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 30,
    alignItems: 'center',
  },
  content: {
    fontSize: 16,
    // color moved to inline for theme support
    marginVertical: 10,
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    // backgroundColor should be applied inline with theme colors
  },
  removeButtonText: {
    // color should be applied inline with theme colors
    fontWeight: '600',
  },
  showPrimaryColor: {
    height: 30,
    width: 30,
  },
});
