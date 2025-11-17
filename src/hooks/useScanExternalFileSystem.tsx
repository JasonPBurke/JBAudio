import { useEffect } from 'react';
import { usePermission } from '@/contexts/PermissionContext';
import { scanLibrary } from '@/helpers/scanLibrary';

export const useScanExternalFileSystem = () => {
  const { audioPermissionStatus } = usePermission();

  useEffect(() => {
    if (audioPermissionStatus === 'granted') {
      scanLibrary();
    }
  }, [audioPermissionStatus]);
};
