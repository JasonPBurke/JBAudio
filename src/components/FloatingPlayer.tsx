import {
	StyleSheet,
	TouchableOpacity,
	View,
	Text,
	ViewProps,
} from 'react-native';
import { useActiveTrack, useProgress } from 'react-native-track-player';
import FastImage from '@d11/react-native-fast-image';
import { unknownBookImageUri } from '@/constants/images';
import { defaultStyles } from '@/styles';
import { PlayPauseButton, SeekBackButton } from '@/components/PlayerControls';
import { useLastActiveTrack } from '@/hooks/useLastActiveTrack';
import { MovingText } from '@/components/MovingText';
import { useRouter } from 'expo-router';
import { formatSecondsToMinutes } from '@/helpers/miscellaneous';

export const FloatingPlayer = ({ style }: ViewProps) => {
	const { duration, position } = useProgress(250);
	const trackRemainingTime = formatSecondsToMinutes(duration - position);

	const router = useRouter();
	const activeBook = useActiveTrack();
	const lastActiveBook = useLastActiveTrack();
	const displayedBook = activeBook ?? lastActiveBook;
	if (!displayedBook) return null;

	const handlePress = () => {
		router.navigate('/player');
	};

	return (
		<TouchableOpacity
			onPress={handlePress}
			style={[styles.parentContainer, style]}
		>
			<>
				<FastImage
					source={{
						uri: displayedBook.artwork ?? unknownBookImageUri,
					}}
					style={styles.bookArtworkImage}
				/>

				<View style={styles.bookTitleContainer}>
					<MovingText
						style={styles.bookTitle}
						text={displayedBook.title ?? ''}
						animationThreshold={25}
					/>
					<Text style={styles.bookTimeRemaining}>
						{trackRemainingTime} left
					</Text>
				</View>
				<View style={styles.bookControlsContainer}>
					<SeekBackButton iconSize={24} />
					<PlayPauseButton iconSize={32} />
				</View>
			</>
		</TouchableOpacity>
	);
};

const styles = StyleSheet.create({
	parentContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#1f2226ff', // 3B4252
		padding: 8,
		borderRadius: 12,
	},
	bookArtworkImage: {
		width: 50,
		height: 50,
		// aspectRatio: 0.75,
		borderRadius: 8,
	},
	bookTitleContainer: {
		flex: 1,
		overflow: 'hidden',
		marginLeft: 10,
	},
	bookTitle: {
		...defaultStyles.text,
		fontSize: 18,
		fontWeight: '600',
		paddingLeft: 10,
	},
	bookTimeRemaining: {
		...defaultStyles.text,
		fontSize: 12,
		fontWeight: '400',
		paddingLeft: 10,
	},
	bookControlsContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		columnGap: 20,
		marginRight: 8,
		paddingLeft: 16,
	},
});
