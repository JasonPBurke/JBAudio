import {
  Text,
  View,
  StyleSheet,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { useBookById } from '@/store/library';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { unknownBookImageUri } from '@/constants/images';
import { colors, fontSize } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import { LinearGradient } from 'expo-linear-gradient';
import { Play, Pause } from 'lucide-react-native';
import TrackPlayer, {
  useActiveTrack,
  useIsPlaying,
} from 'react-native-track-player';
import { useQueueStore } from '@/store/queue';
import { formatSecondsToMinutes } from '@/helpers/miscellaneous';
import TruncatedParagraph from '@/components/TruncatedParagraph';
// import { ChapterList } from '@/components/ChapterList';
import { useMemo, useState } from 'react';
import {
  handleBookPlay,
  BookProgressState,
} from '@/helpers/handleBookPlay';
import { ShadowedView, shadowStyle } from 'react-native-fast-shadow';
import { ScrollView } from 'react-native-gesture-handler';
import { Clock8, Calendar, Book } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TitleDetails = () => {
  const { top, bottom } = useSafeAreaInsets();
  const { setActiveBookId, activeBookId } = useQueueStore();
  const { bookId } = useLocalSearchParams<{
    bookId: string;
  }>();

  const book = useBookById(bookId);
  const [isLoading, setIsLoading] = useState(false);
  const [showLoading, setShowLoading] = useState(false);

  const { playing } = useIsPlaying();
  const isActiveBook =
    useActiveTrack()?.url ===
    book.chapters[book.bookProgress.currentChapterIndex].url;

  const isBookStarted =
    book.bookProgressValue !== BookProgressState.NotStarted;
  const isPlayingBook = isActiveBook && playing;

  const imgHeight = book.artworkHeight;
  const imgWidth = book.artworkWidth;

  const gradientColors = useMemo(
    () =>
      book.artworkColors
        ? ([
            book.artworkColors.darkVibrant as string,
            book.artworkColors.lightVibrant as string,
            book.artworkColors.vibrant as string,
            book.artworkColors.darkMuted as string,
          ] as const)
        : ([
            colors.background,
            colors.primary,
            colors.primary,
            colors.background,
          ] as const),
    [book.artworkColors]
  );

  let genres: string[] = [];
  if (book.metadata.genre) {
    genres = book.metadata.genre
      .split(/[,/&]\s*/)
      .map((item: string) => item.trim());
  }

  return (
    <LinearGradient
      start={{ x: 0, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      // locations={[0.15, 0.2, 0.65, 0.8]}
      locations={[0.15, 0.35, 0.45, 0.6]}
      style={{ flex: 1 }}
      colors={gradientColors}
    >
      <View style={styles.bookContainer}>
        <Pressable
          hitSlop={10}
          style={styles.dismissIndicator}
          onPress={() => router.back()}
        />
        {/* <DismissIndicator /> */}
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
              opacity: 0.5,
              radius: 12,
              offset: [5, 3],
            })}
          >
            <Image
              contentFit='contain'
              source={{
                uri: book.artwork ?? unknownBookImageUri,
              }}
              style={styles.bookArtworkImage}
            />
          </ShadowedView>
        </View>
        <ScrollView
          style={styles.bookInfoContainer}
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onLongPress={() =>
              router.push(`./editTitleDetails?bookId=${bookId}`)
            }
            style={[styles.bookInfoContainer]}
          >
            <Text style={styles.bookTitleText}>{book.bookTitle}</Text>

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
                    color: book.artworkColors.muted || colors.textMuted,
                  }}
                >
                  Author
                </Text>
                <Text
                  numberOfLines={3}
                  style={{ ...styles.bookInfoText, textAlign: 'center' }}
                >
                  {book.author}
                </Text>
              </View>
              <View
                style={{
                  ...styles.divider,
                  backgroundColor:
                    book.artworkColors.muted || colors.textMuted,
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
                    color: book.artworkColors.muted || colors.textMuted,
                  }}
                >
                  Read by
                </Text>
                <Text
                  numberOfLines={3}
                  style={{ ...styles.bookInfoText, textAlign: 'center' }}
                >
                  {book.metadata.narrator}
                </Text>
              </View>
            </View>
            <View
              style={[styles.inlineInfoContainer, { flexWrap: 'wrap' }]}
            >
              {genres.map((genre, index) => (
                <Text
                  key={index}
                  style={[
                    styles.genreText,
                    {
                      backgroundColor:
                        book.artworkColors.darkVibrant ||
                        colors.modalBackground,
                    },
                  ]}
                >
                  {genre}
                </Text>
              ))}
            </View>

            <View style={styles.infoCardContainer}>
              <View style={styles.infoCard}>
                <Clock8 size={24} color={colors.text} strokeWidth={1.5} />

                <Text style={[styles.bookInfoText, { marginTop: 12 }]}>
                  {formatSecondsToMinutes(book.bookDuration || 0)}
                </Text>
                <Text style={styles.listInfoText}>Duration</Text>
              </View>
              <View
                style={{
                  ...styles.divider,
                  backgroundColor:
                    book.artworkColors.muted || colors.textMuted,
                }}
              />
              <View style={styles.infoCard}>
                <Calendar size={24} color={colors.text} strokeWidth={1.5} />
                <Text style={[styles.bookInfoText, { marginTop: 12 }]}>
                  {book.metadata.year}
                </Text>
                <Text style={styles.listInfoText}>Released</Text>
              </View>
              <View
                style={{
                  ...styles.divider,
                  backgroundColor:
                    book.artworkColors.muted || colors.textMuted,
                }}
              />
              <View style={styles.infoCard}>
                <Book size={24} color={colors.text} strokeWidth={1.5} />
                <Text style={[styles.bookInfoText, { marginTop: 12 }]}>
                  {book.metadata.totalTrackCount! > 1
                    ? book.metadata.totalTrackCount
                    : book.chapters.length}
                </Text>
                <Text style={styles.listInfoText}>Chapters</Text>
              </View>
            </View>

            <ShadowedView
              style={shadowStyle({
                opacity: 0.4,
                radius: 8,
                offset: [0, 0],
                color: colors.textMuted,
              })}
            >
              <TouchableOpacity
                activeOpacity={0.9}
                disabled={isLoading}
                onPress={async () => {
                  if (isPlayingBook) {
                    await TrackPlayer.pause();
                  } else {
                    setIsLoading(true);
                    const timer = setTimeout(() => {
                      setShowLoading(true);
                    }, 100);
                    try {
                      await handleBookPlay(
                        book,
                        playing,
                        isActiveBook,
                        activeBookId,
                        setActiveBookId
                      );
                    } finally {
                      clearTimeout(timer);
                      setIsLoading(false);
                      setShowLoading(false);
                    }
                  }
                }}
              >
                <View style={styles.playButton}>
                  {isPlayingBook ? (
                    <Pause
                      size={34}
                      color={colors.text}
                      strokeWidth={1.5}
                      absoluteStrokeWidth
                    />
                  ) : (
                    <Play
                      size={34}
                      color={colors.text}
                      strokeWidth={1.5}
                      absoluteStrokeWidth
                    />
                  )}
                  <Text
                    style={{ color: colors.text, fontSize: fontSize.base }}
                  >
                    {isPlayingBook
                      ? 'Playing'
                      : showLoading
                        ? 'Loading'
                        : isBookStarted
                          ? 'Continue Listening'
                          : 'Start Listening'}
                  </Text>
                </View>
              </TouchableOpacity>
            </ShadowedView>
            <View style={styles.inlineInfoContainer}>
              <TruncatedParagraph
                content={book.metadata.description}
                maxLines={4}
              />
            </View>
            <View
              style={{
                width: '100%',
                flexDirection: 'row',
                borderColor: 'white',
                borderWidth: StyleSheet.hairlineWidth,
              }}
            />
            <View
              style={[
                styles.inlineInfoContainer,
                { justifyContent: 'flex-start' },
              ]}
            >
              <Text
                style={[
                  styles.bookInfoText,
                  {
                    paddingBottom: bottom + 24,
                  },
                ]}
              >
                {book.metadata.copyright}
              </Text>
            </View>
          </Pressable>
        </ScrollView>
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
    paddingHorizontal: 16,
    marginTop: 50,
    width: '100%',
    gap: 12,
  },
  bookInfoContainer: {
    gap: 20,
    flex: 1,
    width: '100%',
    paddingTop: 12,
    paddingHorizontal: 6,
  },
  bookArtworkContainer: {
    height: FIXED_ARTWORK_HEIGHT,
    paddingTop: 12,
    zIndex: 10,
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
  infoCardContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 22,
    borderRadius: 8,
    backgroundColor: colors.modalBackground,
  },
  infoCard: {
    justifyContent: 'center',
    alignItems: 'center',
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
  listInfoText: {
    fontSize: 14,
    color: '#d8dee9ac',
  },
  genreText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.modalBackground,
  },
  trackPlayingImageIcon: {
    position: 'absolute',
    bottom: 0,
    right: 20,
    padding: 10,
    backgroundColor: '#1c1c1c7f',
    borderRadius: 50,
    zIndex: 10,
  },
  playButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    backgroundColor: colors.modalBackground,
    borderRadius: 8,
    width: '100%',
    alignSelf: 'center',
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
    flex: 1,
    margin: 20,
    borderRadius: 12,
    padding: 35,
    alignItems: 'center',
    elevation: 5,
  },
  dismissIndicator: {
    width: 55,
    height: 7,
    backgroundColor: '#1c1c1ca9',
    borderRadius: 50,
    borderColor: colors.textMuted,
    borderWidth: 1,
    justifyContent: 'center',
    alignSelf: 'center',
  },
});
