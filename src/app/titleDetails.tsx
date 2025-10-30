import {
  Text,
  View,
  StyleSheet,
  // Image as RNImage,
  Pressable,
} from 'react-native';
// import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
// import { BlurView } from 'expo-blur';
import { useBook } from '@/store/library';
import { useBookProgress } from '@/hooks/useBookProgress';
import { useLocalSearchParams, useRouter } from 'expo-router';
// import FastImage from '@d11/react-native-fast-image';
import { Image } from 'expo-image';

import { unknownBookImageUri } from '@/constants/images';
import { colors, fontSize } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import { usePlayerBackground } from '@/hooks/usePlayerBackground';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import TrackPlayer, {
  Track,
  useActiveTrack,
  useIsPlaying,
} from 'react-native-track-player';
import { useQueueStore } from '@/store/queue';
import {
  formatDate,
  formatSecondsToMinutes,
} from '@/helpers/miscellaneous';
import ModalComponent from '@/components/ModalComponent';
import { useState } from 'react';
import { Book as BookType } from '@/types/Book';
import database from '@/db';
import Book from '@/db/models/Book';
import { ShadowedView, shadowStyle } from 'react-native-fast-shadow';

const TitleDetails = () => {
  const [showModal, setShowModal] = useState(false);
  // const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  const router = useRouter();
  const { setActiveBookId, activeBookId } = useQueueStore();
  const { bookId, author, bookTitle } = useLocalSearchParams<{
    author: string;
    bookId: string;
    bookTitle: string;
  }>();

  const book = useBook(author, bookTitle);

  const { playing } = useIsPlaying();
  const isActiveBook =
    useActiveTrack()?.url ===
    book?.chapters[book.bookProgress.currentChapterIndex].url;

  const imgHeight = book?.artworkHeight;
  const imgWidth = book?.artworkWidth;
  const { imageColors } = usePlayerBackground(
    book?.artwork || unknownBookImageUri
  );

  const handlePressPlay = async (book: BookType | undefined) => {
    if (!book) return;
    if (isActiveBook && playing) return;

    // Fetch the latest book data from the database to get the most current chapter index
    const latestBookFromDB = await database.collections
      .get<Book>('books')
      .find(book.bookId!);

    //! update chapterProgress wherever chapterIndex is updated
    const chapterIndex = latestBookFromDB.currentChapterIndex;
    const chapterProgress = latestBookFromDB.currentChapterProgress;
    if (chapterIndex === -1) return;

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
      await TrackPlayer.skip(chapterIndex);
      await TrackPlayer.seekTo(chapterProgress || 0);
      await TrackPlayer.play();
      if (book.bookId) {
        setActiveBookId(book.bookId);
      }
    } else {
      // If the book is not changing, but the chapter index might have,
      // we should still skip to the correct chapter and chapter progress.
      await TrackPlayer.skip(chapterIndex);
      await TrackPlayer.seekTo(chapterProgress || 0);
      await TrackPlayer.play();
    }
  };

  const test = async (book: BookType | undefined) => {
    console.log('Pizza Time!');
  };

  //* LinearGradient imageColors options
  // 	{
  //   "average": "#393734",
  //   "platform": "android",
  //   "dominant": "#001820",
  //   "vibrant": "#E07008",
  //   "darkVibrant": "#001820",
  //   "lightVibrant": "#F8D068",
  //   "muted": "#905058",
  //   "darkMuted": "#302020",
  //   "lightMuted": "#2E3440"
  // }

  return (
    <LinearGradient
      start={{ x: 0, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      // locations={[0.15, 0.2, 0.65, 0.8]}
      locations={[0.15, 0.35, 0.45, 0.6]}
      style={{ flex: 1 }}
      colors={
        imageColors
          ? [
              imageColors.vibrant,
              imageColors.lightVibrant,
              imageColors.darkMuted,
              imageColors.darkVibrant,
            ]
          : [
              colors.primary,
              colors.primary,
              colors.background,
              colors.background,
            ]
      }
    >
      <View style={styles.bookContainer}>
        <Pressable
          style={styles.trackPlayingImageIcon}
          onPress={() => handlePressPlay(book)}
        >
          <Ionicons
            name='headset-outline'
            size={44}
            color={colors.primary}
          />
        </Pressable>
        <Pressable style={styles.testButton} onPress={() => test(book)}>
          <Ionicons name='pizza' size={44} color={colors.primary} />
        </Pressable>

        <Pressable
          hitSlop={10}
          style={styles.backButton}
          onPress={() => router.back()}
        />
        <View
          style={{
            ...styles.bookArtworkContainer,
            width: imgHeight
              ? (imgWidth! / imgHeight) * FIXED_ARTWORK_HEIGHT
              : 0,
          }}
        >
          <ShadowedView
            style={shadowStyle({
              opacity: 0.4,
              radius: 12,
              offset: [5, 3],
            })}
          >
            <Image
              contentFit='contain'
              source={{
                uri: book?.artwork ?? unknownBookImageUri,
              }}
              style={styles.bookArtworkImage}
            />
          </ShadowedView>
        </View>
        <View style={styles.bookInfoContainer}>
          <Pressable
            onLongPress={() => setShowModal(true)}
            style={styles.bookInfoContainer}
          >
            <Text style={styles.bookTitleText}>{bookTitle}</Text>

            <View style={styles.authorNarratorContainer}>
              <View
                style={{
                  alignItems: 'center',
                  flex: 1,
                }}
              >
                <Text
                  style={{
                    ...styles.bookInfoText,
                    color: imageColors?.muted || colors.textMuted,
                  }}
                >
                  Author
                </Text>
                <Text style={styles.bookInfoText}>{author}</Text>
              </View>
              <View
                style={{
                  ...styles.divider,
                  backgroundColor: imageColors?.muted || colors.textMuted,
                }}
              />
              <View
                style={{
                  alignItems: 'center',
                  flex: 1,
                }}
              >
                <Text
                  style={{
                    ...styles.bookInfoText,
                    color: imageColors?.muted || colors.textMuted,
                  }}
                >
                  Narrated by
                </Text>
                <Text style={styles.bookInfoText}>
                  {book?.metadata.narrator}
                </Text>
              </View>
            </View>
            <View style={styles.inlineInfoContainer}>
              <Text style={{ color: colors.text }}>Added on:</Text>
              <Text style={styles.bookInfoText}>
                {formatDate(book?.metadata.ctime)}
              </Text>
            </View>
            <View style={styles.inlineInfoContainer}>
              <Text style={{ color: colors.text }}>Total Audio Files:</Text>
              <Text style={styles.bookInfoText}>
                {book?.metadata.totalTrackCount || book?.chapters.length}
              </Text>
            </View>
            <View style={styles.inlineInfoContainer}>
              <Text style={{ color: colors.text }}>Duration: </Text>
              <Text style={styles.bookInfoText}>
                {formatSecondsToMinutes(book?.bookDuration || 0)}
              </Text>
            </View>
            <View style={styles.inlineInfoContainer}>
              <Text style={{ color: colors.text }}>Release year:</Text>
              <Text style={styles.bookInfoText}>{book?.metadata.year}</Text>
            </View>
            <View style={styles.inlineInfoContainer}>
              <Text style={{ color: colors.text }}>Description: </Text>
              <Text style={styles.bookInfoText}>
                {book?.metadata.description}
              </Text>
            </View>
          </Pressable>

          <ModalComponent
            isVisible={showModal}
            onBackdropPress={() => setShowModal(false)}
            onBackButtonPress={() => setShowModal(false)}
            hideModal={() => setShowModal(false)}
            swipeDirection='up'
            onSwipeComplete={() => setShowModal(false)}
            animationIn='slideInUp'
            animationOut='slideOutDown'
            style={{
              ...styles.metadataModal,
              backgroundColor: '#1C1C1C',
            }}
          >
            <Text>build out edit metadata screen here</Text>
          </ModalComponent>
        </View>
      </View>
    </LinearGradient>
  );
};

export default TitleDetails;

const FIXED_ARTWORK_HEIGHT = 350;

const styles = StyleSheet.create({
  bookContainer: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginVertical: 50,
    width: '100%',
    gap: 12,
  },
  bookInfoContainer: {
    gap: 20,
    flex: 1,
    width: '100%',
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  bookArtworkContainer: {
    // flex: 1,
    height: FIXED_ARTWORK_HEIGHT,
    paddingTop: 5,
    marginBottom: 32,
  },
  bookArtworkImage: {
    height: FIXED_ARTWORK_HEIGHT,
    width: '100%',
    borderRadius: 8,
  },
  authorNarratorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 10,
  },
  bookTitleText: {
    ...defaultStyles.text,
    fontSize: 21,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 26,
  },
  bookInfoText: {
    ...defaultStyles.text,
    fontSize: fontSize.sm,
  },
  backButton: {
    width: 55,
    height: 7,
    backgroundColor: '#1c1c1ca9',
    borderRadius: 50,
    borderColor: colors.textMuted,
    borderWidth: 1,
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  trackPlayingImageIcon: {
    position: 'absolute',
    // top: '25%',
    bottom: 0,
    right: 20,
    padding: 10,
    backgroundColor: '#1c1c1c7f',
    borderRadius: 50,
    zIndex: 10,
  },
  testButton: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    padding: 10,
    backgroundColor: '#1c1c1c7f',
    borderRadius: 50,
    zIndex: 10,
  },
  divider: {
    width: 1,
    height: '50%',
    alignSelf: 'center',
  },
  inlineInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  metadataModal: {
    flex: 1 / 3,
    margin: 20,
    borderRadius: 12,
    padding: 35,
    alignItems: 'center',
    elevation: 5,
  },
});
