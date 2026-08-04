/**
 * THROWAWAY — Series UX redesign prototype harness (ticket 13).
 * See `src/prototypes/README.md`. Delete this file with the rest of the harness.
 *
 * The ONE piece of the harness that could not be built inside `src/prototypes/`:
 * ticket 13's question is about PRESENTATION, and only a real route has any.
 * `ProtoSeriesDetail`'s `Modal` was flagged as a fidelity caveat by both 08 and
 * 10 for exactly this reason.
 *
 * ROOT-LEVEL SIBLING, NOT INSIDE `series/` — ticket 11's structural finding. A
 * screen inside the `series` group cannot be presented as a root-level sheet
 * (the group is ONE entry on the root stack, which is also why `exitGroup()`
 * pops all of it). Putting the detail sheet outside the group is what leaves it
 * UNDER the editor, so the editor's `exitGroup()` lands back here — which fixes
 * ticket 10's predicted `Save` bug for free, and breaks `Delete` instead.
 *
 * Options live in `_layout.tsx`, matching `titleDetails` — see the comment there.
 */
import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import { useSeriesSource } from '@/prototypes/useSeriesSource';
import ProtoSeriesDetailSheet from '@/prototypes/ProtoSeriesDetailSheet';

export default function SeriesDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  /*
   * Resolved by id rather than handed the object, so the screen works for BOTH
   * datasets: synthetic series carry stable `proto:<sortname>` ids and
   * `useSeriesSource` is the same hook the library screen injects through. It
   * also survives the full JS reloads that navigator work forces — the exact
   * friction ticket 04 built the persisted harness to remove.
   */
  const series = useSeriesSource().find((s) => s.id === id);

  if (!__DEV__) return null;

  if (!series) {
    /*
     * TICKET 13'S `Delete` FINDING, LEFT DELIBERATELY VISIBLE.
     *
     * `handleDelete` → `exitGroup()` (`series/edit/[id].tsx:182`) pops the
     * editor group and reveals THIS sheet, for a series that no longer exists.
     * 11 predicted it; seeing it is 13's job, so this renders exactly what the
     * spec'd screen would render — nothing — rather than papering over it with
     * a friendly empty state. The log is the only concession, so a blank sheet
     * can be told apart from a broken prototype.
     */
    console.log(`[proto13] detail: series "${id}" not found → blank sheet`);
    return null;
  }

  return <ProtoSeriesDetailSheet series={series} />;
}
