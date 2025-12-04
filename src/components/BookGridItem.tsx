import { unknownBookImageUri } from '@/constants/images';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  Dimensions,
} from 'react-native';
import { memo } from 'react';
import { Image } from 'expo-image';

import { colors, fontSize } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import LoaderKitView from 'react-native-loader-kit';
import TrackPlayer, {
  Track,
  useActiveTrack,
  useIsPlaying,
} from 'react-native-track-player';

import { Book as BookType } from '@/types/Book';
import Book from '@/db/models/Book';

import { Play } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useQueueStore } from '@/store/queue';
import database from '@/db';
import { getChapterProgressInDB } from '@/db/chapterQueries';
import { handleBookPlay } from '@/helpers/handleBookPlay';

export type BookListItemProps = {
  book: BookType;
  flowDirection: 'row' | 'column';
  numColumns?: number;
};

export const BookGridItem = memo(function BookListItem({
  book,
  flowDirection,
  numColumns = 0,
}: BookListItemProps) {
  const router = useRouter();
  const { playing } = useIsPlaying();

  const { setActiveBookId, activeBookId } = useQueueStore();
  const isActiveBook = useActiveTrack()?.bookId === book.bookId;

  const { width: screenWidth } = Dimensions.get('window');

  const ITEM_MARGIN_HORIZONTAL = 10;
  const NUM_COLUMNS = numColumns;

  const ITEM_WIDTH_COLUMN =
    (screenWidth - ITEM_MARGIN_HORIZONTAL * (NUM_COLUMNS + 1)) /
    NUM_COLUMNS;

  const handlePressPlay = async (book: BookType | undefined) => {
    if (!book) return;
    if (isActiveBook && playing) return;

    const progressInfo = await getChapterProgressInDB(book.bookId!);

    if (!progressInfo || progressInfo.chapterIndex === -1) return;

    const isChangingBook = book.bookId !== activeBookId;

    if (isChangingBook) {
      await TrackPlayer.reset();
      const tracks: Track[] = book.chapters.map((chapter) => ({
        url: chapter.url,
        title: chapter.chapterTitle,
        artist: chapter.author,
        artwork: book.artwork ?? unknownBookImageUri,
        album: book.bookTitle,
        bookId: book.bookId,
      }));

      await TrackPlayer.add(tracks);
      await TrackPlayer.skip(progressInfo.chapterIndex);
      await TrackPlayer.seekTo(progressInfo.progress || 0);
      await TrackPlayer.play();
      await TrackPlayer.setVolume(1);

      if (book.bookId) {
        setActiveBookId(book.bookId);
      }
    } else {
      await TrackPlayer.skip(progressInfo.chapterIndex);
      await TrackPlayer.seekTo(progressInfo.progress || 0);
      await TrackPlayer.play();
      await TrackPlayer.setVolume(1);
    }
  };

  const encodedBookId = encodeURIComponent(book.bookId!);
  const encodedAuthor = encodeURIComponent(book.author);
  const encodedBookTitle = encodeURIComponent(book.bookTitle);

  const handlePress = () => {
    router.navigate(
      `/titleDetails?bookId=${encodedBookId}&author=${encodedAuthor}&bookTitle=${encodedBookTitle}`
    );
  };

  return (
    <Pressable
      android_ripple={{
        color: '#cccccc28',
        foreground: false,
      }}
      style={{
        paddingTop: 4,
        alignItems: 'center',
        // elevation: 5,
        marginBottom: 8,
      }}
      onPress={handlePress}
    >
      <View
        style={[
          {
            // borderColor: 'blue',
            // borderWidth: 1,
            alignItems: 'center',
          },
          flowDirection === 'row'
            ? {
                height: 205, //202
                width: book.artworkHeight
                  ? (book.artworkWidth! / book.artworkHeight) * 160
                  : 0,
              }
            : {
                width: ITEM_WIDTH_COLUMN,
                height: book.artworkWidth
                  ? (book.artworkHeight! / book.artworkWidth) *
                      ITEM_WIDTH_COLUMN +
                    75
                  : 0,
              },
        ]}
      >
        <View
          style={[
            flowDirection === 'row'
              ? {
                  height: 140,
                  width: book.artworkHeight
                    ? (book.artworkWidth! / book.artworkHeight) * 140
                    : 0,
                }
              : {
                  paddingTop: 10,
                  width: ITEM_WIDTH_COLUMN + 2,
                  height: book.artworkWidth
                    ? (book.artworkHeight! / book.artworkWidth) *
                        ITEM_WIDTH_COLUMN +
                      12
                    : 0,
                },
          ]}
        >
          <Image
            source={book.artwork ?? unknownBookImageUri}
            style={styles.bookArtworkImage}
            contentFit='contain'
          />
          {isActiveBook && playing ? (
            <View
              style={[
                styles.trackPlayingImageIcon,
                {
                  width:
                    flowDirection === 'row'
                      ? 20
                      : numColumns === 1
                        ? 32
                        : numColumns === 2
                          ? 24
                          : 18,
                  padding:
                    flowDirection === 'row'
                      ? 20
                      : numColumns === 1
                        ? 24
                        : numColumns === 2
                          ? 20
                          : 17,
                  borderRadius: 4,
                  backgroundColor: '#1c1c1c96',
                  justifyContent: 'center',
                  alignItems: 'center',
                },
              ]}
            >
              <LoaderKitView
                style={[
                  // styles.trackPlayingImageIcon,
                  {
                    width:
                      flowDirection === 'row'
                        ? 20
                        : numColumns === 1
                          ? 32
                          : numColumns === 2
                            ? 24
                            : 18,
                    aspectRatio: 1,
                  },
                ]}
                name={'LineScaleParty'}
                color={colors.primary}
              />
            </View>
          ) : (
            <Pressable
              onPress={() =>
                handleBookPlay(
                  book,
                  playing,
                  isActiveBook,
                  activeBookId,
                  setActiveBookId
                )
              }
              style={{
                ...styles.trackPausedIcon,
                padding: 6,
                borderRadius: 4,
                backgroundColor: '#1c1c1c96',
              }}
              hitSlop={25}
            >
              <Play
                size={
                  flowDirection === 'row'
                    ? 20
                    : numColumns === 1
                      ? 36
                      : numColumns === 2
                        ? 28
                        : 22
                } //* 24 is the 3 column size
                color={colors.icon}
                strokeWidth={1}
                absoluteStrokeWidth
              />
            </Pressable>
          )}
        </View>
        <View
          style={{
            ...styles.bookInfoContainer,
            width:
              flowDirection === 'row'
                ? book.artworkHeight
                  ? (book.artworkWidth! / book.artworkHeight) * 150 - 10
                  : 0
                : ITEM_WIDTH_COLUMN,
          }}
        >
          <Text
            numberOfLines={numColumns === 1 ? 1 : 2}
            style={{
              ...styles.bookTitleText,
              color: isActiveBook ? '#ffb406be' : colors.text,
              fontSize:
                flowDirection === 'row'
                  ? fontSize.xs
                  : numColumns === 1
                    ? fontSize.lg
                    : numColumns === 2
                      ? fontSize.sm
                      : 14,
            }}
          >
            {book.bookTitle}
          </Text>

          {book.author && (
            <Text
              numberOfLines={1}
              style={{
                ...styles.bookAuthorText,
                fontSize:
                  flowDirection === 'row'
                    ? 10
                    : numColumns === 1
                      ? fontSize.sm
                      : numColumns === 2
                        ? fontSize.xs
                        : fontSize.xs,
              }}
            >
              {book.author}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  bookArtworkImage: {
    height: '100%',
    width: '100%',
    borderRadius: 3,
  },
  bookInfoContainer: {
    height: 50,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingHorizontal: 4,
  },
  bookTitleText: {
    ...defaultStyles.text,
    fontWeight: '600',
    maxWidth: '100%',
    marginTop: 2,
  },
  bookAuthorText: {
    color: colors.textMuted,
    marginTop: 4,
  },
  trackPlayingImageIcon: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    aspectRatio: 1,
  },
  trackPausedIcon: {
    position: 'absolute',
    bottom: 2,
    right: 2,
  },
});
