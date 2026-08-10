/**
 * The Series detail route — spec §C1/§C2.
 *
 * ROOT-LEVEL SIBLING, NOT INSIDE `series/`, and that is FORCED rather than
 * chosen: the group is ONE entry on the root stack, so a screen inside it
 * cannot be presented as a root-level sheet (and that is also why the editor's
 * `exitGroup()` pops all of it). Putting this sheet outside the group leaves it
 * UNDER the editor, which makes the editor's `Save`/`Cancel` exits correct by
 * construction.
 *
 * Options live in `_layout.tsx`, matching the book details screen — see the
 * comment there, and K5: they must set a themed `contentStyle`, or a state
 * where this route renders nothing is a full-screen WHITE sheet on a
 * dark-theme app.
 *
 * Resolved BY ID rather than handed the object, because a route only carries
 * params. The store it resolves from has already resolved every membership row
 * against the live library (K11), so a book that reaches the sheet is a book
 * that can be drawn.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SeriesDetailSheet from '@/components/SeriesDetailSheet';
import { useTheme } from '@/hooks/useTheme';
import { withOpacity } from '@/helpers/colorUtils';
// THROWAWAY (harness) — `useSeriesSource()` is `useDerivedSeries()` unless a
// synthetic preset is selected; in production it IS the real store. Same
// substitution the library screen carries. See src/prototypes/README.md.
import { useSeriesSource } from '@/prototypes/useSeriesSource';

export default function SeriesDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const series = useSeriesSource().find((s) => s.id === id);

  if (!series) return <MissingSeries />;

  return <SeriesDetailSheet series={series} />;
}

/**
 * The series is gone — most often because the editor deleted it and popped back
 * onto this sheet (K7).
 *
 * ⚠ THIS IS NOT THE FIX FOR K7, and it must not be mistaken for one. K7 needs
 * the delete to pop PAST this sheet, which is the editor's routing and belongs
 * to the detection-aware save/delete ticket. What this covers is the other half
 * K5 names: the route renders nothing, and with no themed background that is a
 * full-screen white sheet on a dark-theme app. The handle is kept so the state
 * is escapable without the hardware back button — a blank sheet with no grab
 * handle traps the user.
 */
function MissingSeries() {
  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: themeColors.background,
          paddingTop: insets.top + 8,
        },
      ]}
    >
      <View style={styles.dismissContainer}>
        <Pressable
          hitSlop={10}
          onPress={() => router.back()}
          style={[
            styles.dismissIndicator,
            {
              backgroundColor: withOpacity(themeColors.background, 0.66),
              borderColor: themeColors.textMuted,
            },
          ]}
          accessibilityRole='button'
          accessibilityLabel='Close series'
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  dismissContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 10,
  },
  dismissIndicator: {
    width: 55,
    height: 7,
    borderRadius: 50,
    borderWidth: 1,
  },
});
