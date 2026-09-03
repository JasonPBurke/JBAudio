import { Pressable } from 'react-native';
import {
  LayoutGrid,
  List,
  ListChevronsDownUp,
  ListChevronsUpDown,
} from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import type { BooksLayout } from '@/types/booksLayout';

/**
 * D9 -- the two candidate icon pairs, held in ONE constant so that choosing
 * between them on device is a one-line edit under Fast Refresh.
 *
 * `shapes`: two unrelated glyphs, each naming its layout directly.
 * `chevrons`: one list motif twice, chevrons apart on the grid (expanded) and
 *   together on the list (condensed).
 *
 * Three findings were recorded against `chevrons` during scoping and are the
 * device pass's job to settle, not this file's to pre-judge:
 *   1. both its glyphs contain the SAME list motif, so in the grid layout the
 *      control shows a list -- which reads as "switch to list" and works
 *      against D8's current-state rule;
 *   2. the density claim REVERSES at three columns (~75 points per Book in a
 *      three-column grid against ~99 for a list row), and Number of Columns is
 *      a setting the reader owns (D5);
 *   3. the chevrons are a small modifier on a busy glyph and may need a larger
 *      size than the header's icons to read at all.
 *
 * ⚠ All four are imported ON PURPOSE and the lucide shim is generated from
 * these imports (D10). This transient four-icon shim must NOT reach a release:
 * ticket 04 deletes the losing pair's imports and regenerates, taking the net
 * production cost to two icons.
 */
const ICON_PAIRS = {
  shapes: { grid: LayoutGrid, list: List },
  chevrons: { grid: ListChevronsUpDown, list: ListChevronsDownUp },
} as const;

/** ⚠ D9's one-line swap. Flip to `chevrons` on device to compare. */
const ICONS = ICON_PAIRS.shapes;

/**
 * D8 -- what TalkBack reads out, keyed by the layout the reader is IN.
 *
 * The value names WHERE YOU ARE and the hint names WHAT A PRESS DOES, because
 * the icon alone can only say one of the two. Getting this backwards is the
 * whole ambiguity of a single-icon toggle, so both halves are written together
 * here rather than derived at the call site.
 */
const ANNOUNCEMENT = {
  grid: { value: 'Cover grid', hint: 'Switches to the compact list' },
  list: { value: 'Compact list', hint: 'Switches to the cover grid' },
} as const;

type BooksLayoutToggleProps = {
  /** The layout currently mounted -- what the icon NAMES, not what it does. */
  layout: BooksLayout;
  onPress: () => void;
};

/**
 * The Books shelf's layout control (ADR 0006, D6/D8). It rides the search bar
 * overlay's trailing slot, which is what makes it travel with the bar: it
 * hides and returns with it and needs NO visibility handling of its own.
 *
 * ⚠ It needs none of the pointer-events guarding `CreateSeriesFab` requires
 * either. That button FADES, so it still occupies and hit-tests its box while
 * invisible; the overlay TRANSLATES out of an `overflow: 'hidden'` parent, so
 * this control is genuinely gone. The same fact is what makes "hide the bar,
 * then press this" an unreachable sequence rather than a case to guard.
 *
 * The tap target is enlarged with HIT-SLOP rather than padding -- matching the
 * header's controls, and keeping the search field from being pushed inward.
 * It owns no state: the layout and the handler belong to the library screen.
 */
const BooksLayoutToggle = ({ layout, onPress }: BooksLayoutToggleProps) => {
  const { colors: themeColors } = useTheme();
  const Icon = ICONS[layout];
  const { value, hint } = ANNOUNCEMENT[layout];

  return (
    <Pressable
      hitSlop={15}
      onPress={onPress}
      accessibilityRole='button'
      accessibilityLabel='Book layout'
      accessibilityValue={{ text: value }}
      accessibilityHint={hint}
    >
      <Icon
        size={24}
        color={themeColors.icon}
        strokeWidth={1.5}
        absoluteStrokeWidth
      />
    </Pressable>
  );
};

export default BooksLayoutToggle;
