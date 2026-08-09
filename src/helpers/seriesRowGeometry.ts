/**
 * Geometry for the Series browse row — spec §H, plus §B2 and trap K13.
 *
 * Pure and zero-React so the rules that were argued over can be asserted
 * directly. The load-bearing claims, restated where they are implemented:
 *
 *   §H1  the row's CONTENT caps at `min(width, 600)dp`, left-anchored
 *   §H3  PAINT (backdrop + hairline) is never capped
 *   §H4  every cluster is a fixed fraction of the cap, anchored on its own
 *        411dp value — a verified no-op on a phone
 *   §H5  type is NEVER scaled with width; padding and the leading visual may be
 *   §B2  the cluster's box is SQUARE and its width is constant regardless of
 *        cover count or shape, so every row's text column starts at the same x
 *   K13  the fan's offset must outpace its shrink, or the front layer occludes
 *        the rest and a 22-book series draws as one lone cover
 */
import { screenPadding } from '@/constants/tokens';

/**
 * The width at which Series content stops growing. Android's sw600dp
 * breakpoint: content never gets wider than the point at which the platform
 * stops calling the device a phone.
 *
 * CONTENT ONLY. The backdrop and the hairline rule still bleed to both screen
 * edges — capping paint puts visible edges on the row and reads as the card
 * that was measured and rejected (§H3).
 */
export const CONTENT_CAP = 600;

/** The phone this design was measured on. Every ratio below is anchored here. */
export const PHONE_WIDTH = 411;

/** Long-axis box for one cluster layer at {@link PHONE_WIDTH}. */
export const CLUSTER_PHONE_SIZE = 84;

/** Max layers a cluster ever paints. */
export const CLUSTER_MAX_LAYERS = 3;

/**
 * The sliver each layer shows beyond the one in front, as a fraction of the
 * front layer's side. 0.10 reproduces exactly the cluster width the original
 * square-cover geometry produced (100.8dp at size 84); 0.22 was tried and took
 * 20dp straight out of the text column, already the scarcest thing here.
 */
export const CLUSTER_PEEK_FRACTION = 0.1;

/** Per-layer size reduction — the depth cue. */
export const CLUSTER_LAYER_SHRINK = 0.12;

/** Gap between the cover cluster and the text column. */
export const TEXT_GAP = 14;

/** A cover plus the aspect ratio needed to draw it at its artwork's real shape. */
export type CoverShape = { uri: string | null; aspect: number };

/** One drawn layer of the fan, positioned inside the cluster's box. */
export type ClusterLayer = {
  shape: CoverShape;
  index: number;
  /** The layer's SQUARE box — §B2. */
  side: number;
  /** Width the artwork is drawn at inside that box; height is always `side`. */
  imageWidth: number;
  /** Offset from the cluster box's left edge. */
  left: number;
};

/**
 * Cover size as a fraction of the capped content width (§H4).
 *
 * `84 / 411` reproduces today's phone value EXACTLY — the rule is a verified
 * no-op at 411dp, so a phone renders bit-for-bit what it rendered before. At
 * the cap it yields ~122.6dp, holding the artwork at the same ~24.5% of the row
 * it occupies on a phone instead of decaying to 7.9%.
 *
 * Scaling one Series cluster and not another INVERTS the artwork hierarchy —
 * that happened, and the browse fan ended up bigger than the detail hero's.
 */
export function clusterCoverSize(width: number): number {
  const cap = Math.min(width, CONTENT_CAP);
  return Math.round(cap * (CLUSTER_PHONE_SIZE / PHONE_WIDTH) * 10) / 10;
}

/**
 * The cluster's box width — CONSTANT for a given `size`, regardless of how many
 * covers a series has or what shape they are (§B2).
 *
 * It has to be constant. When it was derived from the cover count, a 1-book
 * series returned `size` and a 3-book series `size * 1.2`, so every row's text
 * column started at a different x and the list read as misaligned.
 */
export function coverClusterWidth(size: number): number {
  return size * (1 + (CLUSTER_MAX_LAYERS - 1) * CLUSTER_PEEK_FRACTION);
}

