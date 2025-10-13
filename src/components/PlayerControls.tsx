import {
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
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
import {
  Play,
  Pause,
  IterationCcw,
  IterationCw,
  Gauge,
  Bell,
  SkipBack,
  SkipForward,
} from 'lucide-react-native';
import { colors } from '@/constants/tokens';
import { useState } from 'react';

type PlayerControlsProps = {
  style?: ViewStyle;
};

type PlayerButtonProps = {
  style?: ViewStyle;
  iconSize?: number;
  fontSize?: number;
  top?: number;
  right?: number;
};

export const PlayerControls = ({ style }: PlayerControlsProps) => {
  return (
    <View style={[styles.controlsContainer, style]}>
      <View style={styles.playerRow}>
        <PlaybackSpeed iconSize={25} />
        <SeekBackButton iconSize={35} top={5} right={11} fontSize={12} />

        <PlayPauseButton iconSize={70} />

        <SeekForwardButton iconSize={35} top={5} right={11} fontSize={12} />
        <SleepTimer iconSize={25} />
      </View>
    </View>
  );
};

export const PlayPauseButton = ({
  style,
  iconSize = 50,
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
        {playing ? (
          <Pause
            size={iconSize}
            color={colors.icon}
            strokeWidth={1.5}
            absoluteStrokeWidth
          />
        ) : (
          <Play
            size={iconSize}
            color={colors.icon}
            strokeWidth={1.5}
            absoluteStrokeWidth
          />
        )}
      </TouchableOpacity>
    </View>
  );
};

export const SeekBackButton = ({
  iconSize = 30,
  top = 7,
  right = 12,
  fontSize,
}: PlayerButtonProps) => {
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
      <IterationCw
        size={iconSize}
        color={colors.icon}
        strokeWidth={1.5}
        absoluteStrokeWidth
      />

      <Text
        style={{
          ...styles.seekTime,
          fontSize: fontSize,
          top: top,
          right: right,
        }}
      >
        {seekDuration}
      </Text>
    </TouchableOpacity>
  );
};

export const SeekForwardButton = ({
  iconSize = 30,
  top = 7,
  right = 12,
  fontSize,
}: PlayerButtonProps) => {
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
      <IterationCcw
        size={iconSize}
        color={colors.icon}
        strokeWidth={1.5}
        absoluteStrokeWidth
      />

      <Text
        style={{
          ...styles.seekTime,
          fontSize: fontSize,
          top: top,
          right: right,
        }}
      >
        {seekDuration}
      </Text>
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
      <SkipBack
        size={iconSize}
        color={colors.icon}
        strokeWidth={1.5}
        absoluteStrokeWidth
      />
    </TouchableOpacity>
  );
};

export const SkipToNextButton = ({ iconSize = 30 }: PlayerButtonProps) => {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => TrackPlayer.skipToNext()}
    >
      <SkipForward
        size={iconSize}
        color={colors.icon}
        strokeWidth={1.5}
        absoluteStrokeWidth
      />
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
    <TouchableOpacity
      // style={{
      //   // flexDirection: 'row',
      //   justifyContent: 'center',
      //   alignItems: 'center',
      //   gap: 2,
      // }}
      activeOpacity={0.7}
      onPress={handleSpeedRate}
    >
      <Gauge
        size={iconSize}
        color={colors.icon}
        strokeWidth={1.5}
        absoluteStrokeWidth
      />

      <Text
        style={{ position: 'absolute', bottom: 14, left: 22, fontSize: 10 }}
      >
        {speedRates[currentIndex]}x
      </Text>
    </TouchableOpacity>
  );
};

export const SleepTimer = ({ iconSize = 30 }: PlayerButtonProps) => {
  return (
    <TouchableOpacity activeOpacity={0.7}>
      <Bell
        size={iconSize}
        color={colors.icon}
        strokeWidth={1.5}
        absoluteStrokeWidth
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
  seekTime: {
    position: 'absolute',
  },
});
