import {
  Text,
  View,
  StyleSheet,
  // useWindowDimensions,
  Pressable,
} from 'react-native';
import { useBook } from '@/store/library';
import { useLocalSearchParams, useRouter } from 'expo-router';
import FastImage from '@d11/react-native-fast-image';
import { unknownBookImageUri } from '@/constants/images';
import { colors, fontSize } from '@/constants/tokens';
import { Feather } from '@expo/vector-icons';
import { defaultStyles } from '@/styles';
import { usePlayerBackground } from '@/hooks/usePlayerBackground';
import { LinearGradient } from 'expo-linear-gradient';
// import { Play } from 'lucide-react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Book } from '@/types/Book';
import TrackPlayer, {
  Track,
  useActiveTrack,
} from 'react-native-track-player';
import { useQueueStore } from '@/store/queue';

const TitleDetails = () => {
  const router = useRouter();
  // const { width, height } = useWindowDimensions();
  const { setActiveBookId, activeBookId } = useQueueStore();
  const { author, bookTitle, bookId } = useLocalSearchParams<{
    author: string;
    bookTitle: string;
    bookId: string;
  }>();

  const book = useBook(author, bookTitle);
  // console.log('book found', JSON.stringify(book, null, 2));

  const { imageColors } = usePlayerBackground(
    book?.artwork || unknownBookImageUri
  );

  const handlePressPlay = async (book: Book | undefined) => {
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
      locations={[0.15, 0.2, 0.65, 0.8]}
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
        <View style={styles.bookArtworkContainer}>
          <FastImage
            resizeMode={FastImage.resizeMode.contain}
            source={{
              uri: book?.artwork || unknownBookImageUri,
              priority: FastImage.priority.normal,
            }}
            style={styles.bookArtworkImage}
          />
          <Pressable
            hitSlop={10}
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Feather
              name='arrow-down-circle'
              // color={colors.icon}
              size={32}
            />
          </Pressable>
        </View>

        <View style={styles.bookInfoContainer}>
          <Text style={styles.bookTitleText}>{bookTitle}</Text>
          <Text style={styles.bookAuthorText}>{author}</Text>
          <Text style={styles.bookAuthorText}>
            {book?.metadata.ctime.toString()}
          </Text>
          <Text style={styles.bookAuthorText}>
            {book?.metadata.narrator}
          </Text>
          <Text style={styles.bookAuthorText}>
            <Text>Total Chapter Files: </Text>
            {book?.chapters.length}
          </Text>
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
  },
  bookInfoContainer: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 20,
  },
  bookArtworkImage: {
    height: '100%',
    width: 'auto',
    borderRadius: 4,
  },
  bookTitleText: {
    ...defaultStyles.text,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  bookAuthorText: {
    ...defaultStyles.text,
    fontSize: fontSize.sm,
  },
  backButton: {
    position: 'absolute',
    top: 6,
    left: 10,
    // padding: 4,
    color: colors.icon,
    borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  trackPlayingImageIcon: {
    position: 'absolute',
    top: '25%',
    padding: 10,
    backgroundColor: '#1c1c1c7f',
    borderRadius: 50,
    zIndex: 10,
  },
  // trackPausedIcon: {
  //   position: 'absolute',
  //   bottom: 10,
  //   left: 10,
  // },
});
