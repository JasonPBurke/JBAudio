import { Dimensions, PixelRatio, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
 * Android's standard large-screen (sw600dp) breakpoint. Compared against the
 * *shortest* side so it is orientation independent.
 */
const LARGE_SCREEN_MIN_WIDTH = 600;

/**
 * Backstop for the phone tier. Display Size only moves the window width within
 * roughly 0.85x–1.2x of the device default, so a ratio above this means we are
 * looking at a screen that is genuinely wider than a phone rather than a
 * zoomed-out one. Guards the case where a small tablet drops below the
 * sw600dp breakpoint at the largest Display Size setting.
 */
const MAX_SCALE = 1.25;

const IS_LARGE_SCREEN =
  Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) >= LARGE_SCREEN_MIN_WIDTH;

const SCALE = Math.min(SCREEN_WIDTH / REFERENCE_WIDTH, MAX_SCALE);

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
 *
 * ## Large screens are deliberately excluded
 *
 * The scale is a ratio against a *phone* reference width, so a tablet — which
 * is genuinely ~800dp wide, not zoomed — would otherwise get a ~1.95x
 * multiplier on every value. Because callers apply the result to *vertical*
 * constants while the ratio is derived from *width*, and a tablet is squarer
 * (1:1.6) than a phone (1:2.17), that inflation compounds: it pushed the
 * player's controls underneath the navigation bar and doubled the gap above
 * the cover art.
 *
 * Tablets therefore forgo Display Size compensation and render literal dp.
 * That trade-off is intentional: a fixed tablet reference width cannot work
 * because tablet defaults vary (600/720/800/840dp), so there is no value to
 * compare against.
 */
export function normalizeSize(dp: number): number {
  if (Platform.OS !== 'android' || IS_LARGE_SCREEN) return dp;
  return PixelRatio.roundToNearestPixel(dp * SCALE);
}
