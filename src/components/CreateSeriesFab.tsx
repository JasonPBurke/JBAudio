import React, { memo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { PressableScale } from 'pressto';
import { Plus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/useTheme';

const FAB_SIZE = 56;
/** Clears FloatingPlayer, whose top edge sits at insets.bottom + 48 (it renders
 *  at bottom: 10 with marginBottom: insets.bottom - 12 and height: 50). The
 *  offset is deliberately static rather than tracking whether a track is
 *  loaded, so the button never moves under the user's thumb. */
const FAB_BOTTOM_OFFSET = 64;

type Props = {
  /** Shared with SearchBar so both chrome elements move as one. */
  isVisible: SharedValue<number>;
  onPress: () => void;
};

const CreateSeriesFab = ({ isVisible, onPress }: Props) => {
  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();

  const animatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      isVisible.value,
      [0, 1],
      [FAB_SIZE + FAB_BOTTOM_OFFSET, 0],
      Extrapolation.CLAMP,
    );
    return { opacity: isVisible.value, transform: [{ translateY }] };
  });

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { bottom: insets.bottom + FAB_BOTTOM_OFFSET },
        animatedStyle,
      ]}
      pointerEvents='box-none'
    >
      <PressableScale
        rippleRadius={0}
        onPress={onPress}
        accessibilityLabel='Create series'
        accessibilityRole='button'
        style={[styles.button, { backgroundColor: themeColors.primary }]}
      >
        <Plus size={28} color={themeColors.background} strokeWidth={2.5} />
      </PressableScale>
    </Animated.View>
  );
};

export default memo(CreateSeriesFab);

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    right: 16,
  },
  button: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
});
