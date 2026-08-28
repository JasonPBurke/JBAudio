import { useEffect, useMemo, useState } from 'react';
import {
  Text,
  View,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  Alert,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import FastImage from '@d11/react-native-fast-image';
import * as Haptics from 'expo-haptics';
import {
  Play,
  Pause,
  EllipsisVertical,
  Pencil,
  // §F10 — `Layers` was doing double duty: it is the library's Series view
  // toggle AND was `Remove Auto-Chapters`' glyph, which would have put two
  // identical icons on adjacent rows here. Driver's ruling: series keeps
  // `Layers`, auto-chapters moves to `TableOfContents`. It looks like harness
  // fallout and is not.
  Layers,
  TableOfContents,
  ChevronRight,
  BookCheck,
} from 'lucide-react-native';
import { ShadowedView, shadowStyle } from 'react-native-fast-shadow';
import { ScrollView } from 'react-native-gesture-handler';
import { Clock8, Calendar, Book } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { getActiveBookId, pause } from '@/player/trackPlayer';

import BookSeriesLine from '@/components/BookSeriesLine';
import AddToSeriesPanel from '@/components/AddToSeriesPanel';
import { useBookById, refreshLibraryStore } from '@/store/library';
import { unknownBookImageUri } from '@/constants/images';
import { colors, fontSize } from '@/constants/tokens';
import { useQueueStore } from '@/store/queue';
import {
  useActiveBookId,
  useIsPlayerPlaying,
} from '@/store/playerState';
import { selectGradientColors } from '@/helpers/gradientColorSorter';
import { ensureReadable, withOpacity } from '@/helpers/colorUtils';
import { useTheme } from '@/hooks/useTheme';
import { useRerenderOnChapterTurn } from '@/hooks/useRerenderOnChapterTurn';
import { formatSecondsToMinutes } from '@/helpers/miscellaneous';
import { BookDurationRow } from '@/components/BookDurationRow';
import {
  handleBookPlay,
  BookProgressState,
} from '@/helpers/handleBookPlay';
import { removeAutoChapters } from '@/helpers/autoChapterGenerator';
import { recordFootprint } from '@/db/footprintQueries';
import { getBookById, stampLastPlayed } from '@/db/bookQueries';
import MeshGradientBackground from '@/components/MeshGradientBackground';
import { computeDetailsArtworkSize } from '@/helpers/artworkSizing';
import { consumeTitleDetailsNavIntent } from '@/store/titleDetailsNavIntent';

const TitleDetails = () => {
  const { top, bottom } = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } =
    useWindowDimensions();
  const { setRequestedBookId, requestedBookId } = useQueueStore();
  const { bookId, author, bookTitle } = useLocalSearchParams<{
    bookId: string;
    author: string;
    bookTitle: string;
  }>();

  const book = useBookById(bookId);

  // The progress capsule and "N h M m left" beside the play button come from
  // `BookDurationRow`, which reads live progress UNSUBSCRIBED and so refreshes
  // only when this screen re-renders. Nothing else here re-renders at a chapter
  // turn — see the hook for the full account, and for ticket 03 row 4.
  useRerenderOnChapterTurn(bookId);

  const [isLoading, setIsLoading] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  // §F8's picker is a second CONTENT for the one modal below, never a second
  // modal — see AddToSeriesPanel's header for why.
  const [showAddToSeries, setShowAddToSeries] = useState(false);
  const [showProgressOptions, setShowProgressOptions] = useState(false);
  const progressExpand = useSharedValue(0);

  useEffect(() => {
    progressExpand.value = withTiming(showProgressOptions ? 1 : 0, {
      duration: 250,
    });
  }, [showProgressOptions, progressExpand]);

  const progressMenuStyle = useAnimatedStyle(() => ({
    height: progressExpand.value * PROGRESS_MENU_HEIGHT,
    opacity: progressExpand.value,
  }));

  const progressChevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progressExpand.value * 90}deg` }],
  }));

  const { colors: themeColors } = useTheme();

  const playing = useIsPlayerPlaying();
  // The ACTIVE Book -- what the Player reports it has loaded. Distinct from
  // the `requestedBookId` destructured from the queue store above, which is
  // the REQUESTED Book: an intent that leads a switch where this lags it. Both
  // are read on this screen, four lines apart, which is why ticket 11 gave
  // them different names. See CONTEXT.md.
  const activeBookId = useActiveBookId();

  useEffect(() => {
    return () => {
      FastImage.clearMemoryCache();
    };
  }, []);

  // Dismiss a ghost-mount caused by navigation state being restored across
  // an Activity recreation with no user-initiated navigation to
  // /titleDetails. See src/store/titleDetailsNavIntent.ts. Same shape as
  // PlayerScreen's guard in src/app/player.tsx — applied here without a
  // dev-side log-verification step because Metro reloads the dev client
  // on swipe-from-recents, which wipes JS state and masks the bug. Verify
  // in a preview/prod build.
  useEffect(() => {
    if (consumeTitleDetailsNavIntent()) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      router.back();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const gradientColors = useMemo(
    () =>
      selectGradientColors(book?.artworkColors ?? null, [
        themeColors.background,
        themeColors.primary,
        themeColors.primary,
        themeColors.background,
      ] as const),
    [book?.artworkColors, themeColors.background, themeColors.primary],
  );

  // Position 4 color (darkest) - used for contrast checking
  const position4Color = gradientColors[3];

  // Calculate readable label color for Author/ReadBy text
  const labelColor = useMemo(
    () =>
      ensureReadable(
        book?.artworkColors?.muted || themeColors.textMuted,
        position4Color,
      ),
    [book?.artworkColors, themeColors.textMuted, position4Color],
  );

  if (!book) {
    // Optional: Render a loading state or return null
    return null;
  }

  const isActiveBook = activeBookId === book.bookId;

  const isBookStarted =
    book.bookProgressValue !== BookProgressState.NotStarted;
  const isPlayingBook = isActiveBook && playing;

  // Scales with the window instead of a hardcoded dp so the cover doesn't read
  // as a postage stamp on a tablet. Unlike the player this screen scrolls, so
  // the bound is a share of the height rather than the leftover space — see
  // computeDetailsArtworkSize for why the two rules differ.
  const artworkSize = computeDetailsArtworkSize({
    aspectRatio:
      book.artworkHeight && book.artworkWidth
        ? book.artworkWidth / book.artworkHeight
        : 0,
    windowWidth,
    windowHeight,
    horizontalPadding: SCREEN_HORIZONTAL_PADDING,
  });

  const handleChapterPress = () => {
    router.push(`/chapterList?bookId=${bookId}&readOnly=true`);
  };

  const handleEditTitle = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`./editTitleDetails?bookId=${bookId}`);
  };

  const handleRemoveAutoChapters = () => {
    setShowMenu(false);
    setShowProgressOptions(false);
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
    setShowProgressOptions(false);
    handleEditTitle();
  };

  /** Dismisses whichever content the one overflow modal is showing. */
  const closeOverflow = () => {
    setShowMenu(false);
    setShowAddToSeries(false);
    setShowProgressOptions(false);
  };

  const handleAddToSeriesPress = () => {
    // The modal stays mounted throughout — only its content changes.
    setShowMenu(false);
    setShowProgressOptions(false);
    setShowAddToSeries(true);
  };

  const handleProgressChange = async (newProgress: BookProgressState) => {
    setShowMenu(false);
    setShowProgressOptions(false);
    try {
      const bookModel = await getBookById(bookId!);
      if (bookModel) {
        await bookModel.updateBookProgress(newProgress);
        await refreshLibraryStore();
      }
    } catch (error) {
      Alert.alert(
        'Error',
        'Failed to update book progress. Please try again.',
      );
    }
  };

  const handlePlayPress = async () => {
    if (isPlayingBook) {
      await pause();
    } else {
      // Record footprint before playing (only if this is the active book)
      try {
        // Asks the Player directly rather than reading the `activeBookId`
        // mirror in scope above: same question, different freshness. No local
        // for the answer -- the guard proves it equals book.bookId.
        if ((await getActiveBookId()) === book.bookId) {
          await stampLastPlayed(book.bookId);
          await recordFootprint(book.bookId, 'play');
        }
      } catch {
        // Silently fail if footprint recording fails
      }

      setIsLoading(true);
      const timer = setTimeout(() => {
        setShowLoading(true);
      }, 100);
      try {
        await handleBookPlay(
          book,
          playing,
          isActiveBook,
          requestedBookId,
          setRequestedBookId,
        );
      } finally {
        clearTimeout(timer);
        setIsLoading(false);
        setShowLoading(false);
      }
    }
  };

  let genres: string[] = [];
  if (book.metadata.genre) {
    genres = book.metadata.genre
      .split(/[,/&]\s*/)
      .map((item: string) => item.trim());
  }

  return (
    <View style={styles.screenContainer}>
      <MeshGradientBackground
        gradientColors={gradientColors}
        artworkColors={book.artworkColors}
      />
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
            visible={showMenu || showAddToSeries}
            transparent
            animationType='fade'
            onRequestClose={closeOverflow}
          >
            {showAddToSeries ? (
              <AddToSeriesPanel book={book} onClose={closeOverflow} />
            ) : (
            <Pressable
              style={styles.menuOverlay}
              onPress={closeOverflow}
            >
              <View
                style={[
                  styles.menuContainer,
                  { backgroundColor: themeColors.modalBackground },
                ]}
              >
                <Pressable
                  onPress={handleEditPress}
                  style={[
                    styles.menuItem,
                    { borderBottomColor: themeColors.divider },
                  ]}
                >
                  <Pencil
                    size={20}
                    color={themeColors.text}
                    strokeWidth={1.5}
                  />
                  <Text
                    style={[
                      styles.menuItemText,
                      { color: themeColors.text },
                    ]}
                  >
                    Edit Book Details
                  </Text>
                </Pressable>
                {/*
                  * §F8 — directly under `Edit Book Details`, grouping the two
                  * items that act on what the book IS above the two that act
                  * on how it PLAYS. ALWAYS PRESENT: multi-membership means any
                  * book can always join another series, so it has no
                  * inapplicable state and never meets the absent-vs-disabled
                  * convention.
                  */}
                <Pressable
                  onPress={handleAddToSeriesPress}
                  style={[
                    styles.menuItem,
                    { borderBottomColor: themeColors.divider },
                  ]}
                >
                  <Layers
                    size={20}
                    color={themeColors.text}
                    strokeWidth={1.5}
                  />
                  <Text
                    style={[
                      styles.menuItemText,
                      { color: themeColors.text },
                    ]}
                  >
                    Add to series…
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleRemoveAutoChapters}
                  disabled={!book.hasAutoGeneratedChapters}
                  style={[
                    styles.menuItem,
                    {
                      opacity: book.hasAutoGeneratedChapters ? 1 : 0.4,
                      borderBottomColor: themeColors.divider,
                    },
                  ]}
                >
                  <TableOfContents
                    size={20}
                    color={themeColors.text}
                    strokeWidth={1.5}
                  />
                  <Text
                    style={[
                      styles.menuItemText,
                      { color: themeColors.text },
                    ]}
                  >
                    Remove Auto-Chapters
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    setShowProgressOptions(!showProgressOptions)
                  }
                  style={[
                    styles.menuItem,
                    // { borderBottomColor: themeColors.divider },
                  ]}
                >
                  <BookCheck
                    size={20}
                    color={themeColors.text}
                    strokeWidth={1.5}
                  />
                  <Text
                    style={[
                      styles.menuItemText,
                      { color: themeColors.text, flex: 1 },
                    ]}
                  >
                    Mark Book as...
                  </Text>
                  <Animated.View style={progressChevronStyle}>
                    <ChevronRight
                      size={18}
                      color={themeColors.textMuted}
                      strokeWidth={1.5}
                    />
                  </Animated.View>
                </Pressable>
                <Animated.View
                  style={[styles.progressMenuWrapper, progressMenuStyle]}
                >
                  <Pressable
                    onPress={() =>
                      handleProgressChange(BookProgressState.NotStarted)
                    }
                    style={[
                      styles.menuSubItem,
                      book.bookProgressValue ===
                        BookProgressState.NotStarted && {
                        backgroundColor: themeColors.chapterActive,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.menuItemText,
                        { color: themeColors.text },
                      ]}
                    >
                      Unplayed
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      handleProgressChange(BookProgressState.Started)
                    }
                    style={[
                      styles.menuSubItem,
                      book.bookProgressValue ===
                        BookProgressState.Started && {
                        backgroundColor: themeColors.chapterActive,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.menuItemText,
                        { color: themeColors.text },
                      ]}
                    >
                      Playing
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      handleProgressChange(BookProgressState.Finished)
                    }
                    style={[
                      styles.menuSubItem,
                      book.bookProgressValue ===
                        BookProgressState.Finished && {
                        backgroundColor: themeColors.chapterActive,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.menuItemText,
                        { color: themeColors.text },
                      ]}
                    >
                      Finished
                    </Text>
                  </Pressable>
                </Animated.View>
              </View>
            </Pressable>
            )}
          </Modal>
        </View>
        <View
          style={{
            ...styles.bookArtworkContainer,
            width: artworkSize.width,
            height: artworkSize.height,
          }}
        >
          <Pressable onLongPress={handleEditTitle} delayLongPress={400}>
            <ShadowedView
              style={shadowStyle({
                opacity: 0.5,
                radius: 12,
                offset: [5, 3],
              })}
            >
              <FastImage
                source={{
                  uri: book.artwork ?? unknownBookImageUri,
                  priority: FastImage.priority.high,
                  cache: FastImage.cacheControl.immutable,
                }}
                style={{
                  ...styles.bookArtworkImage,
                  height: artworkSize.height,
                }}
                resizeMode={FastImage.resizeMode.contain}
              />
            </ShadowedView>
          </Pressable>
        </View>
        <ScrollView
          style={styles.bookInfoContainer}
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onLongPress={handleEditTitle}
            delayLongPress={400}
            style={styles.bookInfoContainer}
          >
            <View style={styles.bookInfoColumn}>
              <Text
                style={[
                  styles.bookTitleText,
                  { color: themeColors.lightText },
                ]}
              >
                {book.bookTitle ?? bookTitle}
              </Text>
              {/* §F1 — part of the title block, static, one series. */}
              <BookSeriesLine bookId={bookId} />

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
                  <Calendar
                    size={24}
                    color={colors.text}
                    strokeWidth={1.5}
                  />
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
                  onPress={handlePlayPress}
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
                      style={{
                        color: colors.text,
                        fontSize: fontSize.base,
                        fontFamily: 'Rubik',
                      }}
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
              {book.bookProgressValue !== BookProgressState.NotStarted && (
                <BookDurationRow
                  book={book}
                  fontSize={14}
                  barHeight={5}
                  textColor={themeColors.lightTextMuted}
                  style={{ width: '100%', paddingHorizontal: 6 }}
                />
              )}
            </View>
            <View style={styles.inlineInfoContainer}>
              <Text style={styles.paragraph}>
                {book.metadata.description}
              </Text>
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
    </View>
  );
};

export default TitleDetails;

// Horizontal padding on bookContainer; shared with the artwork width bound so
// the two cannot drift apart.
const SCREEN_HORIZONTAL_PADDING = 16;

/**
 * Caps the upper info group so its rows stay a readable, phone-like width
 * instead of stretching the full 800dp of a tablet — which left the Author/Read
 * by columns flung to opposite edges and made the info card, play button and
 * duration row look oversized. Comfortably above a phone's content width
 * (~367dp), so phones are unaffected.
 */
const INFO_COLUMN_MAX_WIDTH = 550;
const PROGRESS_OPTION_HEIGHT = 44;
const PROGRESS_MENU_HEIGHT = PROGRESS_OPTION_HEIGHT * 3;

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
  },
  bookContainer: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
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
  // Width-capped group holding everything from the title down to the duration
  // row. The description, hairline and copyright sit outside it so they keep
  // the full width — long prose reads fine wide, unlike the info card and
  // play button, which looked stretched.
  bookInfoColumn: {
    gap: 20,
    width: '100%',
    maxWidth: INFO_COLUMN_MAX_WIDTH,
    alignSelf: 'center',
  },
  bookArtworkContainer: {
    // width/height are supplied per-render from computeDetailsArtworkSize
    paddingTop: 12,
    zIndex: 10,
  },
  bookArtworkImage: {
    // height is supplied per-render alongside the container's
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
    // flex:1 gives the three cards equal thirds. Without it they size to their
    // content and `space-between` pins the outer two to the container edges,
    // so Duration and Chapters sat off-centre within their own column.
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookTitleText: {
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: 21,
    // fontWeight: '600',
    textAlign: 'center',
    lineHeight: 26,
  },
  bookInfoText: {
    fontFamily: 'Rubik',
    fontSize: fontSize.sm,
  },
  listInfoText: {
    fontFamily: 'Rubik',
    fontSize: 14,
    color: '#d8dee9ac',
  },
  genreText: {
    color: colors.textMuted,
    fontFamily: 'Rubik',
    fontSize: fontSize.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.modalBackground,
  },
  paragraph: {
    fontFamily: 'Rubik',
    fontSize: fontSize.sm,
    color: colors.text,
    lineHeight: 24,
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
    paddingTop: 33,
    paddingRight: 30,
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
  progressMenuWrapper: {
    overflow: 'hidden',
  },
  menuSubItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: PROGRESS_OPTION_HEIGHT,
    paddingHorizontal: 16,
    paddingLeft: 48,
  },
  menuItemText: {
    fontFamily: 'Rubik',
    fontSize: 16,
  },
});
