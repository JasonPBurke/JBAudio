import { useEffect, useRef, useCallback } from 'react';
import { usePermission } from '@/contexts/PermissionContext';
import { scanLibrary } from '@/helpers/scanLibrary';
import { getLastScanAt } from '@/db/settingsQueries';

const SCAN_FRESHNESS_WINDOW_MS = 30 * 60 * 1000;

export const useScanExternalFileSystem = () => {
  const { audioPermissionStatus } = usePermission();

  const handleScan = useCallback(async () => {
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
    if (audioPermissionStatus !== 'granted') return;

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
  }, [audioPermissionStatus, handleScan]);
};
