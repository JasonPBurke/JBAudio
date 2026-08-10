/**
 * The Series detail sheet — spec §C. A detail view of the browse row you
 * tapped, not a departure from the library.
 *
 * Rules that are load-bearing here, not stylistic:
 *
 *   §C1/§C2  a root-sibling `formSheet` matching the book details screen. The
 *            route and its options live in `app/seriesDetail.tsx` and
 *            `app/_layout.tsx`; this file is only its body.
 *   §C3  THE HEADER IS A GRAB HANDLE ONLY — no nav row, no back chevron, no ⋮.
 *        A back chevron on a bottom sheet is a mixed metaphor: the sheet
 *        dismisses downward and the arrow points left. The handle is itself
 *        pressable and dismisses.
 *   §C4  ROWS SPLIT: the cover plays, the text opens the book's details. The
 *        play target is the whole leading half (number plus the full height of
 *        the artwork), so the glyph advertises the target without being it.
 *   §C7  the hero is the browse backdrop and honours `Series Backgrounds`, with
 *        a bottom fade — without one its lower edge is a hard seam across the
 *        middle of the sheet.
 *   §C10 ONE route to the editor: a wrench row reading `Edit series`.
 *   §H2  THE 600dp CONTENT CAP IS NOT APPLIED HERE. It was built on this page
 *        and reverted on sight — this page has no full-bleed paint to absorb
 *        it, so it reads as content shoved into the left 600dp. §H6's shrinking
 *        text is what closes the defect the cap was aimed at.
 *   §H4  the hero fan still SCALES with width, which is a different rule from
 *        the layout cap — see `heroClusterSize`.
 *   K11  a book cell can only render a book that is in the library store; these
 *        rows carry resolved `Book` objects, not ids to re-resolve.
 */
import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import FastImage from '@d11/react-native-fast-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import LoaderKitView from 'react-native-loader-kit';
import TrackPlayer, { State } from 'react-native-track-player';
import { Check, Play, Wrench } from 'lucide-react-native';

import { unknownBookImageUri } from '@/constants/images';
import { fontSize, screenPadding } from '@/constants/tokens';
import { useTheme } from '@/hooks/useTheme';
import { withOpacity } from '@/helpers/colorUtils';
import { useQueueStore } from '@/store/queue';
import { useIsBookActive, useIsBookActiveAndPlaying } from '@/store/playerState';
import { useSettingsStore } from '@/store/settingsStore';
import { setTitleDetailsNavIntent } from '@/store/titleDetailsNavIntent';
import { handleBookPlay } from '@/helpers/handleBookPlay';
import { awaitPlayerReady } from '@/helpers/awaitPlayerReady';
import { Book } from '@/types/Book';
import type { DerivedSeries } from '@/helpers/seriesAssembly';
import { getSeriesRowFacts, seriesMetaLine } from '@/helpers/seriesRowFacts';
import { fitInBox, heroClusterSize } from '@/helpers/seriesRowGeometry';
import {
  heroClusterCovers,
  heroPlayAction,
  seriesDetailRows,
  type SeriesDetailRow,
} from '@/helpers/seriesDetailFacts';
import { SeriesCoverCluster } from '@/components/SeriesCoverCluster';
import { SeriesCompletionBar } from '@/components/SeriesCompletionBar';

/** Square box every row cover is fitted into, so titles stay left-aligned. */
const ROW_COVER_BOX = 46;

/**
 * Lines of series name shown before the title truncates and becomes tappable.
 * Four, because 4 × ~26dp ≈ 104dp — the hero cluster's height, so the title
 * block and the artwork stay balanced.
 */
const TITLE_LINE_CAP = 4;

/**
 * Scrim opacity over the hero backdrop. §B9 fixed the cover-cluster scrim in
 * both toggle states and its reasoning binds here: the thing being darkened
 * must not vary with a preference, or legibility does. This is a different
 * surface (the backdrop, not a cover) so it gets its own value, likewise
 * constant.
 */
const HERO_SCRIM = 0.55;

type TextLayoutEvent = Parameters<
  NonNullable<React.ComponentProps<typeof Text>['onTextLayout']>
