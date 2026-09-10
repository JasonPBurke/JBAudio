import { Pressable } from 'react-native';
import {
  ListChevronsDownUp,
  ListChevronsUpDown,
} from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import type { BooksLayout } from '@/types/booksLayout';

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
