/**
 * THROWAWAY — Series UX redesign prototype harness (ticket 08). See ./README.md.
 *
 * Small shared ATOMS for the ticket-08 variants. The prototype skill's line is
 * that a shared header is fine but a shared layout defeats the point — these
 * are firmly on the header side. Each variant still owns its own structure,
 * information hierarchy and primary affordance; they just agree on how a stack
 * of covers and a completion bar are drawn, so the driver is not distracted by
 * three renderings of the same idea.
 */
import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { Sparkles, UserRound } from 'lucide-react-native';

import { unknownBookImageUri } from '@/constants/images';
import { useTheme } from '@/hooks/useTheme';
import { withOpacity } from '@/helpers/colorUtils';
import type { DerivedSeries } from '@/helpers/seriesAssembly';
import type { ProtoSeries } from './syntheticSeries';
import type { CoverShape, SeriesFacts } from './seriesFacts';

/**
 * Overlapping covers, front-most first. This is the single strongest answer to
 * ticket 08's "does a series look like a CURATED COLLECTION rather than an
 * author shelf" — one cover reads as a book, a fanned stack reads as a set.
 *
 * `covers` arrives already deduped (`getSeriesFacts`), because a 22-book series
 * over an 8-book emulator pool otherwise stacks three identical covers and the
 * result reads as a rendering bug.
 */
/** Per-layer height reduction — the depth cue. */
const SHRINK = 0.12;

/**
 * The sliver each layer shows beyond the one in front, as a fraction of `size`.
 *
 * 0.10 is not arbitrary: it reproduces EXACTLY the total cluster width the old
 * geometry produced for square covers (`size * 1.2` — 100.8dp at size 84).
 * A first cut used 0.22, which widened the cluster to 121dp and took that 20dp
 * straight out of the text column — already the scarcest thing in this layout
 * (driver, 2026-08-03: *"this loses us too much text room"*).
 *
 * What this rewrite changes is therefore NOT the size of the peek but its
 * RELIABILITY. The old rule positioned layers with `left = i * size * STEP` and
 * so silently assumed every layer was `size` wide; for non-square artwork the
 * visible sliver was whatever the width difference happened to leave, and could
 * collapse toward zero. Now every layer shows this much whatever shape it is,
 * and no layer can be accidentally hidden.
 */
const PEEK_FRACTION = 0.1;

/** Max layers a cluster ever paints; `covers` is sliced to this. */
export const CLUSTER_MAX_LAYERS = 3;

/**
 * TICKET 16 — the width at which Series content stops growing (driver,
 * 2026-08-05). Android's sw600dp breakpoint: the content never gets wider than
 * the point at which the platform stops calling the device a phone.
 *
 * Content only. PAINT — the browse row's backdrop and its hairline rule — still
 * bleeds to both screen edges, so 08's full-bleed no-card ruling survives, and
 * the content stays LEFT-anchored so the backdrop's left-heavy scrim keeps
 * sitting under the text where 08 tuned it.
 *
 * A phone is 411dp and therefore never reaches this, by design: the rule is a
 * no-op below 600dp and every phone layout is bit-for-bit what it was.
 */
export const CONTENT_CAP = 600;

/**
 * The cluster's box width — CONSTANT for a given `size`, regardless of how many
 * covers a series has or what shape they are.
 *
 * It has to be constant. When it was derived from the cover count, a 1-book
 * series returned `size` and a 3-book series `size * 1.2`, so every row's text
 * column started at a different x and the list read as misaligned (measured on
 * device 2026-08-03: Bobiverse's title at 274px, City Watch's at 313px). This
 * is the same fixed-width-box rule the detail screen's rows already follow —
 * the cluster simply never got it.
 *
 * Also exported because the `Blend` variants inset their row separator to clear
 * the covers, mirroring `BooksList.tsx:103`'s `marginLeft: 75`.
 */
export function coverClusterWidth(size: number): number {
  return size * (1 + (CLUSTER_MAX_LAYERS - 1) * PEEK_FRACTION);
}

/**
 * Pillar colour behind a non-square cover. Deliberately a fixed near-black
 * rather than `themeColors.background`: the point is to read as a cover's own
 * letterbox, and on a light theme a white pillar would read as a hole.
 */
const PILLAR = '#0B0B0B'; //#131313

/**
 * The width the ARTWORK is drawn at inside its square layer box. Height is
 * always the full `side`, so the image is never letterboxed vertically:
 *
 *   - a TALL cover comes out narrower than the box and is centred, with `PILLAR`
 *     showing either side;
 *   - a WIDE cover comes out wider and is centred too, so `overflow: hidden`
 *     crops it evenly left and right — "hidden width can be cut".
 *
 * **The BOX is always square** (driver, 2026-08-03). That is what keeps the
 * play-glyph overlay aligned down the list: the overlay is positioned on the
 * front layer, so when the front layer's width tracked the artwork, `Q`'s tall
 * Mort cover centred its glyph at ~25dp while every square-fronted series
 * centred at ~42dp. Squaring the box also makes the cluster's total width and
 * its fan geometry independent of which shapes a series happens to own.
 */
