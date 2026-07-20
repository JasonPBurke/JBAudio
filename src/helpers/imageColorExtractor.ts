import {
  // getSegmentsPalette,
  // getSegmentsAverageColor,
  getPalette,
} from '@somesoap/react-native-image-palette';
import { TinyColor } from '@ctrl/tinycolor';
import { colors as color } from '@/constants/tokens';

export type BookImageColors = {
  vibrant: string | null;
  darkVibrant: string | null;
  lightVibrant: string | null;
  muted: string | null;
  darkMuted: string | null;
  lightMuted: string | null;
  dominantAndroid: string | null;
  // average: string | null; // DEPRECATED: Removed from extraction, field remains in DB for now
};

// Order determines which color "wins" a collision: earlier keys keep their
// original value, later duplicates get adjusted.
const COLOR_KEYS: (keyof BookImageColors)[] = [
  'vibrant',
  'darkVibrant',
  'lightVibrant',
  'muted',
  'darkMuted',
  'lightMuted',
  'dominantAndroid',
];

const ADJUST_STEP = 8; // % lightness change per collision-resolution attempt
const MAX_ADJUST_STEPS = 12; // 12 × 8% spans the full lightness range

/**
 * The Android Palette API often returns the identical swatch for several
 * slots (dominantAndroid in particular frequently matches vibrant/muted on
 * low-color covers). Downstream gradient/accent pickers need distinct
 * colors, so later duplicates are lightened until unique — falling back to
 * darkening for near-white values that lightening can't separate.
 */
export const dedupeColors = (colors: BookImageColors): BookImageColors => {
  const seen = new Set<string>();
  const result = { ...colors };

  for (const key of COLOR_KEYS) {
    const original = result[key];
    if (!original) continue;
    const parsed = new TinyColor(original);
    if (!parsed.isValid) continue;

    let hex = parsed.toHexString();
    if (!seen.has(hex)) {
      seen.add(hex);
      continue;
    }

    let adjusted = parsed;
    for (let i = 0; i < MAX_ADJUST_STEPS && seen.has(hex); i++) {
      adjusted = adjusted.lighten(ADJUST_STEP);
      hex = adjusted.toHexString();
    }
    adjusted = parsed;
    for (let i = 0; i < MAX_ADJUST_STEPS && seen.has(hex); i++) {
      adjusted = adjusted.darken(ADJUST_STEP);
      hex = adjusted.toHexString();
    }

    seen.add(hex);
    result[key] = hex;
  }

  return result;
};

export const extractImageColors = async (
  uri: string,
): Promise<BookImageColors> => {
  try {
    // Exclude the bottom 30% and top 15% of the image (which includes the bottom-right corner)
    // const segments = [
    //   { fromX: 0, toX: 100, fromY: 12, toY: 60 },
    // { fromX: 0, toX: 60, fromY: 15, toY: 85 },
    // ];
    // const [palettes, averages] = await Promise.all([
    //   getSegmentsPalette(uri, segments, {
    //     fallbackColor: color.background,
    //   }),
    //   getSegmentsAverageColor(uri, segments, {}),
    // ]);
    const [palettes] = await Promise.all([
      getPalette(uri, {
        fallbackColor: color.background,
      }),
      // getSegmentsAverageColor(uri, segments, {}),
    ]);
    const palette = palettes;
    // const average = averages[0];
    return dedupeColors({
      vibrant: palette.vibrant,
      darkVibrant: palette.darkVibrant,
      lightVibrant: palette.lightVibrant,
      muted: palette.muted,
      darkMuted: palette.darkMuted,
      lightMuted: palette.lightMuted,
      dominantAndroid: palette.dominantAndroid ?? null,
      // average: average ?? null, // DEPRECATED: No longer extracted
    });
  } catch (error) {
    console.error('Failed to extract image colors:', error);
  }

  return {
    // average: null, // DEPRECATED
    dominantAndroid: null,
    vibrant: null,
    darkVibrant: null,
    lightVibrant: null,
    muted: null,
    darkMuted: null,
    lightMuted: null,
  };
};
