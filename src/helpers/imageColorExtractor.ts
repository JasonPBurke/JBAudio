import {
  getSegmentsPalette,
  getSegmentsAverageColor,
  getPalette,
} from '@somesoap/react-native-image-palette';
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

export const extractImageColors = async (
  uri: string,
): Promise<BookImageColors> => {
  try {
    // Exclude the bottom 30% and top 15% of the image (which includes the bottom-right corner)
    const segments = [
      { fromX: 0, toX: 100, fromY: 12, toY: 60 },
      // { fromX: 0, toX: 60, fromY: 15, toY: 85 },
    ];
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
    return {
      vibrant: palette.vibrant,
      darkVibrant: palette.darkVibrant,
      lightVibrant: palette.lightVibrant,
      muted: palette.muted,
      darkMuted: palette.darkMuted,
      lightMuted: palette.lightMuted,
      dominantAndroid: palette.dominantAndroid ?? null,
      // average: average ?? null, // DEPRECATED: No longer extracted
    };
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
