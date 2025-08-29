import { StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import { useActiveTrack } from 'react-native-track-player';
import FastImage from '@d11/react-native-fast-image';
import { unknownBookImageUri } from '@/constants/images';
import { defaultStyles } from '@/styles';
import { PlayPauseButton, SeekBackButton } from '@/components/PlayerControls';

export const FloatingPlayer = () => {
	const activeBook = useActiveTrack();

	if (!activeBook) return null;

	const displayedBook = activeBook;

	return (
		<TouchableOpacity>
			<>
				<FastImage
					source={{
						uri: displayedBook.artwork ?? unknownBookImageUri,
					}}
					style={styles.bookArtworkImage}
				/>

				<View style={styles.bookTitleContainer}>
					<Text style={styles.bookTitle}>{displayedBook.title}</Text>
				</View>
				<View style={styles.bookControlsContainer}>
					<PlayPauseButton iconSize={24} />
					<SeekBackButton iconSize={22} />
				</View>
			</>
		</TouchableOpacity>
	);
};

const styles = StyleSheet.create({
	bookArtworkImage: {
		width: 40,
		height: 40,
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
	bookControlsContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		columnGap: 20,
		marginRight: 16,
		paddingLeft: 16,
	},
});
