import { getColors, ImageColorsResult } from 'react-native-image-colors';
import { colors as color } from '@/constants/tokens';

export type BookImageColors = {
  average: string | null;
  dominant: string | null;
  vibrant: string | null;
  darkVibrant: string | null;
  lightVibrant: string | null;
  muted: string | null;
  darkMuted: string | null;
  lightMuted: string | null;
};

export const extractImageColors = async (
  uri: string
): Promise<BookImageColors> => {
  try {
    const colors: ImageColorsResult = await getColors(uri, {
      fallback: color.background,
    });

    if (colors.platform === 'android') {
      const { platform, ...rest } = colors;
      return rest;
    }
  } catch (error) {
    console.error('Failed to extract image colors:', error);
  }

  return {
    average: null,
    dominant: null,
    vibrant: null,
    darkVibrant: null,
    lightVibrant: null,
    muted: null,
    darkMuted: null,
    lightMuted: null,
  };
};
