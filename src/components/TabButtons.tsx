import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, fontSize } from '@/constants/tokens';
import { useState } from 'react';
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

//? Gold/black/purple: #1C1C1C, #3B3B3B, #FFE002, #FFB606, #B28228, #492666, #830982

const TabButtons = ({
  buttons,
  selectedTab,
  setSelectedTab,
}: TabButtonsProps) => {
  const [dimensions, setDimensions] = useState({ height: 20, width: 100 });

  const buttonWidth = dimensions.width / buttons.length;

  const tabPositionX = useSharedValue(0);

  const onTabbarLayout = (event: LayoutChangeEvent) => {
    setDimensions({
      height: event.nativeEvent.layout.height,
      width: event.nativeEvent.layout.width,
    });
  };

  const handlePress = (index: number) => {
    setSelectedTab(index);
  };

  const onTabPress = (index: number) => {
    tabPositionX.value = withTiming(buttonWidth * index, {}, () => {
      runOnJS(handlePress)(index);
    });
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: tabPositionX.value }],
    };
  });

  // const borderRadiusSettings = () => {
  //   if (selectedTab === 0) {
  //     return {
  //       borderTopLeftRadius: 12,
  //       borderTopRightRadius: 0,
  //       borderBottomLeftRadius: 12,
  //       borderBottomRightRadius: 0,
  //     };
  //   } else if (selectedTab === buttons.length - 1) {
  //     return {
  //       borderTopLeftRadius: 0,
  //       borderTopRightRadius: 12,
  //       borderBottomLeftRadius: 0,
  //       borderBottomRightRadius: 12,
  //     };
  //   } else {
  //     return {
  //       borderTopLeftRadius: 0,
  //       borderTopRightRadius: 0,
  //       borderBottomLeftRadius: 0,
  //       borderBottomRightRadius: 0,
  //     };
  //   }
  // };

  // const borderStyles = borderRadiusSettings();

  return (
    <View accessibilityRole='tablist' style={styles.container}>
      <Animated.View
        style={[
          animatedStyle,
          {
            position: 'absolute',
            // backgroundColor: '#453375c3',
            backgroundColor: '#ffb406dd',
            borderRadius: 4,
            // borderTopLeftRadius: borderStyles.borderTopLeftRadius,
            // borderTopRightRadius: borderStyles.borderTopRightRadius,
            // borderBottomLeftRadius: borderStyles.borderBottomLeftRadius,
            // borderBottomRightRadius: borderStyles.borderBottomRightRadius,
            marginHorizontal: 5,
            height: dimensions.height - 10,
            width: buttonWidth - 10,
            // borderColor: '#811781',
            // borderWidth: 1,
          },
        ]}
      />
      <View onLayout={onTabbarLayout} style={{ flexDirection: 'row' }}>
        {buttons.map((button, index) => {
          const color =
            // selectedTab === index ? '#FFB606' : colors.textMuted;
            selectedTab === index ? colors.text : '#d8dee9e1';

          return (
            <Pressable
              key={index}
              style={styles.buttonContainer}
              onPress={() => onTabPress(index)}
            >
              <Text style={{ ...styles.buttonText, color: color }}>
                {button.title}(123)
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
    backgroundColor: '#2b2b2b',
    // backgroundColor: colors.background,
    borderRadius: 4,
    // borderColor: '#830982',
    // borderWidth: 1,
    justifyContent: 'center',
    marginHorizontal: 2,
  },
  buttonContainer: {
    flex: 1,
    paddingVertical: 15,
  },
  buttonText: {
    alignSelf: 'center',
    fontSize: 14,
  },
});
