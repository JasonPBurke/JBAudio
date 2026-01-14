import { useMemo } from 'react';
import { useThemeStore } from '@/store/themeStore';
import { colorTokens } from '@/constants/tokens';

/**
 * Theme hook that provides colors based on the active color scheme
 *
 * Returns an object with:
 * - colors: Merged color tokens (active scheme + shared colors)
 * - activeColorScheme: Current active scheme ('light' | 'dark')
 *
 * @example
 * const { colors, activeColorScheme } = useTheme();
 * <View style={{ backgroundColor: colors.background }}>
 *   <Text style={{ color: colors.text }}>Hello</Text>
 * </View>
 */
export const useTheme = () => {
  const activeColorScheme = useThemeStore((state) => state.activeColorScheme);

  const colors = useMemo(
    () => ({
      ...colorTokens[activeColorScheme],
      ...colorTokens.shared,
    }),
    [activeColorScheme]
  );

  return {
    colors,
    activeColorScheme,
  };
};
