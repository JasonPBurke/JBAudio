/**
 * §F1 — the series subheading on `titleDetails`: `Book 8 of Discworld`.
 *
 * It is part of the TITLE BLOCK, the way a printed cover does it, and it beat
 * three structurally different rivals that each asserted a different answer to
 * *what kind of thing is a series* — identity/byline, tag/chip, metadata/card.
 *
 * §F3 — STATIC, not tappable. A subheading that reads as prose has nowhere to
 * put an affordance cue without becoming a field again, which is the thing
 * that made it win. The route to the series is not lost, only un-duplicated:
 * the sheet is reachable from the browse row.
 *
 * §F5 — a book in no series renders NOTHING. Not a dimmed placeholder: an
 * inapplicable item is absent app-wide.
 */
import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { fontSize } from '@/constants/tokens';
import { useTheme } from '@/hooks/useTheme';
import { useDerivedSeries } from '@/store/seriesStore';
import { bookSeriesLine } from '@/helpers/seriesLine';

const BookSeriesLine = ({ bookId }: { bookId: string | undefined }) => {
  const { colors: themeColors } = useTheme();
  const series = useDerivedSeries();
  const line = useMemo(() => bookSeriesLine(series, bookId), [series, bookId]);

  if (!line) return null;

  return (
    <View style={styles.row}>
      <Text
        style={[styles.text, { color: themeColors.lightTextMuted }]}
        // The title above it wraps freely, so this wraps too rather than
        // ellipsing a series name — but capped, because a title block that
        // grows without limit pushes the play button below the fold. Only
        // reachable at large font scales; at 1.0 the string is a third of the
        // column.
        numberOfLines={2}
      >
        {line}
      </Text>
    </View>
  );
};

export default BookSeriesLine;

const styles = StyleSheet.create({
  /*
   * §F7 — THE NEGATIVE TOP MARGIN IS LOAD-BEARING. DO NOT "CLEAN IT UP".
   *
   * `bookInfoColumn` sets `gap: 20`, which applies between EVERY child, so as
   * a plain child this line sat 20dp below the title and read as its own
   * block. The target was the gap `Read by` has above the narrator's name —
   * two Texts in a bare View, i.e. NO gap at all, pure line spacing. -17
   * against the parent's 20 leaves ~3dp.
   *
   * The gap BELOW is deliberately left alone: that is what keeps the line part
   * of the title block rather than part of the author block.
   *
   * Scale-invariant, because the gap it cancels is fixed dp too — so it needs
   * no font-scale re-check.
   */
  row: {
    width: '100%',
    alignItems: 'center',
    marginTop: -17,
  },
  /*
   * §F6 + K9 — ONE COLOUR, ONE STRING, AND IT IS NOT A THEME TOKEN.
   *
   * This screen paints an artwork-derived mesh gradient that is DARK IN BOTH
   * THEMES. Theme text tokens on it measured 1.20:1 in light theme —
   * effectively invisible — against 9.10:1 for the `Read by` value beside it.
   *
   * ⚠ NAMING TRAP: `lightTextMuted` means "light-COLOURED muted text", NOT
   * "muted text for the light theme". These live in `colorTokens.shared`,
   * which `useTheme` spreads OVER the per-scheme bag, so they are
   * theme-invariant BY CONSTRUCTION — which is exactly what a
   * component-painted surface needs. The book title one line up already uses
   * `lightText` for this reason.
   *
   * The governing rule for the whole family (§I1): anything drawn on a surface
   * the component itself darkens must take its colour from that surface, not
   * from the theme.
   *
   * This is also why there is no two-tone `Book N of ` prefix: the hierarchy
   * that bought is now bought by the token choice, one step under the title's
   * `lightText`.
   */
  text: {
    fontFamily: 'Rubik',
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
});
