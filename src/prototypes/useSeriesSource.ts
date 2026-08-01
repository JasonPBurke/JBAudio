/**
 * THROWAWAY — Series UX redesign prototype harness (ticket 04). See ./README.md.
 *
 * Drop-in replacement for `useDerivedSeries()` in the library screen. Returns
 * the real store output unless a synthetic preset is selected.
 *
 * Injecting HERE, above the library screen's search/tab/count pipeline, is what
 * makes the tab-filtering dataset meaningful: `countSeriesByState`,
 * `filterSeriesBySearch` and the tab filter all run over the synthetic rows
 * exactly as they run over real ones, with no branching in real code.
 *
 * Hook order is static in both builds — `useMemo` returns null in production
 * rather than the `__DEV__` branch selecting a different set of hooks.
 */
import { useMemo } from 'react';
import { DerivedSeries } from '@/helpers/seriesAssembly';
import { useDerivedSeries } from '@/store/seriesStore';
import { useLibraryStore } from '@/store/library';
import { useProtoStore } from './protoStore';
import { buildSyntheticSeries, ProtoSeries } from './syntheticSeries';

export function useSeriesSource(): DerivedSeries[] {
  const real = useDerivedSeries();
  const preset = useProtoStore((s) => s.dataPreset);
  const books = useLibraryStore((s) => s.books);

  const synthetic = useMemo<ProtoSeries[] | null>(() => {
    if (!__DEV__ || preset === 'off') return null;
    return buildSyntheticSeries(Object.values(books), preset);
  }, [preset, books]);

  return synthetic ?? real;
}
