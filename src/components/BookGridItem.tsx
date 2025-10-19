import { unknownBookImageUri } from '@/constants/images';
import {
  // Dimensions,
  Pressable,
  StyleSheet,
  Text,
  TouchableHighlight,
  View,
  Image as RNImage,
} from 'react-native';
import { act, memo, useEffect, useState } from 'react';
// import FastImage from '@d11/react-native-fast-image';
import { Image } from 'expo-image';
import { useLibraryStore } from '@/store/library';

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
// import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQueueStore } from '@/store/queue';
import database from '@/db';
import {
  updateChapterProgressInDB,
  getChapterProgressInDB,
} from '@/db/chapterQueries';

export type BookListItemProps = {
  book: BookType;
  bookId: string;
  // flowDirection: 'row' | 'column';
};

export const BookGridItem = memo(function BookListItem({
  book,
  bookId,
}: BookListItemProps) {
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const router = useRouter();
  const { playing } = useIsPlaying();

  const { setActiveBookId, activeBookId } = useQueueStore();
  const isActiveBook =
    useActiveTrack()?.url ===
    book.chapters[book.bookProgress.currentChapterIndex].url;

  const { getPlaybackProgress } = useLibraryStore();

  useEffect(() => {
    RNImage.getSize(book.artwork || unknownBookImageUri, (w, h) => {
      setImageSize({ width: w, height: h });
    });
  }, [book.artwork]);

  // const progress = getPlaybackProgress(book.bookId!);
  // console.log('progress before play', progress);

  const handlePressPlay = async (book: BookType) => {
    // Fetch the latest book data from the database to get the most current chapter index
    const latestBookFromDB = await database
      .get<Book>('books')
      .find(book.bookId!);

    const chapterIndex = latestBookFromDB.currentChapterIndex;
    // const chapterProgress = latestBookFromDB.currentChapterProgress;
    // const chapterProgress = getPlaybackProgress(book.bookId!);
    // console.log('chapterIndex', chapterIndex);
    // console.log('chapterProgress', chapterProgress);
    if (chapterIndex === -1) return;

    const isChangingBook = bookId !== activeBookId;

    //TODO: if book changes, get the previous tracks lastPosition and index and add to books DB
    if (isChangingBook) {
      const activeBookId = await TrackPlayer.getActiveTrack().then(
        (res) => res?.bookId
      );
      const activeChapterPosition = (await TrackPlayer.getProgress())
        .position;
      console.log('activeTrackPosition', activeChapterPosition);
      console.log('activeTrack.bookId', activeBookId);
      if (activeBookId) {
        //TODO: add to DB
        updateChapterProgressInDB(activeBookId, activeChapterPosition);
      }
      await TrackPlayer.reset();
      //! should these tracks be built at the useSEFS.tsx and added to the DB on first scan?
      const tracks: Track[] = book.chapters.map((chapter) => ({
        url: chapter.url,
        title: chapter.chapterTitle,
        artist: chapter.author,
        artwork: book.artwork ?? unknownBookImageUri,
        album: book.bookTitle,
        bookId: book.bookId,
      }));

      const progress = await getChapterProgressInDB(book.bookId!);
      await TrackPlayer.add(tracks);
      await TrackPlayer.skip(chapterIndex);
      await TrackPlayer.seekTo(progress || 0);
      await TrackPlayer.play();
      setActiveBookId(bookId);
    } else {
      await TrackPlayer.skip(chapterIndex);
      // await TrackPlayer.seekTo(chapterProgress || 0); //!should this be here?
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
    <TouchableHighlight onPress={handlePress}>
      <View
        style={[
          {
            height: 250,
            width: imageSize.height
              ? (imageSize.width / imageSize.height) * 150
              : 0,
          },
        ]}
      >
        <View
          style={{
            height: 150,
            width: imageSize.height
              ? (imageSize.width / imageSize.height) * 150
              : 0,
          }}
        >
          <Image
            source={book.artwork ?? unknownBookImageUri}
            style={styles.bookArtworkImage}
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
              onPress={() => handlePressPlay(book)}
              style={{
                ...styles.trackPausedIcon,
                padding: 6,
                borderRadius: 4,
                backgroundColor: '#1c1c1c96',
              }}
              hitSlop={25}
            >
              {/* <Ionicons
                // style={styles.trackPausedIcon}
                name='headset-outline'
                size={18}
                color={colors.icon}
                onPress={() => handlePressPlay(book)}
              /> */}
              <Play
                size={18}
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
            width: imageSize.height
              ? (imageSize.width / imageSize.height) * 150 - 10
              : 0,
          }}
        >
          <Text
            numberOfLines={2}
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
      </View>
    </TouchableHighlight>
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
    paddingLeft: 5,
  },
  bookTitleText: {
    ...defaultStyles.text,
    fontSize: fontSize.xs,
    fontWeight: '600',
    maxWidth: '90%',
    marginTop: 2,
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
