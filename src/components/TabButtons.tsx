import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '@/constants/tokens';
import { useEffect, useState } from 'react';
import { observeTotalBookCount } from '@/db/bookQueries';
import Animated, {
  runOnJS,
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
  const [buttonMeasurements, setButtonMeasurements] = useState<
    { width: number; x: number }[]
  >([]);
  const [tabbarHeight, setTabbarHeight] = useState(0);
  const [bookCount, setBookCount] = useState(0);

  useEffect(() => {
    const subscription = observeTotalBookCount().subscribe((count) => {
      setBookCount(count);
    });

    return () => subscription.unsubscribe();
  }, []);

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
          runOnJS(handlePress)(index);
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
    <View accessibilityRole='tablist' style={styles.container}>
      <Animated.View
        style={[
          animatedStyle,
          {
            position: 'absolute',
            backgroundColor: '#ffb606cc',
            borderRadius: 4,
            height: tabbarHeight - 10,
            // borderColor: '#ffb606',
            // borderWidth: StyleSheet.hairlineWidth,
          },
        ]}
      />
      <View
        onLayout={onTabbarLayout}
        style={{ flexDirection: 'row', justifyContent: 'space-around' }}
      >
        {buttons.map((button, index) => {
          const color = selectedTab === index ? colors.text : '#d8dee98f';

          return (
            <Pressable
              key={index}
              style={styles.buttonContainer}
              onPress={() => onTabPress(index)}
              onLayout={(event) => onButtonLayout(event, index)}
            >
              <Text style={{ ...styles.buttonText, color: color }}>
                {button.title} ({bookCount})
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

export default TabButtons;

const styles = StyleSheet.create({
  container: {
    // backgroundColor: '#2b2b2b',
    backgroundColor: colors.background,
    borderRadius: 4,
    // borderColor: '#cc00cc',
    // borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
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
