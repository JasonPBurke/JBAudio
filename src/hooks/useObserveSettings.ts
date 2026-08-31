import { useCallback, useRef, useSyncExternalStore } from 'react';
import { normalizeChapterCount } from '@/helpers/chapterTimerStepper';
import {
  resolveTimerMode,
  type TimerSelection,
} from '@/helpers/sleepTimerSelection';

export type SettingsSlice = {
  timerActive: boolean;
  /** Which option the user has chosen. The only thing that decides a highlight. */
  timerMode: TimerSelection;
  timerDuration: number | null;
  /** The DIALED count. What the bell re-arms from. */
  timerChapters: number | null;
  /** Chapters left on a RUNNING timer. What the countdown pill shows. */
  chaptersRemaining: number | null;
  sleepTime: number | null;
} | null;

function isEqualSettings(a: SettingsSlice, b: SettingsSlice) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.timerActive === b.timerActive &&
    a.timerMode === b.timerMode &&
    a.timerDuration === b.timerDuration &&
    a.timerChapters === b.timerChapters &&
    a.chaptersRemaining === b.chaptersRemaining &&
    a.sleepTime === b.sleepTime
  );
}

export function useObserveSettings(database: any | null): SettingsSlice {
  const snapshotRef = useRef<SettingsSlice>(null);

  const getSnapshot = useCallback(() => snapshotRef.current, []);
  const getServerSnapshot = getSnapshot;

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!database) return () => {};
      const collection = database.collections.get('settings');
      const query = collection.query();
      const hasObserveWithColumns =
        typeof (query as any).observeWithColumns === 'function';
      const observable = hasObserveWithColumns
        ? (query as any).observeWithColumns([
            'timer_active',
            'timer_mode',
            'timer_duration',
            'timer_chapters',
            'timer_chapters_remaining',
            'sleep_time',
          ])
        : query.observe();

      const subscription = observable.subscribe((value: any) => {
        const first = Array.isArray(value) ? value[0] : null;
        const next: SettingsSlice = first
          ? {
              timerActive: first.timerActive === true,
              timerMode: resolveTimerMode(
                first.timerMode ?? null,
                first.timerDuration ?? null,
                normalizeChapterCount(first.timerChapters ?? null),
              ),
              timerDuration: first.timerDuration ?? null,
              timerChapters: normalizeChapterCount(first.timerChapters ?? null),
              chaptersRemaining: normalizeChapterCount(
                first.timerChaptersRemaining ?? null,
              ),
              sleepTime: first.sleepTime ?? null,
            }
          : null;

        if (!isEqualSettings(snapshotRef.current, next)) {
          snapshotRef.current = next;
          onStoreChange();
        }
      });

      return () => subscription.unsubscribe();
    },
    [database]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