>[0];

/**
 * Play a book, from the hero button or a row's leading half.
 *
 * ⚠ NO REWIND HERE. §C5's restart-from-zero lives in `handleBookPlay` precisely
 * so this call site does not carry it — the helper's fix pays the library grid,
 * the list row, the book details screen and Android Auto at the same time, and
 * it flips a restarted book back to `Started` so the rule cannot fire twice.
 */
async function playBook(
  book: Book,
  activeBookId: string | null,
  setActiveBookId: (bookId: string) => void,
) {
  if (!book.bookId) return;
  await awaitPlayerReady();
  const playbackState = await TrackPlayer.getPlaybackState();
  void handleBookPlay(
    book,
    playbackState.state === State.Playing,
    book.bookId === activeBookId,
    activeBookId,
    setActiveBookId,
  );
}

const SeriesDetailSheet = ({ series }: { series: DerivedSeries }) => {
  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const seriesBackgrounds = useSettingsStore(
    (state) => state.seriesBackgroundsEnabled,
  );

  const facts = useMemo(() => getSeriesRowFacts(series), [series]);
  const rows = useMemo(() => seriesDetailRows(series), [series]);
  const cluster = useMemo(() => heroClusterCovers(series), [series]);
  const heroPlay = useMemo(
    () => heroPlayAction(series, facts),
    [series, facts],
  );

  const renderRow = useCallback(
    ({ item }: { item: SeriesDetailRow }) => <BookRow row={item} />,
    [],
  );
  const keyExtractor = useCallback((item: SeriesDetailRow) => item.key, []);

  const dismiss = useCallback(() => router.back(), [router]);

  const listPadding = useMemo(
    () => ({ paddingBottom: insets.bottom + 24 }),
    [insets.bottom],
  );

  /*
   * §C10 — THE SOLE ROUTE TO THE EDITOR. The ⋮ was deleted rather than filled:
   * a menu holding a single item that duplicates a visible row two inches below
   * it is not worth its pixels. §C2's placement (this sheet is a root sibling,
   * not a member of the series group) is what makes the editor's `Save`/`Cancel`
   * land back here by construction.
   */
  const openEditor = useCallback(() => {
    router.navigate({
      pathname: '/series/edit/[id]',
      params: { id: series.id },
    });
  }, [router, series.id]);

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: themeColors.background,
          paddingTop: insets.top + 8,
        },
      ]}
    >
      {/*
        §C3 — the book details screen's 55×7 grab handle and NOTHING else. The
        48dp nav row with its chevron and label is gone; the hero's series name
        identifies the screen.
      */}
      <View style={styles.dismissContainer}>
        <Pressable
          hitSlop={10}
          onPress={dismiss}
          style={[
            styles.dismissIndicator,
            {
              backgroundColor: withOpacity(themeColors.background, 0.66),
              borderColor: themeColors.textMuted,
            },
          ]}
          accessibilityRole='button'
          accessibilityLabel='Close series'
        />
      </View>

      {/*
        THE HERO IS PINNED, OUTSIDE THE LIST, AND THAT PLACEMENT IS LOAD-BEARING.
        It was the list's `ListHeaderComponent` until a long series (Discworld, 41
        books) proved that arrangement unusable: see the block comment on the list
        below. The hero is the sheet's drag-to-dismiss target, and it can only be
        that while it sits outside the scroll view. This is the shape
        `titleDetails` already uses — pinned artwork above, scroller below — and it
        is why that screen never had this bug.
      */}
      <SeriesHero
        series={series}
        covers={cluster}
        width={width}
        showBackdrop={seriesBackgrounds}
        meta={seriesMetaLine(facts, { overflowing: false })}
        facts={facts}
        heroPlay={heroPlay}
        onEdit={openEditor}
      />

      {/*
        ⚠ `renderScrollComponent` AND the gutters are BOTH required, for two
        different halves of one defect. Device-verified on Discworld, 2026-08-10.

        1. THE GESTURE-HANDLER SCROLL VIEW IS THE FIX. With React Native's plain
           scroll view, this route's Android form sheet — a Material
           `BottomSheetDialog`, its own Window — let `BottomSheetBehavior` steal
           every downward drag off the CoordinatorLayout. Scrolling DOWN worked;
           scrolling back UP dismissed the sheet. Reproduced, then fixed by this
           one prop, then re-reproduced by removing it.

        2. THE GUTTERS PAY FOR THE FIX. A gesture-handler scroll view swallows
           ALL vertical drags whenever it has ANY scrollable content — direction
           is not consulted — so once it wins, the sheet can never be dragged
           shut from anywhere the list covers, not even at offset 0. The pinned
           hero above and these side strips are the drag targets that buys back.
           `row` therefore carries NO horizontal padding: it lives here instead,
           so the rows do not move a pixel.
      */}
      <View style={styles.listGutter}>
        <FlashList
          data={rows}
          renderItem={renderRow}
          keyExtractor={keyExtractor}
          contentContainerStyle={listPadding}
          showsVerticalScrollIndicator={false}
          renderScrollComponent={GestureScrollView}
        />
      </View>
    </View>
  );
};

