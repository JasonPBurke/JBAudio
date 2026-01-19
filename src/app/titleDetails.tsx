import { useMemo, useState } from 'react';
import {
  Text,
  View,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Play,
  Pause,
  EllipsisVertical,
  Pencil,
  Layers,
} from 'lucide-react-native';
import { ShadowedView, shadowStyle } from 'react-native-fast-shadow';
import { ScrollView } from 'react-native-gesture-handler';
import { Clock8, Calendar, Book } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TrackPlayer, {
  useActiveTrack,
  useIsPlaying,
} from 'react-native-track-player';

import { useBookById, refreshLibraryStore } from '@/store/library';
import { unknownBookImageUri } from '@/constants/images';
import { colors, fontSize } from '@/constants/tokens';
import { useQueueStore } from '@/store/queue';
import { selectGradientColors } from '@/helpers/gradientColorSorter';
import { ensureReadable, withOpacity } from '@/helpers/colorUtils';
import { useTheme } from '@/hooks/useTheme';
import { formatSecondsToMinutes } from '@/helpers/miscellaneous';
import TruncatedParagraph from '@/components/TruncatedParagraph';
import { defaultStyles } from '@/styles';
import {
  handleBookPlay,
  BookProgressState,
} from '@/helpers/handleBookPlay';
import { removeAutoChapters } from '@/helpers/autoChapterGenerator';

