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
import { memo, useRef } from 'react';
import FastImage from '@d11/react-native-fast-image';
import { colors, fontSize } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import TrackPlayer, {
  Track,
  useActiveTrack,
  useIsPlaying,
} from 'react-native-track-player';
import { Book } from '@/types/Book';
import { Entypo, Feather } from '@expo/vector-icons';
import LoaderKitView from 'react-native-loader-kit';
import { useRouter } from 'expo-router';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useQueueStore } from '@/store/queue';

export type BookListItemProps = {
  book: Book;
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

  const handlePress = () => {
    router.navigate(
      `/titleDetails?author=${author}&bookTitle=${bookTitle}&bookId=${bookId}`
    );
  };

  //! for animated list
  // const rStyle = useAnimatedStyle(() => {
  //   const isVisible = Boolean(
  //     viewableItems.value
  //       .filter((item) => item.isViewable)
  //       .find(
  //         (viewableItem) =>
  //           viewableItem.item.chapters[0].url === book.chapters[0].url
  //       )
  //   );

  //   console.log('isVisible', isVisible);

  //   return {
  //     opacity: withTiming(isVisible ? 1 : 0),
  //     transform: [{ scale: withTiming(isVisible ? 1 : 0.8) }],
  //   };
  // }, []);

  // console.log(
  //   'viewableItems',
  //   JSON.stringify(viewableItems.value[0]?.isViewable, null, 2)
  // );

  return (
    <TouchableHighlight onPress={handlePress}>
      <View style={styles.bookItemContainer}>
        <View>
          <FastImage
            resizeMode={FastImage.resizeMode.contain}
            source={{
              uri: book.artwork ?? unknownBookImageUri,
              priority: FastImage.priority.normal,
            }}
            style={{
              ...styles.bookArtworkImage,
              // opacity: isActiveBook ? 0.6 : 1,
            }}
          />
        </View>
        <View style={styles.bookInfoContainer}>
          <View style={{ width: '100%' }}>
            <Text
              numberOfLines={1}
              style={{
                ...styles.bookTitleText,
                color: colors.textMuted,
                // color: isActiveBook ? colors.primary : colors.text,
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
          <View style={{ gap: 18 }}>
            <Pressable style={{ padding: 8 }} hitSlop={10}>
              <Entypo
                name='dots-three-vertical'
                size={18}
                color={colors.icon}
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
                <Feather name='headphones' size={18} color={colors.icon} />
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
    //* height and width will need to be variable based on the cover img used Flex should work here
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
