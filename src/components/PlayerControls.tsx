import {
	Pressable,
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
	FontAwesome5,
	MaterialCommunityIcons,
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
				<PlaybackSpeed />
				<SeekBackButton iconSize={40} />

				<PlayPauseButton iconSize={60} />

				<SeekForwardButton iconSize={40} />
				<SleepTimer />
			</View>
		</View>
	);
};

export const PlayPauseButton = ({
	style,
	iconSize = 30,
}: PlayerButtonProps) => {
	const { playing } = useIsPlaying();

	return (
		<View style={[{ height: iconSize }, style]}>
			<TouchableOpacity
				activeOpacity={0.85}
				onPress={playing ? TrackPlayer.pause : TrackPlayer.play}
			>
				<FontAwesome5
					name={[playing ? 'pause-circle' : 'play-circle']}
					size={iconSize}
					color={colors.icon}
				/>
			</TouchableOpacity>
		</View>
	);
};

export const SeekBackButton = ({ iconSize = 30 }: PlayerButtonProps) => {
	const { position } = useProgress();

	return (
		<TouchableOpacity
			activeOpacity={0.7}
			onPress={() => TrackPlayer.seekTo(position - 30)}
		>
			<MaterialCommunityIcons
				name='rewind-30'
				size={iconSize}
				color={colors.icon}
			/>
		</TouchableOpacity>
	);
};

export const SeekForwardButton = ({ iconSize = 30 }: PlayerButtonProps) => {
	const { position } = useProgress();

	return (
		<TouchableOpacity
			activeOpacity={0.7}
			onPress={() => TrackPlayer.seekTo(position + 30)}
		>
			<MaterialCommunityIcons
				name='fast-forward-30'
				size={iconSize}
				color={colors.icon}
			/>
		</TouchableOpacity>
	);
};

export const SkipToPreviousButton = ({ iconSize = 30 }: PlayerButtonProps) => {
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
