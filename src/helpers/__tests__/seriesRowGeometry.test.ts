import {
  browseTextColumnWidth,
  clusterCoverSize,
  clusterLayers,
  coverClusterWidth,
  isMetaLineOverflowing,
  CLUSTER_MAX_LAYERS,
  CLUSTER_PEEK_FRACTION,
  CONTENT_CAP,
  PHONE_WIDTH,
} from '@/helpers/seriesRowGeometry';

const shape = (uri: string, aspect = 1) => ({ uri, aspect });

describe('cluster sizing (H4)', () => {
  test('is a VERIFIED NO-OP at 411dp — the whole claim of the rule', () => {
    expect(clusterCoverSize(PHONE_WIDTH)).toBe(84);
  });

  test('scales with width up to the content cap', () => {
    expect(clusterCoverSize(600)).toBeCloseTo(122.6, 1);
    expect(clusterCoverSize(500)).toBeGreaterThan(clusterCoverSize(411));
    expect(clusterCoverSize(500)).toBeLessThan(clusterCoverSize(600));
  });

  test('stops growing past the cap, so a tablet is not a bigger phone', () => {
    expect(clusterCoverSize(800)).toBe(clusterCoverSize(CONTENT_CAP));
    expect(clusterCoverSize(1280)).toBe(clusterCoverSize(CONTENT_CAP));
  });

  test('a narrower phone shrinks the fan rather than eating the text', () => {
    expect(clusterCoverSize(360)).toBeLessThan(84);
  });
});

describe('cluster width (B2)', () => {
  test('is constant regardless of how many covers a series has', () => {
    const size = clusterCoverSize(PHONE_WIDTH);
    expect(coverClusterWidth(size)).toBeCloseTo(100.8, 5);
    // Same box for a 1-book series and a 22-book one — the rule that keeps
    // every row's text column starting at the same x.
    expect(clusterLayers([shape('a')], size).length).toBe(1);
    expect(coverClusterWidth(size)).toBeCloseTo(100.8, 5);
  });
});

describe('the fan (K13) — the offset must outpace the shrink', () => {
  const size = 84;

  test('each layer clears the one in front by a constant positive peek', () => {
    const layers = clusterLayers([shape('a'), shape('b'), shape('c')], size);
    const rights = layers.map((l) => l.left + l.side);
    const peek = size * CLUSTER_PEEK_FRACTION;
    expect(peek).toBeGreaterThan(0);
    expect(rights[1] - rights[0]).toBeCloseTo(peek, 5);
    expect(rights[2] - rights[1]).toBeCloseTo(peek, 5);
  });

  test('no layer is occluded by the one in front of it', () => {
    const layers = clusterLayers([shape('a'), shape('b'), shape('c')], size);
    const rights = layers.map((l) => l.left + l.side);
    // Equal offset and shrink rates right-align every layer and a 22-book
    // series draws as one lone cover. Strictly increasing rights is the guard.
    expect(rights[1]).toBeGreaterThan(rights[0]);
    expect(rights[2]).toBeGreaterThan(rights[1]);
  });

  test('back layers are smaller — the depth cue', () => {
    const layers = clusterLayers([shape('a'), shape('b'), shape('c')], size);
    expect(layers[1].side).toBeLessThan(layers[0].side);
    expect(layers[2].side).toBeLessThan(layers[1].side);
  });

  test('never paints more than three layers', () => {
    const many = Array.from({ length: 22 }, (_, i) => shape(`c${i}`));
    expect(clusterLayers(many, size)).toHaveLength(CLUSTER_MAX_LAYERS);
  });

  test('a tall cover is pillarboxed inside a SQUARE box, never letterboxed', () => {
    const [layer] = clusterLayers([shape('tall', 0.67)], size);
    expect(layer.side).toBe(size); // the box stays square
    expect(layer.imageWidth).toBeCloseTo(size * 0.67, 5); // artwork is narrower
  });

  test('a wide cover overflows the square box and is cropped evenly', () => {
    const [layer] = clusterLayers([shape('wide', 1.6)], size);
    expect(layer.side).toBe(size);
    expect(layer.imageWidth).toBeGreaterThan(size);
  });
});