export default memo(SeriesDetailSheet);

/**
 * The hero: fan, name, meta line, completion bar, play button, wrench row —
 * §C9 carried from the browse row unchanged, plus the button's word.
 */
const SeriesHero = memo(function SeriesHero({
  series,
  covers,
  width,
  showBackdrop,
  meta,
  facts,
  heroPlay,
  onEdit,
}: {
  series: DerivedSeries;
  covers: ReturnType<typeof heroClusterCovers>;
  width: number;
  showBackdrop: boolean;
  meta: string;
  facts: ReturnType<typeof getSeriesRowFacts>;
  heroPlay: ReturnType<typeof heroPlayAction>;
  onEdit: () => void;
}) {
  const { colors: themeColors } = useTheme();
  const [titleExpanded, setTitleExpanded] = useState(false);
  const [titleOverflows, setTitleOverflows] = useState(false);

  const handleTitleLayout = useCallback((e: TextLayoutEvent) => {
    const overflows = e.nativeEvent.lines.length > TITLE_LINE_CAP;
    setTitleOverflows((prev) => (prev === overflows ? prev : overflows));
  }, []);

  const toggleTitle = useCallback(() => setTitleExpanded((v) => !v), []);

  return (
    <View>
      {showBackdrop && <HeroBackdrop uri={covers[0]?.uri ?? null} />}

      <View style={styles.hero}>
        <View style={styles.heroTop}>
          {/* No `onPlay` — the hero's play affordance is the full-width button
              below (§C9), and a glyph on the fan would be a second target for
              the same action. */}
          <SeriesCoverCluster covers={covers} size={heroClusterSize(width)} />

          <View style={styles.heroText}>
            {/*
              §C9/§H11 — the name is capped and TAP-TO-EXPAND, with no label.
              Browse-row truncation is intended; this is its escape hatch.
            */}
            {titleOverflows ? (
              <Pressable
                onPress={toggleTitle}
                android_ripple={{
                  color: withOpacity(themeColors.divider, 0.16),
                }}
                accessibilityRole='button'
                accessibilityLabel={`${series.name}. Tap to ${
                  titleExpanded ? 'collapse' : 'show the full name'
                }`}
              >
                <Text
                  numberOfLines={titleExpanded ? undefined : TITLE_LINE_CAP}
                  style={[styles.heroTitle, { color: themeColors.text }]}
                >
                  {series.name}
                </Text>
              </Pressable>
            ) : (
              <Text style={[styles.heroTitle, { color: themeColors.text }]}>
                {series.name}
              </Text>
            )}

            {/*
              K14 — MEASURE OVERFLOW, DO NOT INFER IT. A capped <Text> reports
              only the lines it drew, so it cannot tell "exactly 4" from
              "clipped at 4". This zero-opacity uncapped copy can. Cheap here
              (one title, one mount); do NOT copy it into a recycled cell, where
              a duplicate <Text> doubles the per-cell text layout.
            */}
            <Text
              style={[styles.heroTitle, styles.titleMeasure]}
              onTextLayout={handleTitleLayout}
              pointerEvents='none'
            >
              {series.name}
            </Text>

            <Text
              numberOfLines={2}
              style={[styles.heroMeta, { color: themeColors.textMuted }]}
            >
              {meta}
            </Text>
          </View>
        </View>

        <SeriesCompletionBar facts={facts} />

        {heroPlay && <HeroPlayButton action={heroPlay} />}

        <Pressable
          style={styles.editRow}
          onPress={onEdit}
          android_ripple={{ color: withOpacity(themeColors.divider, 0.16) }}
          accessibilityRole='button'
          accessibilityLabel={`Edit ${series.name}`}
        >
          <Wrench size={15} color={themeColors.textMuted} />
          <Text style={[styles.editLabel, { color: themeColors.textMuted }]}>
            Edit series
          </Text>
        </Pressable>

        <View
          style={[
            styles.divider,
            { backgroundColor: withOpacity(themeColors.divider, 0.18) },
          ]}
        />
      </View>
    </View>
  );
});

