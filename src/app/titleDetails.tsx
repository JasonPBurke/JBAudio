import {
  Text,
  View,
  StyleSheet,
  // useWindowDimensions,
  Pressable,
} from 'react-native';
import { useAuthors, useBook, useBookById } from '@/store/library';
import { useLocalSearchParams, useRouter } from 'expo-router';
// import FastImage from '@d11/react-native-fast-image';
import { Image } from 'expo-image';

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
  // useActiveTrack,
} from 'react-native-track-player';
import { useQueueStore } from '@/store/queue';
import { formatDate } from '@/helpers/miscellaneous';

const TitleDetails = () => {
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
        <View style={styles.bookArtworkContainer}>
          <Image
            contentFit='contain'
            // resizeMode={FastImage.resizeMode.contain}
            source={{
              uri: book?.artwork ?? unknownBookImageUri,
              // priority: FastImage.priority.normal,
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
            <Text>Year:</Text>
            <Text style={styles.bookInfoText}>{book?.metadata.year}</Text>
          </View>
          <View style={styles.inlineInfoContainer}>
            <Text>Description: </Text>
            <Text style={styles.bookInfoText}>
              {book?.metadata.description}
            </Text>
          </View>
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
    gap: 20,
    flex: 1,
    width: '100%',
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  bookArtworkImage: {
    height: '100%',
    width: 'auto',
    borderRadius: 4,
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
    // top: '25%',
    bottom: 0,
    right: 20,
    padding: 10,
    backgroundColor: '#1c1c1c7f',
    borderRadius: 50,
    zIndex: 10,
  },
  divider: {
    width: 1,
    height: '50%',
    // backgroundColor: '#d8dee981',
    alignSelf: 'center',
  },
  inlineInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
});
