import { Dimensions, PixelRatio, Platform } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Reference screen width in dp. Standard for most modern Android phones:
 *  - 1080p displays: 1080 / 2.625 ≈ 411dp
 *  - 1440p displays: 1440 / 3.5  ≈ 411dp
 *
 * At the device's default Display Size setting, the screen width
 * matches this reference, so normalizeSize(x) ≈ x.
 */
const REFERENCE_WIDTH = 411;

/**
 * Normalizes a dp value so it occupies the same physical screen proportion
 * regardless of Android's Display Size accessibility setting.
 *
 * Android's "Display size" changes the screen density, causing
 * `Dimensions.get('window').width` to shrink/grow. Fixed dp values
 * then occupy a different fraction of the physical screen.
 *
 * This function scales the value proportionally to the current screen
 * width, keeping the physical pixel size constant across all Display
 * Size settings.
 *
 * On iOS, returns the value unchanged.
 */
export function normalizeSize(dp: number): number {
  if (Platform.OS !== 'android') return dp;
  return PixelRatio.roundToNearestPixel(dp * (SCREEN_WIDTH / REFERENCE_WIDTH));
}