function artworkWidth(shape: CoverShape, side: number): number {
  return side * shape.aspect;
}

export const CoverCluster = memo(function CoverCluster({
  covers,
  size,
  overlay,
  overlayAlign = 'corner',
  frontScrim = 0,
}: {
  covers: CoverShape[];
  size: number;
  /**
   * Optional node pinned to the FRONT layer's bottom-right — the slot the
   * `Blend icon` variant puts its play button in, mirroring how `BookGridItem`
   * overlays its own play button on cover art.
   *
   * It lives here rather than in the caller because only this component knows
   * the front layer's drawn width, which varies with the artwork's aspect: a
   * tall cover is narrower than `size`, so a caller positioning from the box's
   * right edge would float the button off the art.
   */
  overlay?: React.ReactNode;
  /**
   * Where `overlay` sits on the front cover. `'corner'` is `BookGridItem`'s
   * bottom-right; `'center'` centres it, which reads better when the glyph is
   * large enough to be the cover's focal point rather than a badge on it.
   */
  overlayAlign?: 'corner' | 'center';
  /**
   * Darken the FRONT cover by this much (0–1), to buy contrast for a glyph
   * drawn on top of it.
   *
   * It lives here, painted *inside* the front layer, rather than in the caller's
   * `overlay` node — because the layer clips it. A scrim rendered alongside
   * `overlay` is a sibling of the layers, so it paints a hard-edged rectangle
   * over a cover with `borderRadius: 5`, darkening ~5dp of row background at
   * each rounded corner. On a plain dark row that is invisible; over a backdrop
   * those four corners outline the cover as a box (driver, 2026-08-03).
   */
  frontScrim?: number;
}) {
  const { colors: themeColors } = useTheme();
  const shown = covers.slice(0, CLUSTER_MAX_LAYERS);

  /*
   * THE OFFSET IS DERIVED FROM DRAWN WIDTH, NOT FROM `size`.
   *
   * The old rule was `left = i * size * STEP`, which silently assumed every
   * layer was `size` wide. It isn't: a tall cover draws at `size * aspect`
   * (~56dp at aspect 0.67, size 84), so the actual peek collapsed to whatever
   * the width difference happened to leave — and under a 36% black scrim the
   * back layer surfaced as a sliver that read as a shadow.
   *
   * Instead each layer's RIGHT EDGE is placed a constant `PEEK` beyond the one
   * in front, and its left follows from its own width. That makes the visible
   * sliver identical for every layer whatever shape the artwork is.
   */
  const PEEK = size * PEEK_FRACTION;
  /*
   * Closed form rather than a running accumulator: since every layer clears the
   * one in front by the SAME `PEEK`, layer i's right edge is just the front
   * layer's width plus `i * PEEK`. (Written as a `let` first — React Compiler's
   * lint correctly rejects mutating render-scope state inside a map.)
   */
  /*
   * Every box is SQUARE, so the front layer is always `size` wide and each
   * layer's right edge lands exactly `PEEK` beyond the one in front. The gap
   * is therefore constant by construction rather than by clamping — the
   * earlier fix capped widths to force this; squaring the boxes makes it fall
   * out for free, and fixes glyph alignment at the same time.
   */
  const layers = shown.map((shape, i) => {
    const side = size * (1 - i * SHRINK);
    return {
      shape,
      i,
      side,
      imageWidth: artworkWidth(shape, side),
      left: size + i * PEEK - side,
    };
  });
  const frontWidth = layers[0]?.side ?? size;

  return (
    <View style={{ width: coverClusterWidth(size), height: size }}>
      {/* Painted back-to-front: React Native has no z-index on Android worth
          relying on, so paint order is the ordering primitive. */}
      {layers
        .slice()
        .reverse()
        .map(({ shape, i, left, side, imageWidth }) => {
          return (
            <View
              key={`${shape.uri ?? 'none'}-${i}`}
              style={[
                styles.clusterLayer,
                {
                  left,
                  top: (size - side) / 2,
                  width: side,
                  height: side,
                  borderColor: themeColors.background,
                },
              ]}
            >
              {/* Explicit width, centred by the parent — NOT absoluteFill, which
                  would stretch a tall cover to the square box and distort it.
                  Narrow artwork leaves `PILLAR` showing; wide artwork overflows
                  and is cropped evenly by the layer's `overflow: hidden`. */}
              <FastImage
                source={{
                  uri: shape.uri ?? unknownBookImageUri,
                  priority: FastImage.priority.low,
                  cache: FastImage.cacheControl.immutable,
                }}
                style={{ width: imageWidth, height: side }}
                resizeMode={FastImage.resizeMode.cover}
              />
              {/* Clipped by this layer's own radius + overflow, so it darkens
                  the cover and nothing outside it. */}
              {i === 0 && frontScrim > 0 && (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: withOpacity('#000000', frontScrim) },
                  ]}
                  pointerEvents='none'
                />
              )}
              {i > 0 && (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: withOpacity('#000000', 0.18 * i) },
                  ]}
                />
              )}
            </View>
          );
        })}

      {/* Painted last, so it sits above the front layer. `box-none` lets taps
          land on the button itself while the rest of the cover stays
          transparent to the row's own press handler. */}
      {overlay ? (
        <View
          style={[
            styles.clusterOverlay,
            overlayAlign === 'center' && styles.clusterOverlayCentered,
            { width: frontWidth, height: size },
          ]}
          pointerEvents='box-none'
        >
          {overlay}
        </View>
      ) : null}
    </View>
  );
});

