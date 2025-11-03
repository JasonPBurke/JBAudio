import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { colors, screenPadding } from '@/constants/tokens';
import { Slider } from 'react-native-awesome-slider';
import { useSharedValue } from 'react-native-reanimated';
import { useState } from 'react';
// import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  Settings,
  CirclePlus,
  CircleMinus,
  CircleX,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SleepTimerOptions = () => {
  const progress = useSharedValue(15);
  const min = useSharedValue(0);
  const max = useSharedValue(240);
  const { bottom } = useSafeAreaInsets();
  const [showSlider, setShowSlider] = useState(false);

  return (
    <View style={[styles.container, { marginBottom: bottom }]}>
      {!showSlider ? (
        <>
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
                <Text style={styles.buttonText}>15</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button}>
                <Text style={styles.buttonText}>30</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button}>
                <Text style={styles.buttonText}>45</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.button}>
                <Text style={styles.buttonText}>60</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button}>
                <Text style={styles.buttonText}>90</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button}>
                <Text style={styles.buttonText}>120</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.chapterEndButton]}
              >
                <CircleMinus
                  size={24}
                  color={colors.text}
                  strokeWidth={1.5}
                  absoluteStrokeWidth
                />
                <Text style={styles.buttonText}>Chapter End</Text>
                <CirclePlus
                  size={24}
                  color={colors.text}
                  strokeWidth={1.5}
                  absoluteStrokeWidth
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.customButton]}
                onPress={() => setShowSlider(true)}
              >
                <Text style={styles.buttonText}>Custom</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      ) : (
        <View style={styles.sliderContainer}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowSlider(false)}
          >
            <CircleX
              size={34}
              color={colors.icon}
              strokeWidth={1.5}
              absoluteStrokeWidth
            />
          </TouchableOpacity>
          <Slider
            progress={progress}
            minimumValue={min}
            maximumValue={max}
            theme={{
              minimumTrackTintColor: '#3B3B3B',
              maximumTrackTintColor: '#3B3B3B',
              // bubbleBackgroundColor: '#666',
            }}
            containerStyle={{ borderRadius: 2 }}
            steps={14} //48 steps
            forceSnapToStep
            markStyle={{ height: 80, width: 1 }}
          />
        </View>
      )}
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
    color: colors.text,
    alignSelf: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  chapterEndButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    flex: 2.5, // Span two buttons
  },
  customButton: {
    flex: 1, // Span one button
  },
  sliderContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 2,
    borderColor: 'red',
    overflow: 'hidden',
    borderWidth: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 10,
    zIndex: 1,
  },
});
