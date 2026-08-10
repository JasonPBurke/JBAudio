/**
 * The Series completion bar with its `n/total` label — §B1.3, shared by the
 * browse row and the detail sheet's hero (§C9 carries it over unchanged).
 *
 * ⚠ COMPLETION IS A COUNT OF FINISHED BOOKS, never an average of
 * `bookProgressValue` — that field is a tri-state enum (0/1/2), so averaging it
 * renders "1 of 7 finished" as 50% (K12). The arithmetic is done once in
 * `getSeriesRowFacts`; this only paints it.
 */
import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { withOpacity } from '@/helpers/colorUtils';
import type { SeriesRowFacts } from '@/helpers/seriesRowFacts';

export const SeriesCompletionBar = memo(function SeriesCompletionBar({
  facts,
}: {
  facts: SeriesRowFacts;
}) {
  const { colors: themeColors } = useTheme();
  const complete =
    facts.bookCount > 0 && facts.finishedCount === facts.bookCount;

  return (
    <View style={styles.barRow}>
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
              width: `${Math.round(
                Math.min(1, Math.max(0, facts.completion)) * 100,
              )}%`,
              // Same per-scheme token as `Series complete` (§I7): the shared
              // `success` is 1.54:1 on the light background.
              backgroundColor: complete
                ? themeColors.successText
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
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
