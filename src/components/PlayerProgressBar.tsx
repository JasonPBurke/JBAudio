import { StyleSheet, Text, View, ViewProps } from 'react-native';
import { Slider } from 'react-native-awesome-slider';
import { useSharedValue } from 'react-native-reanimated';
import TrackPlayer, { useProgress } from 'react-native-track-player';
import { formatSecondsToMinutes } from '@/helpers/miscellaneous';
import { colors, fontSize } from '@/constants/tokens';
import { defaultStyles, utilsStyles } from '@/styles';

export const PlayerProgressBar = ({ style }: ViewProps) => {
	const { duration, position } = useProgress(250);

	const isSliding = useSharedValue(false);
	const progress = useSharedValue(0);
	const min = useSharedValue(0);
	const max = useSharedValue(1);

	const trackElapsedTime = formatSecondsToMinutes(position);
	const trackRemainingTime = formatSecondsToMinutes(duration - position);

	if (!isSliding.value) {
		progress.value = duration > 0 ? position / duration : 0;
		// progress.set((value) => (value = duration > 0 ? position / duration : 0));
	}

	return (
		<View style={style}>
			<Slider
				progress={progress}
				minimumValue={min}
				maximumValue={max}
				containerStyle={utilsStyles.slider}
				theme={{
					minimumTrackTintColor: colors.minimumTrackTintColor,
					maximumTrackTintColor: colors.maximumTrackTintColor,
					// cacheTrackTintColor: '#333',
				}}
				// thumbTouchSize={15}
				thumbWidth={13}
				renderBubble={() => null}
				onSlidingStart={() => (isSliding.value = true)}
				// onSlidingStart={() => isSliding.set((value) => (value = true))}
				onSlidingComplete={async (value) => {
					if (!isSliding.value) return;
					isSliding.value = false;
					// isSliding.set((value) => (value = false));

					await TrackPlayer.seekTo(value * duration);
				}}
				onValueChange={async (value) => {
					await TrackPlayer.seekTo(value * duration);
				}}
			/>
			<View style={styles.timeRow}>
				<Text style={styles.timeText}>{trackElapsedTime}</Text>
				<Text style={styles.timeText}>
					{'-'} {trackRemainingTime}
				</Text>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	timeRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'baseline',
		marginTop: 10,
	},
	timeText: {
		...defaultStyles.text,
		color: colors.text,
		opacity: 0.75,
		fontSize: fontSize.xs,
		letterSpacing: 0.7,
		fontWeight: '500',
	},
});