const TitleDetails = () => {
  const { top, bottom } = useSafeAreaInsets();
  const { setActiveBookId, activeBookId } = useQueueStore();
  const { bookId, author, bookTitle } = useLocalSearchParams<{
    bookId: string;
    author: string;
    bookTitle: string;
  }>();

  const book = useBookById(bookId);
  const [isLoading, setIsLoading] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const { colors: themeColors } = useTheme();

  const { playing } = useIsPlaying();
  const activeTrack = useActiveTrack();

  if (!book) {
    // Optional: Render a loading state or return null
    return null;
  }

  const isActiveBook = activeTrack?.bookId === book.bookId;

  const isBookStarted =
    book.bookProgressValue !== BookProgressState.NotStarted;
  const isPlayingBook = isActiveBook && playing;

  const imgHeight = book.artworkHeight;
  const imgWidth = book.artworkWidth;

  const gradientColors = useMemo(
    () =>
      selectGradientColors(book.artworkColors, [
        themeColors.background,
        themeColors.primary,
        themeColors.primary,
        themeColors.background,
      ] as const),
    [book.artworkColors, themeColors.background, themeColors.primary],
  );

  // Position 4 color (darkest) - used for contrast checking
  const position4Color = gradientColors[3];

  // Calculate readable label color for Author/ReadBy text
  const labelColor = useMemo(
    () =>
      ensureReadable(
        book.artworkColors?.muted || themeColors.textMuted,
        position4Color,
      ),
    [book.artworkColors, themeColors.textMuted, position4Color],
  );

  const handleChapterPress = () => {
    router.push(`/chapterList?bookId=${bookId}&readOnly=true`);
  };

  const handleEditTitle = () => {
    router.push(`./editTitleDetails?bookId=${bookId}`);
  };

  const handleRemoveAutoChapters = () => {
    setShowMenu(false);
    Alert.alert(
      'Remove Auto-Chapters',
      'This will remove the auto-generated chapters and revert to a single chapter spanning the entire book. Continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeAutoChapters(bookId!);
              await refreshLibraryStore();
              Alert.alert('Success', 'Auto-chapters have been removed.', [
                { text: 'OK' },
              ]);
            } catch (error) {
              Alert.alert(
                'Error',
                'Failed to remove auto-chapters. Please try again.',
                [{ text: 'OK' }],
              );
            }
          },
        },
      ],
    );
  };

  const handleEditPress = () => {
    setShowMenu(false);
    handleEditTitle();
  };

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
        <View style={styles.dismissContainer}>
          <Pressable
            hitSlop={10}
            style={styles.dismissIndicator}
            onPress={() => router.back()}
          />
          <Pressable
            hitSlop={15}
            style={styles.editTitleIcon}
            onPress={() => setShowMenu(true)}
          >
            <EllipsisVertical
              size={24}
              color={themeColors.lightIcon}
              strokeWidth={1.5}
            />
          </Pressable>

          <Modal
            visible={showMenu}
            transparent
            animationType="fade"
            onRequestClose={() => setShowMenu(false)}
          >
            <Pressable
              style={styles.menuOverlay}
              onPress={() => setShowMenu(false)}
            >
              <View style={[styles.menuContainer, { backgroundColor: themeColors.modalBackground }]}>
                <Pressable
                  onPress={handleEditPress}
                  style={[
                    styles.menuItem,
                    { borderBottomColor: themeColors.divider },
                  ]}
                >
                  <Pencil size={20} color={themeColors.text} strokeWidth={1.5} />
                  <Text style={[styles.menuItemText, { color: themeColors.text }]}>
                    Edit Book Details
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleRemoveAutoChapters}
                  disabled={!book.hasAutoGeneratedChapters}
                  style={[
                    styles.menuItem,
                    { opacity: book.hasAutoGeneratedChapters ? 1 : 0.4 },
                  ]}
                >
                  <Layers size={20} color={themeColors.text} strokeWidth={1.5} />
                  <Text style={[styles.menuItemText, { color: themeColors.text }]}>
                    Remove Auto-Chapters
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Modal>
        </View>
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
            onLongPress={handleEditTitle}
            style={[styles.bookInfoContainer]}
          >
            <Text
              style={[
                styles.bookTitleText,
                { color: themeColors.lightText },
              ]}
            >
              {book.bookTitle ?? bookTitle}
            </Text>

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
                    color: labelColor,
                  }}
                >
                  Author
                </Text>
                <Text
                  numberOfLines={3}
                  style={{
                    ...styles.bookInfoText,
                    textAlign: 'center',
                    color: themeColors.lightText,
                  }}
                >
                  {book.author ?? author}
                </Text>
              </View>
              <View
                style={{
                  ...styles.divider,
                  backgroundColor: labelColor,
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
                    color: labelColor,
                  }}
                >
                  Read by
                </Text>
                <Text
                  numberOfLines={3}
                  style={{
                    ...styles.bookInfoText,
                    textAlign: 'center',
                    color: themeColors.lightText,
                  }}
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
                        book.artworkColors?.darkVibrant ||
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

                <Text
                  style={[
                    styles.bookInfoText,
                    { marginTop: 12, color: themeColors.lightText },
                  ]}
                >
                  {formatSecondsToMinutes(book.bookDuration || 0)}
                </Text>
                <Text style={styles.listInfoText}>Duration</Text>
              </View>
              <View
                style={{
                  ...styles.divider,
                  backgroundColor: labelColor,
                }}
              />
              <View style={styles.infoCard}>
                <Calendar size={24} color={colors.text} strokeWidth={1.5} />
                <Text
                  style={[
                    styles.bookInfoText,
                    { marginTop: 12, color: themeColors.lightText },
                  ]}
                >
                  {book.metadata.year}
                </Text>
                <Text style={styles.listInfoText}>Released</Text>
              </View>
              <View
                style={{
                  ...styles.divider,
                  backgroundColor: labelColor,
                }}
              />
              <Pressable
                onPress={handleChapterPress}
                style={styles.infoCard}
              >
                <Book size={24} color={colors.text} strokeWidth={1.5} />
                <Text
                  style={[
                    styles.bookInfoText,
                    { marginTop: 12, color: themeColors.lightText },
                  ]}
                >
                  {book.metadata.totalTrackCount! > 1
                    ? book.metadata.totalTrackCount
                    : book.chapters.length}
                </Text>
                <Text style={styles.listInfoText}>Chapters</Text>
              </Pressable>
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
                        setActiveBookId,
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
                    color: themeColors.lightText,
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
    // ...defaultStyles.text,
    fontSize: 21,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 26,
  },
  bookInfoText: {
    // ...defaultStyles.text,
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
    backgroundColor: withOpacity(colors.background, 0.5),
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
  dismissContainer: {
    position: 'relative',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editTitleIcon: {
    position: 'absolute',
    right: 0,
  },
  dismissIndicator: {
    width: 55,
    height: 7,
    backgroundColor: withOpacity(colors.background, 0.66),
    borderRadius: 50,
    borderColor: colors.textMuted,
    borderWidth: 1,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 90,
    paddingRight: 20,
  },
  menuContainer: {
    borderRadius: 8,
    minWidth: 200,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  menuItemText: {
    fontSize: 16,
  },
});
