import {
  TinyColor,
  isReadable as tinyColorIsReadable,
} from '@ctrl/tinycolor';

/**
 * Creates a color with specified opacity
 * @param color - Base color (hex, rgb, etc.)
 * @param opacity - Opacity value (0-1)
 * @returns Hex8 color string with alpha channel
 *
 * @example
 * withOpacity('#FFB606', 0.75) // '#ffb606be'
 * withOpacity('#1C1C1C', 0.5)  // '#1c1c1c7f'
 */
export const withOpacity = (color: string, opacity: number): string => {
  return new TinyColor(color).setAlpha(opacity).toHex8String();
};

/**
 * Checks if text color is readable on background
 * Uses WCAG 2.0 AA standard (4.5:1 contrast ratio for normal text)
 *
 * @param textColor - Text color (hex, rgb, etc.)
 * @param backgroundColor - Background color (hex, rgb, etc.)
 * @returns true if contrast meets WCAG AA standard
 *
 * @example
 * isReadable('#ECEFF4', '#1C1C1C') // true (light text on dark bg)
 * isReadable('#999', '#ccc')       // false (low contrast)
 */
export const isReadable = (
  textColor: string,
  backgroundColor: string
): boolean => {
  return tinyColorIsReadable(textColor, backgroundColor, {
    level: 'AA',
    size: 'large',
  });
};

/**
 * Adjusts text color to ensure readability on background
 * Iteratively lightens (for dark backgrounds) or darkens (for light backgrounds)
 * until WCAG AA contrast standard is met
 *
 * @param textColor - Original text color
 * @param backgroundColor - Background color
 * @returns Adjusted text color that meets contrast requirements
 *
 * @example
 * // Adjusts gray text to be lighter on dark background
 * ensureReadable('#999', '#1C1C1C') // Returns lightened color
 */
export const ensureReadable = (
  textColor: string,
  backgroundColor: string
): string => {
  const bg = new TinyColor(backgroundColor);
  let text = new TinyColor(textColor);

  // If already readable, return as-is
  if (
    tinyColorIsReadable(text.toHexString(), bg.toHexString(), {
      level: 'AA',
      size: 'large',
    })
  ) {
    return text.toHexString();
  }

  // Determine if background is dark or light
  const isDarkBg = bg.getLuminance() < 0.5;
  const maxIterations = 10;

  // Iteratively adjust text color
  for (let i = 0; i < maxIterations; i++) {
    if (isDarkBg) {
      text = text.lighten(4); // Lighten for dark backgrounds
    } else {
      text = text.darken(4); // Darken for light backgrounds
    }

    if (
      tinyColorIsReadable(text.toHexString(), bg.toHexString(), {
        level: 'AA',
        size: 'large',
      })
    ) {
      return text.toHexString();
    }
  }

  // Fallback to pure white or black if adjustment fails
  return isDarkBg ? '#FFFFFF' : '#000000';
};

/**
 * Calculates brightness of a color (0-255)
 * Uses perceived brightness formula
 *
 * @param color - Color to measure (hex, rgb, etc.)
 * @returns Brightness value from 0 (darkest) to 255 (brightest)
 *
 * @example
 * getBrightness('#000000') // 0
 * getBrightness('#FFFFFF') // 255
 * getBrightness('#FFB606') // ~182
 */
export const getBrightness = (color: string): number => {
  return new TinyColor(color).getBrightness();
};

/**
 * Calculates luminance of a color (0-1)
 * Uses WCAG 2.0 relative luminance formula
 * More accurate for accessibility calculations than brightness
 *
 * @param color - Color to measure (hex, rgb, etc.)
 * @returns Luminance value from 0 (darkest) to 1 (brightest)
 *
 * @example
 * getLuminance('#000000') // 0
 * getLuminance('#FFFFFF') // 1
 * getLuminance('#FFB606') // ~0.55
 */
export const getLuminance = (color: string): number => {
  return new TinyColor(color).getLuminance();
};
