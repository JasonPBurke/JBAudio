import { Pressable, StyleSheet } from 'react-native';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '@/constants/tokens';
import { withOpacity } from '@/helpers/colorUtils';
import { normalizeSize } from '@/helpers/normalizeSize';

//? = (sheetRef: React.ForwardedRef<BottomSheetModal>) =>
export const DismissIndicator = () => {
  const { top } = useSafeAreaInsets();
  const router = useRouter();
  const handlePress = () => {
    router.back();
  };

  return (
    <Pressable
      hitSlop={10}
      style={{ ...styles.backButton, top: top + normalizeSize(8) }}
      onPress={handlePress}
    />
  );
};

const PILL_HEIGHT = 7;
const PILL_MARGIN_BOTTOM = normalizeSize(18);

/**
 * Layout height this component contributes to the player's flex column.
 *
 * Note the `top` offset applied in the component is a *relative* offset: it
 * shifts the pill below the status bar visually without reserving any layout
 * space, so it is deliberately not part of this total. Exported for
 * PLAYER_CHROME_HEIGHT in player.tsx.
 */
export const DISMISS_INDICATOR_HEIGHT = PILL_HEIGHT + PILL_MARGIN_BOTTOM;

const styles = StyleSheet.create({
  backButton: {
    marginBottom: PILL_MARGIN_BOTTOM,
    width: 55,
    height: PILL_HEIGHT,
    backgroundColor: withOpacity(colors.background, 0.66),
    borderRadius: 50,
    borderColor: colors.textMuted,
    borderWidth: 1,
    justifyContent: 'center',
    alignSelf: 'center',
  },
});
