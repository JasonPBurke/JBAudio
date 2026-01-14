import { Pressable, StyleSheet, Text, View } from 'react-native';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '@/constants/tokens';
import { withOpacity } from '@/helpers/colorUtils';

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
      style={{ ...styles.backButton, top: top + 8 }}
      onPress={handlePress}
    />
  );
};

const styles = StyleSheet.create({
  backButton: {
    marginBottom: 18,
    width: 55,
    height: 7,
    backgroundColor: withOpacity(colors.background, 0.66),
    borderRadius: 50,
    borderColor: colors.textMuted,
    borderWidth: 1,
    justifyContent: 'center',
    alignSelf: 'center',
  },
});
