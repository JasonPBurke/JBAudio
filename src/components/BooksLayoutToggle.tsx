import { Pressable } from 'react-native';
import { ListChevronsDownUp, ListChevronsUpDown } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import type { BooksLayout } from '@/types/booksLayout';

/**
 * D9 -- the icon pair, settled by eye on a device (ticket 04).
 *
 * ONE list motif twice: chevrons apart on the grid, which the pair encodes as
 * the expanded state, and together on the list, the condensed one. The rival
 * pair -- two unrelated shapes, each naming its layout directly -- lost the
 * side-by-side comparison, and its imports are gone rather than parked. That
 * deletion is what keeps the generated lucide shim at the two icons this
 * feature actually costs instead of the four the comparison needed (D10).
 *
 * Two findings recorded against this pair during scoping were WEIGHED AND
 * ACCEPTED, not answered. They are written down because they are the reason a
 * later reader might take this file for a mistake:
 *   1. both glyphs carry the same list motif, so in the GRID layout the control
 *      shows a list. It is the chevrons that name the current state, and D8's
 *      announcement carries that meaning in words -- but a reader who takes the
 *      motif first will read the grid's icon as "switch to list".
 *   2. the density claim reverses at three columns (~75 points per Book in a
 *      three-column grid against ~99 for a list row), so at a Number of Columns
 *      the reader owns (D5) the "expanded" glyph can sit on the denser layout.
 *
 * The icon stays at the header's 24 points: the chevrons were legible at that
 * size in the comparison, so the third scoping finding -- that they might need
 * to be drawn larger, and so heavier than their neighbour -- did not land.
 *
 * ⚠ Changing this pair means changing the imports above AND running
 * `npm run generate:lucide-shim`. The shim's drift test fails in both
 * directions, so a stale shim surfaces in the suite rather than as an undefined
 * component at render time.
 */
const ICONS = {
  grid: ListChevronsUpDown,
  list: ListChevronsDownUp,
} as const;

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
