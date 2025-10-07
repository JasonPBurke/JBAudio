import {
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import TrackPlayer, {
  useIsPlaying,
  useProgress,
} from 'react-native-track-player';
import {
  Feather,
  MaterialCommunityIcons,
  AntDesign,
} from '@expo/vector-icons';
import { colors } from '@/constants/tokens';
import { useState } from 'react';

type PlayerControlsProps = {
  style?: ViewStyle;
};

type PlayerButtonProps = {
  style?: ViewStyle;
  iconSize?: number;
};

export const PlayerControls = ({ style }: PlayerControlsProps) => {
  return (
    <View style={[styles.controlsContainer, style]}>
      <View style={styles.playerRow}>
        <PlaybackSpeed iconSize={25} />
        <SeekBackButton iconSize={30} />

        <PlayPauseButton iconSize={65} />

        <SeekForwardButton iconSize={30} />
        <SleepTimer iconSize={25} />
      </View>
    </View>
  );
};

export const PlayPauseButton = ({
  style,
  iconSize = 30,
}: PlayerButtonProps) => {
  const { playing } = useIsPlaying();

  const onButtonPress = async () => {
    if (playing) await TrackPlayer.pause();
    else await TrackPlayer.play();
  };

  return (
    <View style={[{ height: iconSize }, style]}>
      <TouchableOpacity
        activeOpacity={0.85}
        // onPress={playing ? TrackPlayer.pause : TrackPlayer.play}
        onPress={onButtonPress}
      >
        <AntDesign
          name={playing ? 'pausecircleo' : 'playcircleo'}
          size={iconSize}
          color={colors.icon}
        />
      </TouchableOpacity>
    </View>
  );
};

export const SeekBackButton = ({ iconSize = 30 }: PlayerButtonProps) => {
  // const { position } = useProgress();
  const seekDuration = 30;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={async () => {
        const currentPosition = await TrackPlayer.getProgress().then(
          (progress) => progress.position
        );
        await TrackPlayer.seekTo(currentPosition - seekDuration);

        // if (currentPosition - seekDuration < 0) {
        //   // const previousChapterSeekTime =
        //   await TrackPlayer.skipToPrevious(-seekDuration); //! this is not accurate need to calculate
        // } else {
        //   await TrackPlayer.seekTo(currentPosition - seekDuration);
        // }
      }}
    >
      <MaterialCommunityIcons
        name={`rewind-${seekDuration}`}
        // name='rewind-30'
        size={iconSize}
        color={colors.icon}
      />
    </TouchableOpacity>
  );
};

export const SeekForwardButton = ({ iconSize = 30 }: PlayerButtonProps) => {
  // const { position } = useProgress();
  const seekDuration = 30;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      // onPress={() => TrackPlayer.seekTo(position + 30)} //* old way using useProgress()
      onPress={async () => {
        const currentPosition = await TrackPlayer.getProgress().then(
          (progress) => progress.position
        );
        await TrackPlayer.seekTo(currentPosition + seekDuration);
      }}
    >
      <MaterialCommunityIcons
        name={`fast-forward-${seekDuration}`}
        // name='fast-forward-30'
        size={iconSize}
        color={colors.icon}
      />
    </TouchableOpacity>
  );
};

export const SkipToPreviousButton = ({
  iconSize = 30,
}: PlayerButtonProps) => {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => TrackPlayer.skipToPrevious()}
    >
      <Feather name='skip-back' size={iconSize} color={colors.icon} />
    </TouchableOpacity>
  );
};

export const SkipToNextButton = ({ iconSize = 30 }: PlayerButtonProps) => {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => TrackPlayer.skipToNext()}
    >
      <Feather name='skip-forward' size={iconSize} color={colors.icon} />
    </TouchableOpacity>
  );
};

export const PlaybackSpeed = ({ iconSize = 30 }: PlayerButtonProps) => {
  const speedRates = [0.5, 1.0, 1.5];
  const [currentIndex, setCurrentIndex] = useState(1);

  const handleSpeedRate = async () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % speedRates.length);
    //! crashing app...look at docs for implementation
    // await TrackPlayer.setRate(currentIndex);
    console.log('currentSpeedIndex', currentIndex);
  };

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={handleSpeedRate}>
      <MaterialCommunityIcons
        name={
          currentIndex === 0
            ? 'speedometer-slow'
            : currentIndex === 1
              ? 'speedometer-medium'
              : 'speedometer'
        }
        size={iconSize}
        color={colors.icon}
      />
      {/* <Text>{speedRates[currentIndex]}x</Text> */}
    </TouchableOpacity>
  );
};

export const SleepTimer = ({ iconSize = 30 }: PlayerButtonProps) => {
  return (
    <TouchableOpacity activeOpacity={0.7}>
      <MaterialCommunityIcons
        name='bell-sleep-outline'
        size={iconSize}
        color={colors.icon}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  controlsContainer: {
    width: '100%',
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
});
