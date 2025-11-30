import { useEffect } from 'react';
import {
  PermissionsAndroid,
  Platform,
  Alert,
  Linking,
  Permission,
  NativeModules,
} from 'react-native';
import { usePermission } from '@/contexts/PermissionContext';
import { scanLibrary } from '@/helpers/scanLibrary';

export const useScanExternalFileSystem = () => {
  const { audioPermissionStatus } = usePermission();

  const handleScan = async () => {
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
      } else {
        // Guide user to settings to grant the permission manually.
        Alert.alert(
          'Additional Permission Needed',
          'To read chapter info from ".cue" files, the app needs permission to access all files. Please grant this in the app settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: async () => {
                const { PermissionModule } = NativeModules;
                PermissionModule?.openAllFilesAccessSettings();
              },
            },
          ]
        );
      }
    } else {
      // For older Android versions, READ_EXTERNAL_STORAGE is sufficient.
      scanLibrary();
    }
  };

  useEffect(() => {
    if (audioPermissionStatus === 'granted') {
      handleScan();
    }
  }, [audioPermissionStatus]);
};
