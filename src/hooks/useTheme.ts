import { useMemo } from 'react';
import { useThemeStore } from '@/store/themeStore';
import { colorTokens } from '@/constants/tokens';
import { withOpacity } from '@/helpers/colorUtils';

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
  const customPrimaryColor = useThemeStore((state) => state.customPrimaryColor);

  const colors = useMemo(() => {
    // Use custom primary color if set, otherwise use default primary
    const effectivePrimaryColor = customPrimaryColor || colorTokens.shared.primary;

    // Return merged colors with primary override and minimumTrackTintColor added
    return {
      ...colorTokens[activeColorScheme],
      ...colorTokens.shared,
      primary: effectivePrimaryColor,
      minimumTrackTintColor: effectivePrimaryColor,
      // Pre-computed opacity variants used in scroll-hot components
      primaryAlpha75: withOpacity(effectivePrimaryColor, 0.75),
      backgroundAlpha59: withOpacity(colorTokens[activeColorScheme].background, 0.59),
      textMutedAlpha25: withOpacity(colorTokens.shared.textMuted, 0.25),
      dividerAlpha16: withOpacity(colorTokens[activeColorScheme].divider, 0.16),
    };
  }, [activeColorScheme, customPrimaryColor]);

  return {
    colors,
    activeColorScheme,
  };
};
