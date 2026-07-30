export type PlayerArtworkSizeInput = {
  /** Cover art aspect ratio, `artworkWidth / artworkHeight`. */
  aspectRatio: number;
  /** Current window width in dp. */
  windowWidth: number;
  /** Current window height in dp. */
  windowHeight: number;
  /** Safe-area inset reserved for the system navigation bar. */
  bottomInset: number;
  /** Vertical dp consumed by every player child that is not the artwork. */
  chromeHeight: number;
  /** Horizontal screen padding applied on each side. */
  horizontalPadding: number;
};

export type PlayerArtworkSize = {
  width: number;
  height: number;
};

/**
 * Sizes the player's cover art from the space left over after everything else.
 *
 * The player's controls are the fixed budget and the artwork is the remainder:
 * on every form factor — phone, tablet, foldable, split-screen — the system
 * bars and the control chrome are reserved first, and the cover takes whatever
 * vertical space remains, bounded by the screen width so it cannot overflow
 * horizontally.
 *
 * This replaces a hardcoded `normalizeSize(375)` height, which was an
 * approximation of the same rule tuned for one phone. It failed in both
 * directions: on a tablet the value inflated to ~730dp and pushed the controls
 * underneath the navigation bar, while on a phone a wide (landscape) cover
 * computed a width of ~562dp on a 411dp screen and ran off both edges.
 *
 * Whichever of the two bounds is smaller wins, so tall screens are limited by
 * width and short/wide ones by available height.
 */
export function computePlayerArtworkSize({
  aspectRatio,
  windowWidth,
  windowHeight,
  bottomInset,
  chromeHeight,
  horizontalPadding,
}: PlayerArtworkSizeInput): PlayerArtworkSize {
  // Books scanned without artwork dimensions yield 0 / NaN / Infinity here.
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return { width: 0, height: 0 };
  }

  const contentWidth = windowWidth - horizontalPadding * 2;
  const widthBound = contentWidth / aspectRatio;
  const heightBound = windowHeight - bottomInset - chromeHeight;

  // Math.max guards windows too small to fit the chrome at all (split-screen),
  // where reserving the controls leaves nothing over for the cover.
  const height = Math.max(0, Math.min(widthBound, heightBound));

  // Re-deriving the width divides and re-multiplies by the aspect ratio, which
  // can land a hair over the content width (776 / 1.06 * 1.06 = 776.0000000000001)
  // and overflow the screen. Clamp so the bound is never exceeded.
  const width = Math.min(height * aspectRatio, Math.max(0, contentWidth));

  return { width, height };
}

export type DetailsArtworkSizeInput = {
  /** Cover art aspect ratio, `artworkWidth / artworkHeight`. */
  aspectRatio: number;
  /** Current window width in dp. */
  windowWidth: number;
  /** Current window height in dp. */
  windowHeight: number;
  /** Horizontal screen padding applied on each side. */
  horizontalPadding: number;
};

/**
 * Share of the window height the titleDetails cover occupies.
 *
 * 0.42 is the ratio the previous hardcoded 375dp produced on a 411x891dp
 * phone, so phones keep the size they already had.
 */
export const DETAILS_ARTWORK_HEIGHT_RATIO = 0.42;

/**
 * Sizes the titleDetails cover as a share of the window height.
 *
 * Deliberately a *proportion* rather than the player's *remainder*, because
 * the two screens fail differently. The player's children share one fixed
 * flex column, so an oversized cover pushes the controls off screen entirely.
 * On titleDetails everything below the cover lives in a ScrollView, so an
 * oversized cover only pushes content below the fold — recoverable by
 * scrolling, but it hides the play button, which is the thing to avoid.
 *
 * The ratio is tuned so the play button stays above the fold on a tablet
 * while the cover still scales up with the screen.
 *
 * Bounded by width for the same reason as the player: a wide (landscape)
 * cover would otherwise compute a width wider than the screen.
 */
export function computeDetailsArtworkSize({
  aspectRatio,
  windowWidth,
  windowHeight,
  horizontalPadding,
}: DetailsArtworkSizeInput): PlayerArtworkSize {
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return { width: 0, height: 0 };
  }

  const contentWidth = windowWidth - horizontalPadding * 2;
  const height = Math.max(
    0,
    Math.min(
      windowHeight * DETAILS_ARTWORK_HEIGHT_RATIO,
      contentWidth / aspectRatio,
    ),
  );
  const width = Math.min(height * aspectRatio, Math.max(0, contentWidth));

  return { width, height };
}
