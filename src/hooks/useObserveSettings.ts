import { useCallback, useRef, useSyncExternalStore } from 'react';

export type SettingsSlice = {
  timerActive: boolean;
  timerDuration: number | null;
  timerChapters: number | null;
} | null;

function isEqualSettings(a: SettingsSlice, b: SettingsSlice) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.timerActive === b.timerActive &&
    a.timerDuration === b.timerDuration &&
    a.timerChapters === b.timerChapters
  );
}

export function useObserveSettings(database: any): SettingsSlice {
  const snapshotRef = useRef<SettingsSlice>(null);

  const getSnapshot = useCallback(() => snapshotRef.current, []);
  const getServerSnapshot = getSnapshot;

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const collection = database.collections.get('settings');
      const query = collection.query();
      const hasObserveWithColumns = typeof (query as any).observeWithColumns === 'function';
      const observable = hasObserveWithColumns
        ? (query as any).observeWithColumns([
            'timerActive',
            'timerDuration',
            'timerChapters',
          ])
        : query.observe();

      const subscription = observable.subscribe((value: any) => {
        const first = Array.isArray(value) ? value[0] : null;
        const next: SettingsSlice = first
          ? {
              timerActive: first.timerActive === true,
              timerDuration: first.timerDuration ?? null,
              timerChapters: first.timerChapters ?? null,
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