/**
 * Detected-vs-hand-made. Ticket 06 made `series.origin` a real column and
 * tickets 02/09 removed the confirmation gate, so this chip is NOT an approval
 * prompt — it is provenance, and its only job in a browse layout is to justify
 * the presence of a correction affordance nearby.
 *
 * Real series carry no `origin` yet (schema v33 is unbuilt), and every real row
 * on the device was made by hand in the wizard — so absent means 'user'.
 */
export const OriginChip = memo(function OriginChip({
  series,
  iconOnly = false,
}: {
  series: DerivedSeries;
  /**
   * Drop the word, keep the glyph. Needed on the card variant, where the chip
   * shares a row with the meta line: at full width the chip ate the canonical
   * RANGE (`5 books · 1 finished · #1…`), and that range is ticket 07's whole
   * answer to "does the order read at a glance" — the thing ticket 08 exists
   * to judge. Provenance is the cheaper of the two to abbreviate.
   */
  iconOnly?: boolean;
}) {
  const { colors: themeColors } = useTheme();
  const origin = (series as ProtoSeries).origin ?? 'user';
  const detected = origin === 'detected';
  const Icon = detected ? Sparkles : UserRound;

  return (
    <View
      style={[
        styles.chip,
        iconOnly && styles.chipIconOnly,
        { backgroundColor: withOpacity(themeColors.textMuted, 0.14) },
      ]}
      accessibilityLabel={detected ? 'Detected series' : 'Your series'}
    >
      <Icon size={11} color={themeColors.textMuted} />
      {!iconOnly && (
        <Text style={[styles.chipText, { color: themeColors.textMuted }]}>
          {detected ? 'Detected' : 'Yours'}
        </Text>
      )}
    </View>
  );
});

/**
 * Completion by FINISHED-BOOK COUNT, never by averaging `bookProgressValue` —
 * that field is a tri-state enum (0/1/2), so an average would render "1 of 7
 * finished" as 50%. See the header comment in `seriesFacts.ts`.
 */
export const CompletionBar = memo(function CompletionBar({
  facts,
  compact = false,
}: {
  facts: SeriesFacts;
  compact?: boolean;
}) {
  const { colors: themeColors } = useTheme();
  const complete = facts.finishedCount === facts.bookCount;

  return (
    <View style={[styles.barRow, compact && styles.barRowCompact]}>
      <View
        style={[
          styles.barTrack,
          { backgroundColor: withOpacity(themeColors.textMuted, 0.22) },
        ]}
      >
        <View
          style={[
            styles.barFill,
            {
              // Clamped: a 0-book series would otherwise produce NaN%.
              width: `${Math.round(Math.min(1, Math.max(0, facts.completion)) * 100)}%`,
              backgroundColor: complete
                ? themeColors.success
                : themeColors.primary,
            },
          ]}
        />
      </View>
      <Text style={[styles.barLabel, { color: themeColors.textMuted }]}>
        {facts.finishedCount}/{facts.bookCount}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  clusterLayer: {
    position: 'absolute',
    borderRadius: 5,
    borderWidth: 1.5,
    overflow: 'hidden',
    // Centre the artwork inside the square box, so pillars (tall covers) and
    // crops (wide covers) are both symmetric.
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PILLAR,
  },
  clusterOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    // Bottom-right of the front cover, matching `BookGridItem`'s play button.
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    padding: 4,
  },
  clusterOverlayCentered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 9,
  },
  chipIconOnly: {
    paddingHorizontal: 5,
  },
  chipText: {
    fontFamily: 'Rubik',
    fontSize: 10,
    marginLeft: 4,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  barRowCompact: {
    marginTop: 8,
  },
  barTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
  barLabel: {
    fontFamily: 'Rubik',
    fontSize: 10,
    marginLeft: 8,
    minWidth: 34,
    textAlign: 'right',
  },
});
