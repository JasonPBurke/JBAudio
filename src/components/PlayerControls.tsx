import { TouchableOpacity, View, ViewStyle } from 'react-native';
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

type PlayerControlsProps = {
	style?: ViewStyle;
};

type PlayerButtonProps = {
	style?: ViewStyle;
	iconSize?: number;
};

export const PlayPauseButton = ({ style, iconSize }: PlayerButtonProps) => {
	const { playing } = useIsPlaying();

	return (
		<View style={[{ height: iconSize }, style]}>
			<TouchableOpacity
				activeOpacity={0.85}
				onPress={() => (playing ? TrackPlayer.pause() : TrackPlayer.play())}
			>
				<FontAwesome5
					name={playing ? 'pause-circle' : 'play-circle'}
					size={iconSize}
					color={colors.icon}
				/>
			</TouchableOpacity>
		</View>
	);
};

//TODO <SeekBackButton/> subtract (30) seconds from current timestamp

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
