import {
	StyleSheet,
	TouchableOpacity,
	View,
	Text,
	ViewProps,
} from 'react-native';
import { useActiveTrack } from 'react-native-track-player';
import FastImage from '@d11/react-native-fast-image';
import { unknownBookImageUri } from '@/constants/images';
import { defaultStyles } from '@/styles';
import { PlayPauseButton, SeekBackButton } from '@/components/PlayerControls';
import { useLastActiveTrack } from '@/hooks/useLastActiveTrack';
import { MovingText } from '@/components/MovingText';

export const FloatingPlayer = ({ style }: ViewProps) => {
	const activeBook = useActiveTrack();
	const lastActiveBook = useLastActiveTrack();
	const displayedBook = activeBook ?? lastActiveBook;
	if (!displayedBook) return null;

	return (
		<TouchableOpacity style={[styles.parentContainer, style]}>
			<>
				<FastImage
					source={{
						uri: displayedBook.artwork ?? unknownBookImageUri,
					}}
					style={styles.bookArtworkImage}
				/>

				<View style={styles.bookTitleContainer}>
					{/* <Text numberOfLines={1} style={styles.bookTitle}>
						{displayedBook.title}
					</Text> */}
					<MovingText
						style={styles.bookTitle}
						text={displayedBook.title ?? ''}
						animationThreshold={25}
					/>
					<Text style={styles.bookTimeRemaining}>time remaining</Text>
				</View>
				<View style={styles.bookControlsContainer}>
					<SeekBackButton iconSize={22} />
					<PlayPauseButton iconSize={24} />
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
		marginRight: 16,
		paddingLeft: 16,
	},
});
