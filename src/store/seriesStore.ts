import { create } from 'zustand';
import { Subscription } from 'rxjs';
import { observeSeriesData } from '@/db/seriesQueries';
import {
  assembleDerivedSeries,
  DerivedSeries,
  SeriesRow,
  MembershipRow,
} from '@/helpers/seriesAssembly';
import { useLibraryStore } from '@/store/library';

interface SeriesState {
  series: DerivedSeries[];
  init: () => () => void;
  _cleanup?: () => void;
}

/**
 * Derived-series store. Observes the series + series_books tables and combines
 * them with the live library `books` map to resolve membership (by structural
 * key) into render-ready DerivedSeries. Recomputes when EITHER source changes,
 * because resolution depends on both. Mirrors the init/cleanup guarding used by
 * the library store (src/store/library.tsx).
 */
export const useSeriesStore = create<SeriesState>()((set, get) => ({
  series: [],
  init: () => {
    const existing = get()._cleanup;
    if (existing) {
      if (__DEV__) {
        console.warn('Series store init called while already initialized');
      }
      return existing;
    }

    let latest: { series: SeriesRow[]; memberships: MembershipRow[] } = {
      series: [],
      memberships: [],
    };

    const recompute = () =>
      set({
        series: assembleDerivedSeries(
          latest.series,
          latest.memberships,
          useLibraryStore.getState().books,
        ),
      });

    const subs: Subscription[] = [];
    subs.push(
      observeSeriesData().subscribe((data) => {
        latest = data;
        recompute();
      }),
    );

    // Re-resolve when the library book map changes (a book appears/disappears
    // or its structural key changes), even if series rows are unchanged.
    const unsubLibrary = useLibraryStore.subscribe((s, prev) => {
      if (s.books !== prev.books) recompute();
    });

    const cleanup = () => {
      subs.forEach((x) => x.unsubscribe());
      unsubLibrary();
      set({ _cleanup: undefined });
    };
    set({ _cleanup: cleanup });
    return cleanup;
  },
}));

export const useDerivedSeries = () => useSeriesStore((s) => s.series);
