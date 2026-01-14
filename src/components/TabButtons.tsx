import {
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '@/constants/tokens';
import { useTheme } from '@/hooks/useTheme';
import { useState } from 'react';
import { withOpacity } from '@/helpers/colorUtils';
import { scheduleOnRN } from 'react-native-worklets';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export type TabButtonsType = {
  title: string;
};

interface TabButtonsProps {
  buttons: TabButtonsType[];
  selectedTab: number;
  setSelectedTab: (index: number) => void;
}

//? black/gold/purple: #1C1C1C, #3B3B3B, #FFE002, #FFB606, #B28228, #492666, #830982

const TabButtons = ({
  buttons,
  selectedTab,
  setSelectedTab,
}: TabButtonsProps) => {
  const { colors: themeColors } = useTheme();

  const [buttonMeasurements, setButtonMeasurements] = useState<
    { width: number; x: number }[]
  >([]);
  const [tabbarHeight, setTabbarHeight] = useState(0);

  const tabPositionX = useSharedValue(0);
  const tabWidth = useSharedValue(0);

  const handlePress = (index: number) => {
    setSelectedTab(index);
  };

  const onTabPress = (index: number) => {
    if (buttonMeasurements[index]) {
      tabPositionX.value = withTiming(
        buttonMeasurements[index].x,
        {},
        () => {
          scheduleOnRN(handlePress, index);
        }
      );
      tabWidth.value = withTiming(buttonMeasurements[index].width);
    }
  };

  const onButtonLayout = (event: LayoutChangeEvent, index: number) => {
    const { width, x } = event.nativeEvent.layout;
    setButtonMeasurements((prev) => {
      const newMeasurements = [...prev];
      newMeasurements[index] = { width, x };
      return newMeasurements;
    });

    if (index === selectedTab) {
      tabPositionX.value = x;
      tabWidth.value = width;
    }
  };

  const onTabbarLayout = (event: LayoutChangeEvent) => {
    setTabbarHeight(event.nativeEvent.layout.height);
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: tabPositionX.value }],
      width: tabWidth.value, // Use shared value directly
    };
  });

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ flexGrow: 1 }}
      accessibilityRole='tablist'
      style={[
        styles.container,
        { backgroundColor: themeColors.background },
      ]}
    >
      <Animated.View
        style={[
          animatedStyle,
          {
            position: 'absolute',
            backgroundColor: withOpacity(themeColors.primary, 0.8),
            borderRadius: 4,
            height: tabbarHeight - 10,
            top: 5,
          },
        ]}
      />
      <View
        onLayout={onTabbarLayout}
        style={{
          flexDirection: 'row',
          justifyContent: 'space-around',
          minWidth: '100%',
        }}
      >
        {buttons.map((button, index) => {
          const color =
            selectedTab === index
              ? themeColors.text
              : withOpacity(themeColors.textMuted, 0.56);

          return (
            <Pressable
              key={index}
              style={styles.buttonContainer}
              onPress={() => onTabPress(index)}
              onLayout={(event) => onButtonLayout(event, index)}
            >
              <Text style={{ ...styles.buttonText, color: color }}>
                {button.title}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
};

export default TabButtons;

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderRadius: 4,
    // justifyContent: 'center',
    marginHorizontal: 4,
  },
  buttonContainer: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  buttonText: {
    alignSelf: 'center',
    fontSize: 14,
  },
});
