import { unknownBookImageUri } from '@/constants/images';
import {
  Pressable,
  StyleSheet,
  Text,
  Touchable,
  TouchableHighlight,
  View,
  ViewToken,
} from 'react-native';
import { memo } from 'react';
// import FastImage from '@d11/react-native-fast-image';
import { Image } from 'expo-image';

import { colors, fontSize } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import TrackPlayer, {
  Track,
  useActiveTrack,
  useIsPlaying,
} from 'react-native-track-player';
import { Book as BookType } from '@/types/Book';
import Book from '@/db/models/Book';

import { Play } from 'lucide-react-native';
// import { Ionicons } from '@expo/vector-icons';
import LoaderKitView from 'react-native-loader-kit';
import { useRouter } from 'expo-router';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useQueueStore } from '@/store/queue';
import { EllipsisVertical } from 'lucide-react-native';
import database from '@/db';

export type BookListItemProps = {
  book: BookType;
  bookId: string;
  viewableItems: SharedValue<ViewToken[]>;
};

export const BookListItem = memo(function BookListItem({
  book,
  bookId,
  viewableItems,
}: BookListItemProps) {
  const isActiveBook =
    useActiveTrack()?.url ===
    book.chapters[book.bookProgress.currentChapterIndex].url;
  const { playing } = useIsPlaying();
  const router = useRouter();
  const author = book.author;
  const bookTitle = book.bookTitle;
  const { setActiveBookId, activeBookId } = useQueueStore();

  const handlePressPlay = async (book: BookType) => {
    // Fetch the latest book data from the database to get the most current chapter index
    const latestBookFromDB = await database.collections
      .get<Book>('books')
      .find(book.bookId!);

    const chapterIndex = latestBookFromDB.currentChapterIndex;
    const chapterProgress = latestBookFromDB.currentChapterProgress;

    if (chapterIndex === -1) return;

    const isChangingBook = bookId !== activeBookId;

    if (isChangingBook) {
      await TrackPlayer.reset();
      const tracks: Track[] = book.chapters.map((chapter) => ({
        url: chapter.url,
        title: chapter.chapterTitle,
        artist: chapter.author,
        artwork: book.artwork ?? unknownBookImageUri,
        album: book.bookTitle,
      }));
      await TrackPlayer.add(tracks);
      await TrackPlayer.skip(chapterIndex);
      await TrackPlayer.seekTo(chapterProgress || 0);
      await TrackPlayer.play();
      setActiveBookId(bookId);
    } else {
      await TrackPlayer.skip(chapterIndex);
      await TrackPlayer.seekTo(chapterProgress || 0);
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
      <View style={styles.bookItemContainer}>
        <View>
          <Image
            contentFit='contain'
            // resizeMode={FastImage.resizeMode.contain}
            source={{
              uri: book.artwork ?? unknownBookImageUri,
              // priority: FastImage.priority.normal,
            }}
            style={{
              ...styles.bookArtworkImage,
            }}
          />
        </View>
        <View style={styles.bookInfoContainer}>
          <View style={{ width: '100%' }}>
            <Text
              numberOfLines={1}
              style={{
                ...styles.bookTitleText,
                color: isActiveBook ? '#ffb406be' : colors.text,
              }}
            >
              {book.bookTitle}
            </Text>

            {book.author && (
              <Text numberOfLines={1} style={styles.bookAuthorText}>
                {book.author}
              </Text>
            )}
          </View>
          <View style={{ gap: 8 }}>
            <Pressable style={{ padding: 8 }} hitSlop={10}>
              <EllipsisVertical
                size={18}
                color={colors.icon}
                strokeWidth={1}
                absoluteStrokeWidth
              />
            </Pressable>
            {isActiveBook && playing ? (
              <View style={{ padding: 8 }}>
                <LoaderKitView
                  style={styles.trackPlayingImageIcon}
                  name={'LineScaleParty'}
                  color={colors.primary}
                />
              </View>
            ) : (
              <Pressable
                onPress={() => handlePressPlay(book)}
                style={{ padding: 8 }}
                hitSlop={10}
              >
                {/* <Ionicons
                  name='headset-outline'
                  size={18}
                  color={colors.icon}
                /> */}
                <Play
                  onPress={() => handlePressPlay(book)}
                  size={18}
                  color={colors.textMuted}
                  strokeWidth={1}
                  absoluteStrokeWidth
                />
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </TouchableHighlight>
  );
});

const styles = StyleSheet.create({
  bookItemContainer: {
    flexDirection: 'row',
    columnGap: 14,
    alignItems: 'center',
    paddingRight: 36,
  },
  bookArtworkImage: {
    borderRadius: 4,
    height: 80,
    aspectRatio: 0.75,
  },
  bookInfoContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  // trackPlayingImageIcon: {
  // 	position: 'absolute',
  // 	left: 20,
  // 	top: 30,
  // 	width: 20,
  // 	height: 20,
  // },
  trackPlayingImageIcon: {
    padding: 8,
    width: 20,
    height: 20,
  },
});
