import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { colors, screenPadding } from '@/constants/tokens';
import { useState } from 'react';
import {
  TimerPickerModal,
  // TimerPickerModalProps,
} from 'react-native-timer-picker';
import { Settings, CirclePlus, CircleMinus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

const SleepTimerOptions = () => {
  const [showSlider, setShowSlider] = useState(false);
  const [customTimer, setCustomTimer] = useState({ hours: 0, minutes: 0 });
  const { bottom } = useSafeAreaInsets();

  return (
    <View style={[styles.container, { marginBottom: bottom }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Sleep Timer Options</Text>
        <TouchableOpacity>
          <Settings
            size={24}
            color={colors.primary}
            strokeWidth={1}
            absoluteStrokeWidth
          />
        </TouchableOpacity>
      </View>

      <View style={styles.buttonContainer}>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>15 mins</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>30 mins</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>45 mins</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>1 hr</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>1.5 hrs</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>2 hrs</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.chapterEndButton]}
          >
            <TouchableOpacity
              style={{
                padding: 10,
                // paddingEnd: 0,
                borderRadius: 4,
              }}
            >
              <CircleMinus
                size={28}
                color={colors.textMuted}
                strokeWidth={1.5}
                absoluteStrokeWidth
              />
            </TouchableOpacity>
            {/* //optionally below - 'End of n Chapters' w/ the padding start/end applied */}
            <Text style={styles.buttonText}>Chapter End</Text>
            <TouchableOpacity
              style={{
                padding: 10,
                // paddingStart: 0,
                borderRadius: 4,
                // borderColor: 'red',
                // borderWidth: 1,
              }}
            >
              <CirclePlus
                size={28}
                color={colors.textMuted}
                strokeWidth={1.5}
                absoluteStrokeWidth
              />
            </TouchableOpacity>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.customButton}
            onPress={() => setShowSlider(true)}
          >
            <Text
              style={[
                styles.buttonText,
                customTimer.hours === 0 && customTimer.minutes === 0
                  ? { color: colors.textMuted }
                  : { color: '#d8dee96f' },
              ]}
            >
              Custom
            </Text>
            {customTimer.hours === 0 && customTimer.minutes === 0 ? null : (
              <Text style={styles.buttonText}>
                {customTimer.hours}:
                {customTimer.minutes < 10
                  ? `0${customTimer.minutes}`
                  : `${customTimer.minutes}`}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <TimerPickerModal
        visible={showSlider}
        setIsVisible={setShowSlider}
        closeOnOverlayPress
        hideSeconds
        maximumHours={24} //! SET TO HOURS REMAINING IN QUEUE
        modalTitle='Custom Sleep Timer'
        confirmButtonText='   Set   '
        LinearGradient={LinearGradient}
        onCancel={() => setShowSlider(false)}
        onConfirm={(value) => {
          setCustomTimer(value);
          setShowSlider(false);
        }}
        styles={{
          theme: 'dark',
          contentContainer: {},
          button: { borderRadius: 4 },
          cancelButton: { backgroundColor: colors.background },
          confirmButton: {
            backgroundColor: colors.background,
            borderColor: colors.primary,
          },
        }}
      />
    </View>
  );
};

export default SleepTimerOptions;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: screenPadding.horizontal,
  },
  buttonContainer: {
    flex: 1,
    justifyContent: 'space-around',
    paddingVertical: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginRight: 6,
  },
  title: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: 'bold',
    marginStart: 12,
  },

  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  button: {
    flex: 1,
    backgroundColor: colors.background,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginHorizontal: 15,
    borderRadius: 4,
    borderColor: colors.textMuted,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: colors.textMuted,
    alignSelf: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  chapterEndButton: {
    flex: 2.8, // Span two buttons
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  customButton: {
    flex: 1, // Span one button
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    marginHorizontal: 15,
    borderRadius: 4,
    borderColor: colors.textMuted,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
