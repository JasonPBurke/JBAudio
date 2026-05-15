import { useEffect, useRef, useState, useCallback } from 'react';
import {
  PermissionsAndroid,
  Platform,
  Alert,
  Permission,
  NativeModules,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePermission } from '@/contexts/PermissionContext';
import { scanLibrary } from '@/helpers/scanLibrary';
import { getLastScanAt } from '@/db/settingsQueries';

const ASKED_FOR_FULL_ACCESS_KEY = '@hasAskedForFullAccess';
const SCAN_FRESHNESS_WINDOW_MS = 30 * 60 * 1000;

export const useScanExternalFileSystem = () => {
  const { audioPermissionStatus } = usePermission();
  const [hasAskedForFullAccess, setHasAskedForFullAccess] = useState<
    boolean | null
  >(null);

  const handleScan = useCallback(async () => {
    const lastScanAt = await getLastScanAt();
    if (
      lastScanAt !== null &&
      Date.now() - lastScanAt < SCAN_FRESHNESS_WINDOW_MS
    ) {
      return;
    }

    if (Platform.OS !== 'android') {
      scanLibrary();
      return;
    }

    const apiLevel = Platform.Version;

    // For Android 11 (API 30) and above, we need MANAGE_EXTERNAL_STORAGE
    // to read non-media files like .cue sheets.
    if (apiLevel >= 30) {
      const hasFullAccess = await PermissionsAndroid.check(
        'android.permission.MANAGE_EXTERNAL_STORAGE' as Permission
      );

      if (hasFullAccess) {
        scanLibrary();
      } else if (hasAskedForFullAccess === false) {
        // Only ask if we haven't asked before
        // Guide user to settings to grant the permission manually.
        await AsyncStorage.setItem(ASKED_FOR_FULL_ACCESS_KEY, 'true');
        setHasAskedForFullAccess(true); // Update state to prevent re-asking in the same session
        Alert.alert(
          'Additional Permission Needed',
          'To read chapter info from ".cue" files, Sonicbooks needs permission to access all files. If you want to use your ".cue" files, please grant this in the app settings.',
          [
            // After canceling, we'll just scan without the permission next time.
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => scanLibrary(),
            },
            {
              text: 'Open Settings',
              onPress: () => {
                const { PermissionModule } = NativeModules;
                PermissionModule?.openAllFilesAccessSettings();
              },
            },
          ]
        );
      } else {
        // Permission not granted, but we've already asked. Scan without full access.
        scanLibrary();
      }
    } else {
      // For older Android versions, READ_EXTERNAL_STORAGE is sufficient.
      scanLibrary();
    }
  }, [hasAskedForFullAccess]);

  useEffect(() => {
    const loadPersistence = async () => {
      const value = await AsyncStorage.getItem(ASKED_FOR_FULL_ACCESS_KEY);
      setHasAskedForFullAccess(value === 'true');
    };
    loadPersistence();
  }, []);

  const hasDeferredFirstScan = useRef(false);

  useEffect(() => {
    if (audioPermissionStatus !== 'granted') return;
    if (hasAskedForFullAccess === null) return;

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
  }, [audioPermissionStatus, handleScan, hasAskedForFullAccess]);
};