describe('the text column', () => {
  test('is what is left of the capped content after the fan', () => {
    // 411 − 2×12 padding − 100.8 cluster − 14 gap
    expect(browseTextColumnWidth(PHONE_WIDTH)).toBeCloseTo(272.2, 1);
  });

  test('grows with width but stops at the content cap (H1)', () => {
    expect(browseTextColumnWidth(800)).toBe(browseTextColumnWidth(CONTENT_CAP));
    expect(browseTextColumnWidth(500)).toBeGreaterThan(
      browseTextColumnWidth(411),
    );
  });
});

describe('meta-line overflow (K14) — measured, never inferred', () => {
  const full = '22 books · 7 finished · #1-22';

  /*
   * MEASURED ON DEVICE, Pixel_7_Pro 411dp @ font scale 2.0, 2026-08-09. This is
   * verbatim what `onTextLayout` reported for a truncated line, and it is the
   * reason two plausible tests were wrong:
   *
   *   text:  "3 books · 1 finished · #…﻿﻿﻿﻿﻿"
   *   width: 262.33      available: 272.51
   *
   * Android pads the ellipsis with U+FEFF so the reported string keeps the
   * SAME CHARACTER COUNT as the original — a length comparison sees nothing.
   * And the ellipsized line is NARROWER than the column — a width comparison
   * sees nothing either. Only inequality of the text catches it.
   */
  test('the real device report for a truncated line is overflow', () => {
    const deviceFull = '3 books · 1 finished · #1, 3-4';
    const deviceLine = {
      text: '3 books · 1 finished · #…﻿﻿﻿﻿﻿',
      width: 262.33148193359375,
    };
    expect(deviceLine.text.length).toBe(deviceFull.length); // the trap
    expect(deviceLine.width).toBeLessThan(272.5085714285715); // the other trap
    expect(
      isMetaLineOverflowing([deviceLine], deviceFull, 272.5085714285715),
    ).toBe(true);
  });

  test('a line whose reported text differs from the string was truncated', () => {
    expect(
      isMetaLineOverflowing(
        [{ text: '22 books · 7 finished · #1-2…﻿', width: 190 }],
        full,
        200,
      ),
    ).toBe(true);
  });

  test('a full-width line that exceeds the column was truncated', () => {
    // The other Android layout path keeps the whole string on line 0 and
    // reports its natural width, so the text comparison alone cannot see it.
    expect(isMetaLineOverflowing([{ text: full, width: 240 }], full, 200)).toBe(
      true,
    );
  });

  test('a line that fits is not overflowing', () => {
    expect(isMetaLineOverflowing([{ text: full, width: 180 }], full, 200)).toBe(
      false,
    );
  });

  test('a range that legitimately ends in an ellipsis is not overflow', () => {
    // §H10's run cap emits `…` into the string itself, so "contains an
    // ellipsis" would be a false positive. Equality is what makes this work.
    const capped = '41 books · #1, 3, 5…';
    expect(
      isMetaLineOverflowing([{ text: capped, width: 180 }], capped, 200),
    ).toBe(false);
  });

  test('wrapping onto a second line is overflow', () => {
    expect(
      isMetaLineOverflowing(
        [
          { text: '22 books · 7 finished ·', width: 190 },
          { text: '#1-22', width: 60 },
        ],
        full,
        200,
      ),
    ).toBe(true);
  });

  test('an unmeasured line claims nothing', () => {
    expect(isMetaLineOverflowing([], full, 200)).toBe(false);
    expect(isMetaLineOverflowing([{ text: full, width: 180 }], full, 0)).toBe(
      false,
    );
  });
});
