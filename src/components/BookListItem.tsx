import { unknownBookImageUri } from '@/constants/images';
import { StyleSheet, Text, TouchableHighlight, View } from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { colors, fontSize } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import { Track } from 'react-native-track-player';

export type BookListItemProps = {
	book: Track;
};

export const BookListItem = ({ book }: BookListItemProps) => {
	const isActiveBook = false;

	return (
		<TouchableHighlight>
			<View style={styles.bookItemContainer}>
				<View>
					<FastImage
						source={{
							uri: book.artwork ?? unknownBookImageUri,
							priority: FastImage.priority.normal,
						}}
						style={{
							...styles.bookArtworkImage,
							opacity: isActiveBook ? 0.6 : 1,
						}}
					/>
				</View>

				<View style={{ width: '100%' }}>
					<Text
						numberOfLines={1}
						style={{
							...styles.bookTitleText,
							color: isActiveBook ? colors.primary : colors.text,
						}}
					>
						{book.title}
					</Text>

					{book.author && (
						<Text numberOfLines={1} style={styles.bookAuthorText}>
							{book.author}
						</Text>
					)}
				</View>
			</View>
		</TouchableHighlight>
	);
};

const styles = StyleSheet.create({
	bookItemContainer: {
		flexDirection: 'row',
		columnGap: 14,
		alignItems: 'center',
		paddingRight: 20,
		// marginBottom: 12,
	},
	bookArtworkImage: {
		borderRadius: 4,
		//* height and width will need to be variable based on the cover img used
		height: 75,
		// width: 55,
		aspectRatio: 0.75,
		objectFit: 'contain',
	},
	bookTitleText: {
		...defaultStyles.text,
		fontSize: fontSize.sm,
		fontWeight: '600',
		maxWidth: '90%',
	},
	bookAuthorText: {
		...defaultStyles.text,
		color: colors.textMuted,
		fontSize: 14,
		marginTop: 4,
	},
});
