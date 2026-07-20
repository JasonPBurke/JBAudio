import { TinyColor } from '@ctrl/tinycolor';

import { getPalette } from '@somesoap/react-native-image-palette';

import {
  BookImageColors,
  dedupeColors,
  extractImageColors,
} from '../imageColorExtractor';

jest.mock('@somesoap/react-native-image-palette', () => ({
  getPalette: jest.fn(),
}));

const mockGetPalette = getPalette as jest.Mock;

const makeColors = (
  overrides: Partial<BookImageColors> = {},
): BookImageColors => ({
  vibrant: '#ff0000',
  darkVibrant: '#00ff00',
  lightVibrant: '#0000ff',
  muted: '#ffff00',
  darkMuted: '#00ffff',
  lightMuted: '#ff00ff',
  dominantAndroid: '#f0f0f0',
  ...overrides,
});

/** Non-null values normalized to hex for uniqueness checks. */
const nonNullHexes = (colors: BookImageColors): string[] =>
  Object.values(colors)
    .filter((v): v is string => v !== null)
    .map((v) => new TinyColor(v).toHexString());

describe('dedupeColors', () => {
  it('returns colors unchanged when all values are unique', () => {
    const input = makeColors();
    expect(dedupeColors(input)).toEqual(input);
  });

  it('lightens the later duplicate so all colors are unique', () => {
    const input = makeColors({
      vibrant: '#336699',
      dominantAndroid: '#336699',
    });
    const result = dedupeColors(input);

    // First occurrence keeps its exact original value
    expect(result.vibrant).toBe('#336699');
    // Duplicate was replaced with a lighter, unique color
    expect(result.dominantAndroid).not.toBeNull();
    expect(result.dominantAndroid).not.toBe('#336699');
    expect(
      new TinyColor(result.dominantAndroid!).getLuminance(),
    ).toBeGreaterThan(new TinyColor('#336699').getLuminance());

    const hexes = nonNullHexes(result);
    expect(new Set(hexes).size).toBe(hexes.length);
  });

  it('resolves three-way duplicates to three unique colors', () => {
    const input = makeColors({
      vibrant: '#804020',
      muted: '#804020',
      dominantAndroid: '#804020',
    });
    const result = dedupeColors(input);

    const hexes = nonNullHexes(result);
    expect(new Set(hexes).size).toBe(hexes.length);
    expect(result.vibrant).toBe('#804020');
  });

  it('detects duplicates case-insensitively', () => {
    const input = makeColors({
      vibrant: '#AABBCC',
      muted: '#aabbcc',
    });
    const result = dedupeColors(input);

    const hexes = nonNullHexes(result);
    expect(new Set(hexes).size).toBe(hexes.length);
  });

  it('still produces unique colors when duplicates are pure white', () => {
    const input = makeColors({
      lightVibrant: '#ffffff',
      lightMuted: '#ffffff',
      dominantAndroid: '#ffffff',
    });
    const result = dedupeColors(input);

    const hexes = nonNullHexes(result);
    expect(new Set(hexes).size).toBe(hexes.length);
  });

  it('leaves null fields null and ignores them for uniqueness', () => {
    const input = makeColors({
      vibrant: null,
      darkVibrant: null,
    });
    const result = dedupeColors(input);

    expect(result.vibrant).toBeNull();
    expect(result.darkVibrant).toBeNull();
  });
});

describe('extractImageColors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('dedupes palette colors before returning', async () => {
    mockGetPalette.mockResolvedValue({
      vibrant: '#123456',
      darkVibrant: '#123456',
      lightVibrant: '#abcdef',
      muted: '#123456',
      darkMuted: '#222222',
      lightMuted: '#dddddd',
      dominantAndroid: '#123456',
    });

    const result = await extractImageColors('file:///cover.webp');

    const hexes = nonNullHexes(result);
    expect(new Set(hexes).size).toBe(hexes.length);
    // The first occurrence survives untouched
    expect(result.vibrant).toBe('#123456');
  });

  it('returns all-null colors when palette extraction fails', async () => {
    mockGetPalette.mockRejectedValue(new Error('decode failed'));
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const result = await extractImageColors('file:///cover.webp');

    expect(Object.values(result).every((v) => v === null)).toBe(true);
    consoleSpy.mockRestore();
  });
});
