import {
  Button,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import { Info, ArrowLeft } from 'lucide-react-native';

import { colors, screenPadding } from '@/constants/tokens';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { useRouter } from 'expo-router';
import InfoDialogPopup from '@/modals/InfoDialogPopup';
import {
  getNumColumns,
  updateNumColumns,
  updateTimerFadeoutDuration,
  getTimerFadeoutDuration,
  getTimerSettings,
} from '@/db/settingsQueries';

const SettingsScreen = ({ navigation }: any) => {
  const [selectedColIndex, setSelectedColIndex] = useState(0);
  const [fadeoutDuration, setFadeoutDuration] = useState('10');
  const [maxFadeMinutes, setMaxFadeMinutes] = useState<number>(30);
  const [modalVisible, setModalVisible] = useState(false);
  const router = useRouter();
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
        try {
          const colValue = await getNumColumns();
          if (isActive && colValue) {
            setSelectedColIndex(colValue - 1); // -1 because segmented control is 0-indexed
          }
        } catch (error) {
          console.error('Failed to fetch number of columns:', error);
        }
        try {
          // Get current fadeout value (ms or null)
          const DbFadeoutValue = await getTimerFadeoutDuration();
          let fadeoutValueMinutes: number | null =
            DbFadeoutValue !== null
              ? Math.floor(DbFadeoutValue / 60000)
              : null;

          // Get current timer settings to derive cap (minutes)
          const { timerDuration } = await getTimerSettings();
          const timerDurationMinutes =
            timerDuration !== null
              ? Math.floor(timerDuration / 60000)
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
        } catch (error) {
          console.error('Failed to fetch fadeout/timer settings:', error);
        }
      };
      fetchSettingsState();

      return () => {
        isActive = false;
      };
    }, [])
  );

  return (
    <View style={styles.container}>
      <View>
        <Pressable
          style={{ marginLeft: 13, marginTop: 13 }}
          onPress={() => {
            router.back();
          }}
        >
          <ArrowLeft size={24} color={colors.textMuted} />
        </Pressable>
        <Text style={styles.headerStyle}>Settings</Text>
      </View>
      <View>
        <Text style={styles.sectionHeaderStyle}>General</Text>
        <View style={styles.rowStyle}>
          <Text style={styles.content}>Number of Columns:</Text>
          <SegmentedControl
            style={{ flex: 1, height: 40 }}
            activeFontStyle={{ color: colors.primary }}
            values={['One', 'Two', 'Three']}
            selectedIndex={selectedColIndex}
            onChange={(event) => {
              const numberOfColumns =
                event.nativeEvent.selectedSegmentIndex + 1;
              setSelectedColIndex(event.nativeEvent.selectedSegmentIndex);
              updateNumColumns(numberOfColumns);
            }}
          />
        </View>
      </View>
      <View>
        <Text style={styles.sectionHeaderStyle}>Sleep Timer</Text>
        <View style={styles.rowStyle}>
          <Pressable onPress={() => setModalVisible(true)}>
            <Text style={styles.content}>
              Fadeout Duration{' '}
              <Info
                color={colors.textMuted}
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
              color: colors.text,
            }}
            itemStyle={{ borderColor: colors.primary, borderWidth: 1 }}
            dropdownIconColor={colors.primary}
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
          message='When the sleep timer is activated, the audio will begin to fade out when the sleep time remaining is the same as the fade-out duration you have set.  If the fade-out duration exceeds the timer duration, fade-out will begin when the timer begins.'
        />
      </View>
      <View>
        <Text style={styles.sectionHeaderStyle}>UI</Text>
      </View>
    </View>
  );
};

export default SettingsScreen;

const styles = StyleSheet.create({
  container: {
    paddingTop: 50,
    flex: 1,
    gap: 20,
    backgroundColor: '#252525',
    paddingHorizontal: screenPadding.horizontal,
  },
  headerStyle: {
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 50,
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.text,
  },
  sectionHeaderStyle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  rowStyle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 30,
    alignItems: 'center',
  },
  content: {
    fontSize: 16,
    color: colors.textMuted,
    marginVertical: 10,
  },
});
