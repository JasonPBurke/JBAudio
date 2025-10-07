import { unknownBookImageUri } from '@/constants/images';
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableHighlight,
  View,
} from 'react-native';
import { memo } from 'react';
// import FastImage from '@d11/react-native-fast-image';
import { Image } from 'expo-image';

import { colors, fontSize } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import LoaderKitView from 'react-native-loader-kit';
import TrackPlayer, {
  Track,
  useActiveTrack,
  useIsPlaying,
} from 'react-native-track-player';
import { Book } from '@/types/Book';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQueueStore } from '@/store/queue';

export type BookListItemProps = {
  book: Book;
  bookId: string;
};

export const BookGridItem = memo(function BookListItem({
  book,
  bookId,
}: BookListItemProps) {
  const isActiveBook =
    useActiveTrack()?.url ===
    book.chapters[book.bookProgress.currentChapterIndex].url;
  const { playing } = useIsPlaying();
  const router = useRouter();
  const { setActiveBookId, activeBookId } = useQueueStore();
  const author = book.author;
  const bookTitle = book.bookTitle;

  const handlePressPlay = async (book: Book) => {
    const chapterIndex = book.bookProgress.currentChapterIndex;
    if (chapterIndex === -1) return;

    const isChangingBook = bookId !== activeBookId;

    if (isChangingBook) {
      await TrackPlayer.reset();
      const tracks: Track[] = book.chapters.map((chapter) => ({
        url: chapter.url,
        title: chapter.chapterTitle,
        artist: chapter.author,
        artwork: book.artwork ?? unknownBookImageUri,
      }));
      await TrackPlayer.add(tracks);
      await TrackPlayer.skip(chapterIndex);
      await TrackPlayer.play();
      setActiveBookId(bookId);
    } else {
      await TrackPlayer.skip(chapterIndex);
      await TrackPlayer.play();
    }
  };

  const encodedBookId = encodeURIComponent(bookId);
  const encodedAuthor = encodeURIComponent(author);
  const encodedBookTitle = encodeURIComponent(bookTitle);

  const handlePress = () => {
    router.navigate(
      `/titleDetails?bookId=${encodedBookId}&author=${encodedAuthor}&bookTitle=${encodedBookTitle}`
    );
  };

  return (
    <TouchableHighlight onPress={handlePress}>
      <View style={[styles.bookItemContainer, { height: 200 }]}>
        <View>
          <Image
            contentFit='contain'
            // resizeMode={FastImage.resizeMode.contain}
            //! JUST PLACE THE ABSOLUTE POSITIONING AT HE BOTTOM LEFT AND PLACE EVERY IMG AT THE BOTTOM LEFT AS WELL
            // source={{
            //   uri: book.artwork ?? unknownBookImageUri,
            //   // priority: FastImage.priority.normal,
            // }}
            source={book.artwork ?? unknownBookImageUri}
            style={{
              ...styles.bookArtworkImage,
              // opacity: isActiveBook ? 0.6 : 1,
            }}
          />
          {isActiveBook && playing ? (
            <LoaderKitView
              style={styles.trackPlayingImageIcon}
              name={'LineScaleParty'}
              color={colors.primary}
            />
          ) : (
            <Pressable hitSlop={15}>
              <Feather
                style={styles.trackPausedIcon}
                name='headphones'
                size={18}
                color={colors.icon}
                onPress={() => handlePressPlay(book)}
              />
            </Pressable>
          )}
        </View>
        <View style={styles.bookInfoContainer}>
          <View style={{ width: '100%' }}>
            <Text
              numberOfLines={1}
              style={{
                ...styles.bookTitleText,
                color: colors.text,
              }}
            >
              {book.bookTitle}
            </Text>

            {book.chapters[0].author && (
              <Text numberOfLines={1} style={styles.bookAuthorText}>
                {book.chapters[0].author}
              </Text>
            )}
          </View>
        </View>
      </View>
    </TouchableHighlight>
  );
});

const styles = StyleSheet.create({
  bookItemContainer: {
    gap: 12,
    maxWidth: 155,
  },
  bookArtworkImage: {
    //* height and width will need to be variable based on the cover img used
    height: 150,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 4,
  },
  bookInfoContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 5,
  },
  bookTitleText: {
    ...defaultStyles.text,
    fontSize: fontSize.xs,
    fontWeight: '600',
    maxWidth: '90%',
  },
  bookAuthorText: {
    ...defaultStyles.text,
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 4,
  },
  trackPlayingImageIcon: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    width: 20,
    height: 20,
  },
  trackPausedIcon: {
    position: 'absolute',
    bottom: 10,
    left: 10,
  },
});
