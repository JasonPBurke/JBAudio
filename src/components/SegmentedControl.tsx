import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { withOpacity } from '@/helpers/colorUtils';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

interface SegmentedControlProps {
  values: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  height?: number;
}

const SegmentedControl = ({
  values,
  selectedIndex,
  onChange,
  height = 40,
}: SegmentedControlProps) => {
  const { colors: themeColors } = useTheme();
  const translateX = useSharedValue(0);
  const segmentWidth = useSharedValue(0);

  const onContainerLayout = (event: { nativeEvent: { layout: { width: number } } }) => {
    const containerWidth = event.nativeEvent.layout.width;
    const width = containerWidth / values.length;
    segmentWidth.value = width;
    translateX.value = selectedIndex * width;
  };

  useEffect(() => {
    if (segmentWidth.value > 0) {
      translateX.value = withTiming(selectedIndex * segmentWidth.value);
    }
  }, [selectedIndex, segmentWidth, translateX]);

  const onSegmentPress = (index: number) => {
    onChange(index);
    translateX.value = withTiming(index * segmentWidth.value);
  };

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    width: segmentWidth.value,
  }));

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: themeColors.modalBackground,
          height,
        },
      ]}
      onLayout={onContainerLayout}
    >
      <Animated.View
        style={[
          styles.indicator,
          indicatorStyle,
          {
            backgroundColor: withOpacity(themeColors.primary, 0.85),
            height: height - 6,
          },
        ]}
      />
      {values.map((value, index) => {
        const isSelected = selectedIndex === index;
        return (
          <Pressable
            key={index}
            style={styles.segment}
            onPress={() => onSegmentPress(index)}
          >
            <Text
              style={[
                styles.segmentText,
                {
                  color: isSelected
                    ? themeColors.text
                    : themeColors.textMuted,
                },
              ]}
            >
              {value}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

export default SegmentedControl;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 3,
  },
  indicator: {
    position: 'absolute',
    top: 3,
    left: 3,
    borderRadius: 6,
  },
  segment: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentText: {
    fontFamily: 'Rubik',
    fontSize: 14,
  },
});