/**
 * §C7 — the browse row's backdrop, widened. `Series Backgrounds` governs it by
 * simply not rendering it; both states were already designed, so this is a
 * conditional rather than a design.
 *
 * ⚠ THE BOTTOM FADE IS NOT DECORATION. Without it the backdrop's lower edge is
 * a hard seam across the middle of the sheet, which reads as a rendering fault
 * rather than a treatment.
 *
 * The horizontal gradient is built FROM `themeColors.background`, so it darkens
 * toward the theme's own ground and text on top can stay a theme colour
 * legitimately. That is the opposite of the play glyph's rule (fixed colours,
 * never theme-derived) and the difference is deliberate: the glyph sits on
 * artwork the palette knows nothing about, this sits on the theme's own ground.
 */
const HeroBackdrop = memo(function HeroBackdrop({
  uri,
}: {
  uri: string | null;
}) {
  const { colors: themeColors } = useTheme();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents='none'>
      <FastImage
        source={{
          uri: uri ?? unknownBookImageUri,
          priority: FastImage.priority.normal,
          cache: FastImage.cacheControl.immutable,
        }}
        style={StyleSheet.absoluteFill}
        resizeMode={FastImage.resizeMode.cover}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: withOpacity(themeColors.background, HERO_SCRIM),
          },
        ]}
      />
      <LinearGradient
        colors={[
          themeColors.background,
          withOpacity(themeColors.background, 0.9),
          withOpacity(themeColors.background, 0.5),
        ]}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[withOpacity(themeColors.background, 0), themeColors.background]}
        locations={[0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
});

/**
 * Series-level play — §C9's button that keeps its word, because a full-width
 * hero button does not have the browse row's width constraint. The word is
 * computed in `heroPlayAction`; a finished series says `Restart` and targets
 * the first book, which `handleBookPlay` then starts from zero (§C5).
 */
const HeroPlayButton = memo(function HeroPlayButton({
  action,
}: {
  action: NonNullable<ReturnType<typeof heroPlayAction>>;
}) {
  const { colors: themeColors } = useTheme();
  const activeBookId = useQueueStore((s) => s.activeBookId);
  const setActiveBookId = useQueueStore((s) => s.setActiveBookId);

  const onPress = useCallback(() => {
    void playBook(action.book, activeBookId, setActiveBookId);
  }, [action.book, activeBookId, setActiveBookId]);

  return (
    <Pressable
      style={[styles.playButton, { backgroundColor: themeColors.primary }]}
      android_ripple={{ color: withOpacity('#000000', 0.12) }}
      onPress={onPress}
      accessibilityRole='button'
      accessibilityLabel={action.label}
    >
      <Play
        size={16}
        color={themeColors.background}
        fill={themeColors.background}
      />
      <Text
        numberOfLines={1}
        style={[styles.playLabel, { color: themeColors.background }]}
      >
        {action.label}
      </Text>
    </Pressable>
  );
});

