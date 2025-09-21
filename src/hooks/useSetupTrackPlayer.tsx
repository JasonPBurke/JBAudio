import { useEffect, useRef } from 'react';
import TrackPlayer, {
  AndroidAudioContentType,
  Capability,
  // RatingType,
  RepeatMode,
} from 'react-native-track-player';
import * as MediaLibrary from 'expo-media-library';

async function requestAudioPermission() {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status === 'granted') {
    // Permission granted, you can now access audio files
    console.log('Audio access granted!');
  } else {
    // Permission denied
    console.log('Audio access denied.');
  }
}

const setupPlayer = async () => {
  await TrackPlayer.setupPlayer({
    autoHandleInterruptions: true,
    androidAudioContentType: AndroidAudioContentType.Speech,
    maxCacheSize: 1024 * 10, //* more useful for server access of media
  });

  await TrackPlayer.updateOptions({
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
  await TrackPlayer.setRepeatMode(RepeatMode.Queue); //* probably want this set to off not queue
};

export const useSetupTrackPlayer = ({
  onLoad,
}: {
  onLoad?: () => void;
}) => {
  const isInitialized = useRef(false);

  useEffect(() => {
    requestAudioPermission();
    setupPlayer()
      .then(() => {
        isInitialized.current = true;
        onLoad?.();
      })
      .catch((error) => {
        isInitialized.current = false;
        console.error(error);
      });
  }, [onLoad]);
};
