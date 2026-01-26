'use no memo'; // Reanimated worklets are incompatible with React Compiler

import {
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  SharedValue,
  interpolate,
} from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { withOpacity } from '@/helpers/colorUtils';

export const SEARCH_BAR_HEIGHT = 38;

interface SearchBarProps extends Omit<TextInputProps, 'style'> {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
  isVisible: SharedValue<number>;
}

function SearchBar({
  value,
  onChangeText,
  onClear,
  isVisible,
  ...textInputProps
}: SearchBarProps) {
  const { colors: themeColors } = useTheme();

  const animatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      isVisible.value,
      [0, 1],
      [-SEARCH_BAR_HEIGHT - 8, 0], // Hide above the container
    );

    return {
      transform: [{ translateY }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.overlay,
        { backgroundColor: themeColors.background },
        animatedStyle,
      ]}
    >
      <View
        style={[
          styles.container,
          { backgroundColor: themeColors.modalBackground },
        ]}
      >
        <TextInput
          style={[styles.input, { color: themeColors.text }]}
          placeholder='Search books, authors...'
          placeholderTextColor={withOpacity(themeColors.textMuted, 0.56)}
          value={value}
          onChangeText={onChangeText}
          cursorColor={themeColors.primary}
          selectionColor={withOpacity(themeColors.primary, 0.56)}
          returnKeyType='search'
          autoCorrect={false}
          autoCapitalize='none'
          {...textInputProps}
        />
        {value.length > 0 && (
          <TouchableOpacity
            onPress={onClear}
            style={styles.clearButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={20} color={themeColors.textMuted} strokeWidth={1.5} />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 4,
    height: SEARCH_BAR_HEIGHT, // - 10 etc.
  },
  input: {
    flex: 1,
    paddingHorizontal: 10,
    // paddingVertical: 7,
    // paddingTop: 7,
    fontSize: 14,
    fontFamily: 'Rubik',
    includeFontPadding: false,
  },
  clearButton: {
    padding: 7,
    marginRight: 2,
  },
});

export default SearchBar;
