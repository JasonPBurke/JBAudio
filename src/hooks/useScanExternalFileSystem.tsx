import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { scanLibrary } from '@/helpers/scanLibrary';
import { getLastScanAt, getLibraryPaths } from '@/db/settingsQueries';

const SCAN_FRESHNESS_WINDOW_MS = 30 * 60 * 1000;

export const useScanExternalFileSystem = () => {
  const handleScan = useCallback(async () => {
    if (Platform.OS !== 'android') return;

    const libraryTreeUris = await getLibraryPaths();
    if (!libraryTreeUris || libraryTreeUris.length === 0) {
      // No SAF tree picked yet. User picks a folder via the settings flow,
      // which calls scanLibrary directly through directoryPicker.
      return;
    }

    const lastScanAt = await getLastScanAt();
    if (
      lastScanAt !== null &&
      Date.now() - lastScanAt < SCAN_FRESHNESS_WINDOW_MS
    ) {
      return;
    }

    scanLibrary();
  }, []);

  const hasDeferredFirstScan = useRef(false);

  useEffect(() => {
    if (!hasDeferredFirstScan.current) {
      hasDeferredFirstScan.current = true;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const idleHandle = requestIdleCallback(() => {
        timeoutId = setTimeout(handleScan, 500);
      });
      return () => {
        cancelIdleCallback(idleHandle);
        if (timeoutId !== null) clearTimeout(timeoutId);
      };
    }

    handleScan();
  }, [handleScan]);
};
