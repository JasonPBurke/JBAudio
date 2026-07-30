import {
  computeDetailsArtworkSize,
  computePlayerArtworkSize,
} from '../artworkSizing';

// Vertical dp the non-artwork player children occupy at their natural size.
// Mirrors PLAYER_CHROME_HEIGHT in src/app/player.tsx.
const CHROME = 465.5;
const PADDING = 12;

// Real device geometries measured with `adb shell wm size` / `wm density`.
const PHONE = { windowWidth: 411, windowHeight: 891 };
const TABLET = { windowWidth: 800, windowHeight: 1280 }; // Pixel Tablet, 1600x2560 @ 320dpi
const FOLDABLE_INNER = { windowWidth: 701, windowHeight: 841 };

const GESTURE_INSET = 24;
const THREE_BUTTON_INSET = 48;
const TABLET_TASKBAR_INSET = 56;

const SQUARE = 1;
const PORTRAIT_2_3 = 2 / 3;
const WIDE_3_2 = 3 / 2;

function size(overrides: Partial<Parameters<typeof computePlayerArtworkSize>[0]>) {
  return computePlayerArtworkSize({
    aspectRatio: SQUARE,
    ...PHONE,
    bottomInset: GESTURE_INSET,
    chromeHeight: CHROME,
    horizontalPadding: PADDING,
    ...overrides,
  });
}

describe('computePlayerArtworkSize', () => {
  describe('phone', () => {
    test('a square cover is bounded by width, filling the content area', () => {
      // Content width 411 - 24 = 387; available height 891 - 24 - 465.5 = 401.5.
      expect(size({})).toEqual({ width: 387, height: 387 });
    });

    test('3-button navigation makes available height the binding bound', () => {
      // Available height drops to 891 - 48 - 465.5 = 377.5, below the 387 width bound.
      const { height } = size({ bottomInset: THREE_BUTTON_INSET });
      expect(height).toBeCloseTo(377.5, 5);
    });

    test('a portrait cover is bounded by available height', () => {
      // Width bound 387 / (2/3) = 580.5 exceeds the 401.5 of available height.
      const { width, height } = size({ aspectRatio: PORTRAIT_2_3 });
      expect(height).toBeCloseTo(401.5, 5);
      expect(width).toBeCloseTo(267.67, 2);
    });

    // Regression: the old `width = aspect * FIXED_ARTWORK_HEIGHT` computed
    // 1.5 * 375 = 562dp of width on a 411dp screen, overflowing both edges.
    test('a wide cover never overflows the screen width', () => {
      const { width, height } = size({ aspectRatio: WIDE_3_2 });
      expect(width).toBeCloseTo(387, 5);
      expect(height).toBeCloseTo(258, 5);
    });

    test('largest Display Size shrinks the cover rather than clipping controls', () => {
      // At Display Size = Largest the window narrows and normalizeSize scales
      // the chrome down with it.
      const { height } = size({
        windowWidth: 336,
        windowHeight: 747,
        bottomInset: THREE_BUTTON_INSET,
        chromeHeight: 413.5,
      });
      expect(height).toBeCloseTo(285.5, 5);
    });
  });

  describe('tablet', () => {
    // The Pixel Tablet cover that originally exposed the bug (aspect ~1.06).
    test('a near-square cover is bounded by width', () => {
      const { width, height } = size({
        ...TABLET,
        aspectRatio: 1.06,
        bottomInset: TABLET_TASKBAR_INSET,
      });
      expect(height).toBeCloseTo(732.08, 2);
      expect(width).toBeCloseTo(776, 5);
    });

    test('a square cover is bounded by available height', () => {
      // Width bound 776 exceeds available height 1280 - 56 - 465.5 = 758.5.
      const { height } = size({
        ...TABLET,
        bottomInset: TABLET_TASKBAR_INSET,
      });
      expect(height).toBeCloseTo(758.5, 5);
    });
  });

  test('foldable inner display leaves the controls room', () => {
    const { height } = size({ ...FOLDABLE_INNER, bottomInset: GESTURE_INSET });
    expect(height).toBeCloseTo(351.5, 5);
  });

  describe('degenerate input', () => {
    test.each([0, -1, NaN, Infinity])('aspect ratio %p yields no artwork', (aspectRatio) => {
      expect(size({ aspectRatio })).toEqual({ width: 0, height: 0 });
    });

    test('a window too small for the chrome yields no artwork rather than a negative size', () => {
      expect(size({ windowHeight: 400 })).toEqual({ width: 0, height: 0 });
    });
  });

  // Regression: the titleDetails cover collapsed from ~730dp to 375dp on a
  // tablet when normalizeSize stopped inflating on large screens. That screen
  // scrolls, so it needs a proportional rule rather than the player's
  // remainder rule.
  describe('titleDetails cover (computeDetailsArtworkSize)', () => {
    const details = (
      overrides: Partial<Parameters<typeof computeDetailsArtworkSize>[0]> = {},
    ) =>
      computeDetailsArtworkSize({
        aspectRatio: SQUARE,
        ...PHONE,
        horizontalPadding: 16,
        ...overrides,
      });

    test('phone keeps the size the old hardcoded 375dp produced', () => {
      // 891 * 0.42 = 374.2, within a dp of the previous constant.
      expect(details({ aspectRatio: PORTRAIT_2_3 }).height).toBeCloseTo(
        374.22,
        2,
      );
    });

    test('tablet scales the cover up with the screen', () => {
      // 1280 * 0.42 = 537.6 — well above the 375.7dp regression.
      const { height } = details({ ...TABLET, aspectRatio: PORTRAIT_2_3 });
      expect(height).toBeCloseTo(537.6, 2);
      expect(height).toBeGreaterThan(500);
    });

    test('a square cover on a phone is bounded by width, not the ratio', () => {
      // Content width 411 - 32 = 379 is below the 374.2 ratio target... but a
      // square cover needs height == width, so the width bound wins.
      expect(details({}).height).toBeCloseTo(374.22, 2);
    });

    test('a wide cover never overflows the screen width', () => {
      const { width, height } = details({ aspectRatio: WIDE_3_2 });
      expect(width).toBeLessThanOrEqual(411 - 32);
      expect(height).toBeCloseTo((411 - 32) / 1.5, 5);
    });

    test.each([0, -1, NaN, Infinity])(
      'aspect ratio %p yields no artwork',
      (aspectRatio) => {
        expect(details({ aspectRatio })).toEqual({ width: 0, height: 0 });
      },
    );
  });

  // The governing rule: every control stays visible on every form factor.
  describe('controls always fit', () => {
    const devices = [
      { name: 'phone / gesture', ...PHONE, bottomInset: GESTURE_INSET },
      { name: 'phone / 3-button', ...PHONE, bottomInset: THREE_BUTTON_INSET },
      { name: 'tablet / taskbar', ...TABLET, bottomInset: TABLET_TASKBAR_INSET },
      { name: 'foldable inner', ...FOLDABLE_INNER, bottomInset: GESTURE_INSET },
    ];

    test.each(devices)(
      '$name reserves the chrome and inset for every aspect ratio',
      ({ name: _name, ...device }) => {
        for (const aspectRatio of [PORTRAIT_2_3, SQUARE, 1.06, WIDE_3_2, 2.4]) {
          const { width, height } = size({ ...device, aspectRatio });

          expect(height + CHROME + device.bottomInset).toBeLessThanOrEqual(
            device.windowHeight,
          );
          expect(width).toBeLessThanOrEqual(device.windowWidth - PADDING * 2);
        }
      },
    );
  });
});