/**
 * One book — §C4's split row.
 *
 * The ARTWORK plays and the WORDS explain. That is the arrangement the library
 * grid already uses (cover + play badge → playback, card body → book details),
 * so it is the app's convention rather than an invention, and it is what stops
 * this screen being the only place in the app where a book is shown and cannot
 * be inspected. Sheet-over-sheet was measured clean in both directions, twice,
 * from each end — that measurement is what licenses the split.
 *
 * §B4 — the darkening is the GLYPH, never the artwork: the 0.42 black is the
 * triangle's own `fill` and the stroke is a fixed near-white, so every pixel of
 * cover outside the play shape is untouched. Both colours are fixed rather than
 * theme-derived; a palette-coloured glyph was this effort's first light-theme
 * defect.
 *
 * §C6 — the active book reuses the grid's treatment: the same animated bars in
 * place of the glyph while it plays, and the same title colour. Reused, not
 * reinvented.
 */
const BookRow = memo(function BookRow({ row }: { row: SeriesDetailRow }) {
  const { colors: themeColors } = useTheme();
  const router = useRouter();
  const activeBookId = useQueueStore((s) => s.activeBookId);
  const setActiveBookId = useQueueStore((s) => s.setActiveBookId);
  const bookId = row.book.bookId ?? '';
  const isActive = useIsBookActive(bookId);
  const isPlaying = useIsBookActiveAndPlaying(bookId);

  const onPlay = useCallback(() => {
    void playBook(row.book, activeBookId, setActiveBookId);
  }, [row.book, activeBookId, setActiveBookId]);

  /*
   * §J1.3 — PRESENTING THE BOOK DETAILS SHEET FROM HERE REQUIRES THE APP'S
   * EXISTING NAVIGATION INTENT FLAG. It is not decoration: that screen
   * dismisses itself on mount when the flag is absent, which is the fix for the
   * remount-restores-the-route ghost. Without this line the row would appear to
   * do nothing.
   */
  const onOpenDetails = useCallback(() => {
    setTitleDetailsNavIntent();
    router.navigate({
      pathname: '/titleDetails',
      params: {
        bookId: row.book.bookId,
        author: row.book.author,
        bookTitle: row.book.bookTitle,
      },
    });
  }, [router, row.book]);

  const ripple = { color: withOpacity(themeColors.divider, 0.16) };

  return (
    <View style={styles.row}>
      {/*
        The play target is the number PLUS the full height of the artwork
        (§C4). Together they clear 80dp of width, where the 46dp cover alone
        would sit under the 48dp minimum target, and the matching vertical
        padding on both halves makes the split legible as two targets rather
        than one target with a dead patch.
      */}
      <Pressable
        style={styles.rowLeading}
        onPress={onPlay}
        android_ripple={ripple}
        accessibilityRole='button'
        accessibilityLabel={`Play ${row.book.bookTitle}`}
      >
        <Text
          style={[
            styles.rowNumber,
            {
              color:
                row.canonicalNumber === null
                  ? withOpacity(themeColors.textMuted, 0.45)
                  : themeColors.textMuted,
            },
          ]}
        >
          {row.canonicalNumber === null ? '–' : `#${row.canonicalNumber}`}
        </Text>

        <View style={styles.rowCoverBox}>
          <FastImage
            source={{
              uri: row.book.artwork ?? unknownBookImageUri,
              priority: FastImage.priority.low,
              cache: FastImage.cacheControl.immutable,
            }}
            style={[styles.rowCover, fitInBox(row.shape, ROW_COVER_BOX)]}
            resizeMode={FastImage.resizeMode.cover}
          />
          <View style={styles.rowGlyphLayer} pointerEvents='none'>
            {isPlaying ? (
              <LoaderKitView
                style={styles.rowLoader}
                name='LineScaleParty'
                animationSpeedMultiplier={0.55}
                color={themeColors.primary}
              />
            ) : (
              <Play
                size={22}
                color='#F5F5F5'
                fill={withOpacity('#000000', 0.42)}
                strokeWidth={1.5}
              />
            )}
          </View>
        </View>
      </Pressable>

      <Pressable
        style={styles.rowTrailing}
        onPress={onOpenDetails}
        android_ripple={ripple}
        accessibilityRole='button'
        accessibilityLabel={`${row.book.bookTitle} details`}
      >
        <View style={styles.rowText}>
          <Text
            numberOfLines={2}
            style={[
              styles.rowTitle,
              {
                color: isActive
                  ? themeColors.primaryAlpha75
                  : themeColors.text,
              },
            ]}
          >
            {row.book.bookTitle}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.rowAuthor, { color: themeColors.textMuted }]}
          >
            {row.book.author}
          </Text>
        </View>
        {row.finished && <Check size={18} color={themeColors.successText} />}
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  /*
   * The list's side strips (§C4's drag targets) and its height bound in one. The
   * inset is `screenPadding.horizontal` exactly because that is what `row` gave
   * up — see the note on `row`.
   */
  listGutter: {
    flex: 1,
    marginHorizontal: screenPadding.horizontal,
  },
  dismissContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 10,
  },
  dismissIndicator: {
    width: 55,
    height: 7,
    borderRadius: 50,
    borderWidth: 1,
  },
  /*
   * ⚠ NO `maxWidth` HERE, deliberately (§H2). The browse row's 600dp content
   * cap was applied to this page, built, and reverted on sight: the row bleeds
   * its backdrop and hairline the full width so the cap sits inside paint and
   * is nearly invisible, while this page has no full-bleed paint to absorb it
   * and reads as content shoved into the left 600dp. The gulf the cap was
   * aimed at is closed by `rowText` below instead.
   */
  hero: {
    paddingHorizontal: screenPadding.horizontal,
    paddingTop: 8,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  heroText: {
    flex: 1,
    marginLeft: 16,
  },
  heroTitle: {
    fontFamily: 'Rubik',
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  titleMeasure: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    opacity: 0,
    zIndex: -1,
  },
  heroMeta: {
    fontFamily: 'Rubik',
    fontSize: fontSize.xs,
    marginTop: 6,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
    borderRadius: 21,
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  playLabel: {
    fontFamily: 'Rubik',
    fontSize: fontSize.xs,
    fontWeight: '600',
    marginLeft: 8,
    flexShrink: 1,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  editLabel: {
    fontFamily: 'Rubik',
    fontSize: fontSize.xs,
    marginLeft: 8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  /*
   * No vertical padding out here — the two halves carry it, so the row's height
   * is the halves' height rather than double it.
   *
   * `stretch`, not `center`: §C4 makes the play target "the whole leading half",
   * and at font scale 2.0 a 2-line title makes the TRAILING half the taller one.
   * Centring would leave the leading half floating at its own 62dp inside a
   * taller row, with dead space above and below the artwork that looks pressable
   * and is not. Stretching gives both halves the row's full height, so the two
   * ripples meet.
   */
  /*
   * ⚠ NO `paddingHorizontal` HERE. It moved up to `listGutter`, which insets the
   * whole scroll view by the same amount — so the rows render on exactly the same
   * x as before, and the space they gave up became the sheet's drag strip. Putting
   * it back here would silently re-close the gutters and cost drag-to-dismiss.
   */
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  rowLeading: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  rowNumber: {
    fontFamily: 'Rubik',
    fontSize: fontSize.xs,
    width: 34,
  },
  rowCoverBox: {
    width: ROW_COVER_BOX,
    height: ROW_COVER_BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCover: {
    borderRadius: 4,
  },
  rowGlyphLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLoader: { width: 18, aspectRatio: 1 },
  rowTrailing: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  /*
   * §H6 — `flexShrink` rather than `flex: 1`. With `flex: 1` the text block
   * eats all remaining width and shoves the finished ✓ against the far edge:
   * measured at 416dp past the end of the title on an 800dp tablet, so the eye
   * had to cross the whole row to associate a tick with the book it marks.
   * Shrinking to content parks the tick immediately after the title at every
   * width.
   *
   * The tick may travel because it is an INDICATOR. The create/edit surface's
   * radio and drag grabber are TARGETS and deliberately keep the screen edge,
   * where they are predictable to reach (§H7).
   */
  rowText: {
    flexShrink: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  rowTitle: {
    fontFamily: 'Rubik',
    fontSize: fontSize.xs,
  },
  rowAuthor: {
    fontFamily: 'Rubik',
    fontSize: 11,
    marginTop: 2,
  },
});
