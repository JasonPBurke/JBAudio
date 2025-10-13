import {
  Text,
  View,
  StyleSheet,
  // useWindowDimensions,
  Pressable,
} from 'react-native';
// import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
// import { BlurView } from 'expo-blur';
import { useBook } from '@/store/library';
import { useLocalSearchParams, useRouter } from 'expo-router';
// import FastImage from '@d11/react-native-fast-image';
import { Image } from 'expo-image';

import { unknownBookImageUri } from '@/constants/images';
import { colors, fontSize } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import { usePlayerBackground } from '@/hooks/usePlayerBackground';
import { LinearGradient } from 'expo-linear-gradient';
// import { Play } from 'lucide-react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import TrackPlayer, {
  Track,
  // useActiveTrack,
} from 'react-native-track-player';
import { useQueueStore } from '@/store/queue';
import { formatDate } from '@/helpers/miscellaneous';
import ModalComponent from '@/components/ModalComponent';
import { useState } from 'react';

import database from '@/db';
import Book from '@/db/models/Book';
import { Book as BookType } from '@/types/Book';

const TitleDetails = () => {
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();
  // const { width, height } = useWindowDimensions();
  const { setActiveBookId, activeBookId } = useQueueStore();
  const { bookId, author, bookTitle } = useLocalSearchParams<{
    author: string;
    bookId: string;
    bookTitle: string;
  }>();

  const book = useBook(author, bookTitle);

  const { imageColors } = usePlayerBackground(
    book?.artwork || unknownBookImageUri
  );

  const handlePressPlay = async (book: BookType | undefined) => {
    if (!book) return;
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
      // await TrackPlayer.skip(chapterIndex);
      await TrackPlayer.play();
    }
  };

  const test = async (book: BookType | undefined) => {
    const booksCollection = database.get<Book>('books');

    const books = await booksCollection.query().fetch();
    console.log('books', books);
    // await booksCollection.destroyPermanently();
    // await database.write(async () => {
    //   await booksCollection.create((item) => {
    //     item.title = book?.bookTitle || '';
    //     item.artwork = book?.artwork || '';
    //     item.year = book?.metadata.year || 0;
    //     item.description = book?.metadata.description || '';
    //     item.narrator = book?.metadata.narrator || '';
    //     item.genre = book?.metadata.genre || '';
    //     item.sampleRate = book?.metadata.sampleRate || 0;
    // item.totalTrackCount = book?.metadata.totalTrackCount || book?.chapters.length || 0;
    //     item.currentChapterIndex =
    //       book?.bookProgress.currentChapterIndex || 0;
    //     item.currentChapterProgress =
    //       book?.bookProgress.currentChapterProgress || 0;
    //   });
    // });
    // console.log('booksCollection', booksCollection);
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
        <View style={styles.bookArtworkContainer}>
          <Pressable
            hitSlop={10}
            style={styles.backButton}
            onPress={() => router.back()}
          />
          <Image
            contentFit='contain'
            source={{
              uri: book?.artwork ?? unknownBookImageUri,
              // priority: FastImage.priority.normal,
            }}
            // resizeMode={FastImage.resizeMode.contain}
            style={styles.bookArtworkImage}
          />
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
              <Text>Added on:</Text>
              <Text style={styles.bookInfoText}>
                {formatDate(book?.metadata.ctime)}
              </Text>
            </View>
            <View style={styles.inlineInfoContainer}>
              <Text>Total Audio Files:</Text>
              <Text style={styles.bookInfoText}>
                {book?.metadata.totalTrackCount || book?.chapters.length}
              </Text>
            </View>
            <View>
              <Text>Duration: </Text>
            </View>
            <View style={styles.inlineInfoContainer}>
              <Text>Release year:</Text>
              <Text style={styles.bookInfoText}>{book?.metadata.year}</Text>
            </View>
            <View style={styles.inlineInfoContainer}>
              <Text>Description: </Text>
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
  bookArtworkContainer: {
    width: '90%',
    height: '60%',
    paddingTop: 5,
    flex: 1,
    marginBottom: 32,
    // justifyContent: 'flex-start',
    // alignItems: 'flex-start',
  },
  bookInfoContainer: {
    gap: 20,
    flex: 1,
    width: '100%',
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  bookArtworkImage: {
    height: '100%',
    width: 'auto',
    borderRadius: 6,
  },
  authorNarratorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 10,
  },
  bookTitleText: {
    ...defaultStyles.text,
    fontSize: fontSize.lg,
    fontWeight: '600',
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

    // position: 'absolute',
    // top: 6,
    // left: 10,
    // padding: 4,
    // color: colors.icon,
    // borderRadius: 50,
    // backgroundColor: 'rgba(0,0,0,0.35)',
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
    // top: '25%',
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
    // backgroundColor: 'white',
    borderRadius: 12,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});
