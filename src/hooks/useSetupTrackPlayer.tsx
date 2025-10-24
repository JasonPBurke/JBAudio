import { useEffect, useRef } from 'react';
import TrackPlayer, {
  AndroidAudioContentType,
  Capability,
  // RatingType,
  RepeatMode,
} from 'react-native-track-player';
import * as MediaLibrary from 'expo-media-library';

async function requestAudioPermission(): Promise<
  'granted' | 'denied' | 'undetermined'
> {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status === 'granted') {
    console.log('Audio access granted!');
    return 'granted';
  } else {
    console.log('Audio access denied.');
    return 'denied';
  }
}

const setupPlayer = async () => {
  await TrackPlayer.setupPlayer({
    autoHandleInterruptions: true,
    androidAudioContentType: AndroidAudioContentType.Speech,
    maxCacheSize: 1024 * 10, //* more useful for server access of media
  });

  await TrackPlayer.updateOptions({
    progressUpdateEventInterval: 1,
    capabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.JumpForward,
      Capability.JumpBackward,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
      Capability.SeekTo,
    ],
    forwardJumpInterval: 30,
    backwardJumpInterval: 30,
  });

  // await TrackPlayer.setVolume(0.5);
  await TrackPlayer.setRepeatMode(RepeatMode.Off); //* probably want this set to off not queue
};

import { usePermission } from '@/contexts/PermissionContext';

export const useSetupTrackPlayer = ({
  onLoad,
}: {
  onLoad?: () => void;
}) => {
  const isInitialized = useRef(false);
  const { setAudioPermissionStatus } = usePermission();

  useEffect(() => {
    requestAudioPermission().then((status) => {
      setAudioPermissionStatus(status);
      if (status === 'granted') {
        setupPlayer()
          .then(() => {
            isInitialized.current = true;
            onLoad?.();
          })
          .catch((error) => {
            isInitialized.current = false;
            console.error(error);
          });
      }
    });
  }, [onLoad, setAudioPermissionStatus]);
};
