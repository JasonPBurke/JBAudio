import { useEffect, useRef } from 'react';
import TrackPlayer, {
  AndroidAudioContentType,
  Capability,
  RepeatMode,
} from 'react-native-track-player';
import * as MediaLibrary from 'expo-media-library';
import { usePermission } from '@/contexts/PermissionContext';

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
    forwardJumpInterval: 30,
    backwardJumpInterval: 30,
    capabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.JumpForward,
      Capability.JumpBackward,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
      Capability.SeekTo,
    ],
  });

  await TrackPlayer.setRepeatMode(RepeatMode.Off);
};

export const useSetupTrackPlayer = ({
  onLoad,
}: {
  onLoad?: () => void;
}) => {
  const isInitialized = useRef(false);
  const { setAudioPermissionStatus } = usePermission();

  useEffect(() => {
    const setup = async () => {
      const status = await requestAudioPermission();
      setAudioPermissionStatus(status);
      if (status === 'granted') {
        try {
          await setupPlayer();
          isInitialized.current = true;
          onLoad?.();
        } catch (error) {
          isInitialized.current = false;
          console.error('Error setting up track player:', error);
        }
      }
    };
    setup();
  }, [onLoad, setAudioPermissionStatus]);
};
