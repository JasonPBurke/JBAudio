import { getLuminance } from './colorUtils';

export type ArtworkColors = {
  vibrant: string | null;
  darkVibrant: string | null;
  lightVibrant: string | null;
  muted: string | null;
  darkMuted: string | null;
  lightMuted: string | null;
  dominantAndroid: string | null;
  // Note: 'average' is excluded (deprecated)
};

export type GradientColors = readonly [string, string, string, string];

/**
 * Selects and orders 4 colors from artwork palette for LinearGradient
 *
 * Position mapping (based on user requirements):
 * - Position 0 (location 0.15): 2nd darkest color
 * - Position 1 (location 0.35): 3rd-4th darkest color
 * - Position 2 (location 0.45): 5th-6th darkest color (lightest of those used)
 * - Position 3 (location 0.6):  Darkest color
 *
 * Algorithm:
 * 1. Extract all non-null colors from artwork palette
 * 2. Sort by luminance (darkest to lightest)
 * 3. Map sorted colors to gradient positions
 * 4. Fallback to provided colors if insufficient artwork colors
 *
 * @param artworkColors - Colors extracted from book artwork
 * @param fallbackColors - Colors to use if artwork colors are insufficient
 * @returns Array of 4 colors ordered for gradient use
 *
 * @example
 * const gradient = selectGradientColors(book.artworkColors, defaultColors);
 * // gradient[0] = 2nd darkest, gradient[1] = 3rd-4th darkest, etc.
 */
export const selectGradientColors = (
  artworkColors: ArtworkColors | null,
  fallbackColors: GradientColors
): GradientColors => {
  if (!artworkColors) {
    return fallbackColors;
  }

  // Extract all non-null colors (excluding 'average' which is deprecated)
  const colorEntries = Object.entries(artworkColors)
    .filter(([key, value]) => value !== null && key !== 'average')
    .map(([_, color]) => color as string);

  // Fallback if no colors extracted
  if (colorEntries.length === 0) {
    return fallbackColors;
  }

  // Sort by luminance (darkest to lightest)
  const sorted = colorEntries.sort((a, b) => {
    return getLuminance(a) - getLuminance(b);
  });

  // Handle cases with fewer than 6 colors
  if (sorted.length === 1) {
    // Only one color: use fallback
    return fallbackColors;
  }

  if (sorted.length === 2) {
    // Two colors: alternate between them
    // Position: [1st, 0th, 1st, 0th] → [lighter, darker, lighter, darker]
    return [sorted[1], sorted[0], sorted[1], sorted[0]] as const;
  }

  if (sorted.length === 3) {
    // Three colors: use lightest for positions 0&1, darkest for position 3
    // Position: [2nd, 1st, 2nd, 0th] → [lightest, middle, lightest, darkest]
    return [sorted[2], sorted[1], sorted[2], sorted[0]] as const;
  }

  if (sorted.length === 4) {
    // Four colors: use available colors with duplication
    // Position: [2nd, 1st, 3rd, 0th] → [2nd darkest, 3rd darkest, lightest, darkest]
    return [sorted[1], sorted[2], sorted[3], sorted[0]] as const;
  }

  if (sorted.length === 5) {
    // Five colors: map as close as possible to ideal
    // Position: [1st, 2nd, 4th, 0th] → [2nd darkest, 3rd darkest, lightest, darkest]
    return [sorted[1], sorted[2], sorted[4], sorted[0]] as const;
  }

  // 6+ colors: use full user-specified mapping
  // Position 0 (0.15): 2nd darkest  → sorted[1]
  // Position 1 (0.35): 3rd-4th darkest → sorted[3] (middle of 3rd and 4th)
  // Position 2 (0.45): 5th-6th darkest (lightest) → sorted[5]
  // Position 3 (0.6):  Darkest → sorted[0]
  return [sorted[1], sorted[3], sorted[5], sorted[0]] as const;
};
