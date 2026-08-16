import React, { memo } from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { PressableScale } from 'pressto';
import { Plus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/useTheme';
import { withOpacity } from '@/helpers/colorUtils';

const FAB_SIZE = 66;
/** Matches FloatingPlayer's container, which sits just below this.
 *
 *  ⚠ EVERY LAYER MUST CARRY THIS ITSELF. `PressableScale` renders RNGH's
 *  `BaseButton` — a native Android view — and `overflow: 'hidden'` is not
 *  honoured on it, so an unrounded child paints a full square over the
 *  rounded background and clips nothing. Device-confirmed 2026-08-15. */
const FAB_RADIUS = 6;
/** Right-edge inset. Matches FloatingPlayer's own `left/right: 8` so the two
 *  chrome elements share a gutter. */
const FAB_EDGE_GAP = 8;
/** Clearance over FloatingPlayer, hand-tuned on device.
 *
 *  ⚠ The player's height is IMPLICIT — nothing declares it; its row is sized by
 *  a 50dp artwork — so this number cannot be checked by the compiler and will
 *  drift silently if that row changes.
 *
 *  The offset is static rather than tracking whether a track is loaded, so the
 *  button never moves under the user's thumb. With no player mounted the FAB
 *  simply keeps this clearance over empty space. */
const FAB_BOTTOM_OFFSET = 78;

/** Veil strength, per scheme — the two are NOT interchangeable, and the reason
 *  is not aesthetic.
 *
 *  The veil is `textMuted`: near-white on dark (#d8dee9), dark grey on light
 *  (#4B5563). So the same alpha LIGHTENS the backdrop on dark and DARKENS it on
 *  light.
 *
 *  ⚠ MEASURED ON DEVICE 2026-08-15 (Pixel 7 Pro, four-cell matrix — same two
 *  covers shot in both themes). Glyph-vs-backdrop contrast, WCAG 1.4.11 floor
 *  for non-text is 3:1:
 *
 *    light theme / light cover   9.57–9.87:1  ✅
 *    light theme / dark cover    4.21–5.53:1  ✅
 *    dark theme  / dark cover    5.93–7.85:1  ✅
 *    dark theme  / LIGHT cover   2.49–2.80:1  ❌  KNOWN, UNFIXED
 *
 *  ⚠ DO NOT try to fix that last cell by raising `VEIL_ALPHA.dark`. It was
 *  tried at 0.38 and measured WORSE (2.09–2.27:1). Dark's veil (#d8dee9) and
 *  dark's glyph (#e9ebf0) are BOTH near-white, so every alpha lands the
 *  backdrop between "raw light cover" and "#d8dee9" — both light. No value
 *  works; the asymptote is ~1.1:1. The token is wrong, not the number.
 *
 *  The known fix direction, if this is ever worth closing: veil toward
 *  `themeColors.background` instead, the ground `text` is defined to contrast
 *  against, which makes alpha monotonic in both themes. Costs the glass look —
 *  it reads as a scrim. */
const VEIL_ALPHA = { dark: 0.12, light: 0.28 } as const;
/** Rim strength. Tracks the veil so the edge never out-weighs the fill. */
const RIM_ALPHA = { dark: 0.45, light: 0.32 } as const;

type Props = {
  /** Shared with SearchBar so both chrome elements hide and show as one. */
  isVisible: SharedValue<number>;
  onPress: () => void;
};

const CreateSeriesFab = ({ isVisible, onPress }: Props) => {
  const { colors: themeColors, activeColorScheme } = useTheme();
  const insets = useSafeAreaInsets();

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: isVisible.value,
      // ⚠ LOAD-BEARING, not decoration. The button never moves, so a faded-out
      // FAB still occupies its box and still hit-tests — it would swallow taps
      // on the book row beneath it. Driving pointerEvents from the same worklet
      // keeps the guard on the UI thread, with no React re-render per scroll
      // direction change. Device-verified 2026-08-15.
      pointerEvents: isVisible.value < 0.5 ? 'none' : 'box-none',
    };
  });

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { bottom: insets.bottom + FAB_BOTTOM_OFFSET },
        animatedStyle,
      ]}
    >
      <PressableScale
        rippleRadius={0}
        onPress={onPress}
        accessibilityLabel='Create series'
        accessibilityRole='button'
        style={[
          styles.button,
          {
            // SeriesCompletionBar's track colour, with NO opaque base — the
            // backdrop shows through, which is the point. The trade is that the
            // glyph's contrast depends on the cover art underneath; see the
            // measured matrix on VEIL_ALPHA.
            backgroundColor: withOpacity(
              themeColors.textMuted,
              VEIL_ALPHA[activeColorScheme],
            ),
            borderColor: withOpacity(
              themeColors.textMuted,
              RIM_ALPHA[activeColorScheme],
            ),
          },
        ]}
      >
        {/* Glass sheen: a diagonal highlight falling off to nothing, which is
            what sells translucency without a real backdrop blur. Rounds
            itself — see FAB_RADIUS.
            ⚠ `lightText`, NOT `text`. These `light*` tokens mean
            "light-COLOURED", not "for the light theme" — they live in
            `colorTokens.shared` and are theme-invariant by construction. A
            specular highlight must stay light in BOTH themes; keyed to `text`
            it inverted to a near-black smear on light mode. */}
        <LinearGradient
          pointerEvents='none'
          colors={[
            withOpacity(themeColors.lightText, 0.16),
            withOpacity(themeColors.lightText, 0.02),
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.layer]}
        />
        <Plus
          size={28}
          color={withOpacity(themeColors.text, 0.8)}
          strokeWidth={2.5}
        />
      </PressableScale>
    </Animated.View>
  );
};

export default memo(CreateSeriesFab);

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    right: FAB_EDGE_GAP,
  },
  button: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_RADIUS,
    // NOT StyleSheet.hairlineWidth. That is exactly one physical pixel, which
    // at 560dpi reads as a faint scratch rather than a rim.
    borderWidth: 1,
    // No `overflow: 'hidden'` — it does nothing on RNGH's BaseButton. Each
    // layer rounds itself instead.
    alignItems: 'center',
    justifyContent: 'center',
  },
  layer: {
    borderRadius: FAB_RADIUS,
  },
});