/**
 * Lay out the fan back-to-front, capped at {@link CLUSTER_MAX_LAYERS}.
 *
 * THE OFFSET IS APPLIED TO THE RIGHT EDGE, NOT THE LEFT. Each layer's right
 * edge sits a constant `peek` beyond the one in front and its left follows from
 * its own width, so the visible sliver is identical for every layer whatever
 * shape the artwork is. Offsetting the left instead makes the offset race the
 * shrink — at equal rates every layer right-aligns, the front one occludes the
 * rest, and the whole series draws as one lone cover (K13).
 *
 * The BOX is always square (§B2): a tall cover comes out narrower and is
 * pillarboxed, a wide one comes out wider and is cropped evenly by the layer's
 * own `overflow: hidden`.
 */
export function clusterLayers(
  covers: CoverShape[],
  size: number,
): ClusterLayer[] {
  const peek = size * CLUSTER_PEEK_FRACTION;
  return covers.slice(0, CLUSTER_MAX_LAYERS).map((shape, index) => {
    const side = size * (1 - index * CLUSTER_LAYER_SHRINK);
    return {
      shape,
      index,
      side,
      imageWidth: side * shape.aspect,
      left: size + index * peek - side,
    };
  });
}

/**
 * Width available to the row's text column at a given screen width.
 *
 * Derived rather than measured so the overflow rule below has a truth to
 * compare against without a second `<Text>` in a recycled cell.
 */
export function browseTextColumnWidth(width: number): number {
  const cap = Math.min(width, CONTENT_CAP);
  return (
    cap -
    screenPadding.horizontal * 2 -
    coverClusterWidth(clusterCoverSize(width)) -
    TEXT_GAP
  );
}

/**
 * Where the row's hairline separator starts, so the rule begins under the TEXT
 * — the same intent as the books list's hard-coded `marginLeft: 75`, but
 * derived, because the cluster's drawn width is `size` plus every layer's peek.
 *
 * Uses the MAX layer count, never the per-series one: a 1-book series draws a
 * narrower fan, and an inset that moved row-to-row would read as a fault.
 */
export function separatorInset(width: number): number {
  return (
    screenPadding.horizontal + coverClusterWidth(clusterCoverSize(width)) + TEXT_GAP
  );
}

/** Sub-pixel slack when comparing a measured line against a derived width. */
const OVERFLOW_EPSILON = 0.5;

/**
 * Zero-width characters Android pads an ellipsized line with, so the reported
 * string keeps the same character count as the source. Stripped before the
 * comparison below; see `isMetaLineOverflowing`.
 */
const ZERO_WIDTH = /[﻿​]/g;

/**
 * Did the meta line actually overflow its column? — K14, *measure, don't infer*.
 *
 * The prototype dropped `M finished` above a font-scale threshold, which is a
 * PROXY: it fires on short lines that fit and misses long ones that do not.
 * This reads the real `onTextLayout` measurement of the real string.
 *
 * ⚠ THE TEST IS TEXT INEQUALITY. Two plausible alternatives were built and
 * MEASURED WRONG on a Pixel 7 Pro at 411dp / font scale 2.0 — Android reported
 * the truncated line as:
 *
 *     text: "3 books · 1 finished · #…﻿﻿﻿﻿﻿"   width: 262.33   available: 272.51
 *
 *   - a LENGTH comparison sees nothing, because the ellipsis is padded with
 *     U+FEFF to preserve the source string's character count;
 *   - a WIDTH comparison sees nothing, because an ellipsized line is drawn
 *     NARROWER than the column, not wider;
 *   - a line COUNT comparison sees nothing, because `numberOfLines={1}` caps
 *     what gets reported at one line.
 *
 * Comparing the reported text to the source catches it, and — unlike "contains
 * an ellipsis" — it stays correct when §H10's run cap puts a real `…` in the
 * string. The width check is kept as a second signal for the layout path that
 * reports the whole string with its natural width.
 *
 * All of this avoids the duplicate off-screen `<Text>` used to measure a
 * one-off title, which doubles per-cell text layout in a recycled list.
 */
export function isMetaLineOverflowing(
  lines: readonly { text: string; width: number }[],
  fullText: string,
  availableWidth: number,
): boolean {
  // Before first layout there is nothing to claim either way.
  if (availableWidth <= 0) return false;
  const first = lines[0];
  if (!first) return false;
  if (lines.length > 1) return true;
  if (first.text.replace(ZERO_WIDTH, '') !== fullText) return true;
  return first.width > availableWidth + OVERFLOW_EPSILON;
}
