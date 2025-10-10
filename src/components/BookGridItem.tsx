import { unknownBookImageUri } from '@/constants/images';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  TouchableHighlight,
  View,
  Image as RNImage,
} from 'react-native';
import { memo, useEffect, useState } from 'react';
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
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQueueStore } from '@/store/queue';

export type BookListItemProps = {
  book: Book;
  bookId: string;
  flowDirection: 'row' | 'column';
};

export const BookGridItem = memo(function BookListItem({
  book,
  bookId,
  flowDirection,
}: BookListItemProps) {
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const router = useRouter();
  const { playing } = useIsPlaying();

  const { setActiveBookId, activeBookId } = useQueueStore();
  const isActiveBook =
    useActiveTrack()?.url ===
    book.chapters[book.bookProgress.currentChapterIndex].url;

  useEffect(() => {
    RNImage.getSize(book.artwork || unknownBookImageUri, (w, h) => {
      setImageSize({ width: w, height: h });
    });
  }, [book.artwork]);

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
        album: book.bookTitle,
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
  const encodedAuthor = encodeURIComponent(book.author);
  const encodedBookTitle = encodeURIComponent(book.bookTitle);

  const handlePress = () => {
    router.navigate(
      `/titleDetails?bookId=${encodedBookId}&author=${encodedAuthor}&bookTitle=${encodedBookTitle}`
    );
  };

  return (
    <TouchableHighlight
      style={
        {
          // flex: 1,
          // borderColor: colors.primary,
          // borderWidth: 1,
          // justifyContent: 'flex-start',
          // alignItems: 'flex-start',
        }
      }
      onPress={handlePress}
    >
      <View
        style={[
          {
            height: 250,
            width: imageSize.height
              ? (imageSize.width / imageSize.height) * 150
              : 0,
            // height:
            //   flowDirection === 'row'
            //     ? 250
            //     : imageSize.height
            //       ? (imageSize.height / imageSize.width) * 150 + 55
            //       : 0,
            // width:
            //   flowDirection === 'row'
            //     ? imageSize.height
            //       ? (imageSize.width / imageSize.height) * 150
            //       : 0
            //     : 250,
          },
        ]}
      >
        <View
          style={{
            height: 150,
            width: imageSize.height
              ? (imageSize.width / imageSize.height) * 150
              : 0,
            // height:
            //   flowDirection === 'row'
            //     ? 150
            //     : imageSize.height
            //       ? (imageSize.height / imageSize.width) * 150
            //       : 0,
            // width:
            //   flowDirection === 'row'
            //     ? imageSize.height
            //       ? (imageSize.width / imageSize.height) * 150
            //       : 0
            //     : 125,
          }}
        >
          <Image
            source={book.artwork ?? unknownBookImageUri}
            style={{
              ...styles.bookArtworkImage,
              width: '100%',
              height: '100%',
            }}
            contentFit='contain'
          />
          {isActiveBook && playing ? (
            <LoaderKitView
              style={styles.trackPlayingImageIcon}
              name={'LineScaleParty'}
              color={colors.primary}
            />
          ) : (
            <Pressable
              style={{
                ...styles.trackPausedIcon,
                padding: 6,
                borderRadius: 4,
                backgroundColor: '#1c1c1c96',
              }}
              hitSlop={25}
            >
              <Ionicons
                // style={styles.trackPausedIcon}
                name='headset-outline'
                size={18}
                color={colors.icon}
                onPress={() => handlePressPlay(book)}
              />
            </Pressable>
          )}
        </View>
        <View
          style={{
            ...styles.bookInfoContainer,
            width: imageSize.height
              ? (imageSize.width / imageSize.height) * 150 - 10
              : 0,
            // width:
            //   flowDirection === 'row'
            //     ? imageSize.height
            //       ? (imageSize.width / imageSize.height) * 150
            //       : 0
            //     : 125,
          }}
        >
          <Text
            numberOfLines={2}
            style={{
              ...styles.bookTitleText,
              color: colors.text,
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
      </View>
    </TouchableHighlight>
  );
});

const styles = StyleSheet.create({
  bookArtworkImage: {
    height: '100%',
    width: '100%',
  },
  bookInfoContainer: {
    height: 50,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingLeft: 5,
  },
  bookTitleText: {
    ...defaultStyles.text,
    fontSize: fontSize.xs,
    fontWeight: '600',
    maxWidth: '90%',
    marginTop: 4,
  },
  bookAuthorText: {
    ...defaultStyles.text,
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 4,
  },
  trackPlayingImageIcon: {
    position: 'absolute',
    left: 11,
    bottom: 8,
    width: 20,
    height: 20,
  },
  trackPausedIcon: {
    position: 'absolute',
    bottom: 2,
    left: 2,
  },
});
