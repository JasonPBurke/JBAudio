/**
 * THROWAWAY — Series UX redesign prototype harness (ticket 13). See ./README.md.
 *
 * The series detail screen as ticket 11 specified it, on a REAL ROUTE.
 *
 * WHY THIS IS A SEPARATE FILE from `ProtoSeriesDetail.tsx`. That one is a
 * `Modal` rendered inline by five ticket-08 browse variants, and 08 is resolved
 * — rewriting it would edit a closed ticket's artifact. This is 11's screen:
 * grab handle only, no ⋮, no back chevron, rows that PLAY, and a hero that
 * honours `Series Backgrounds`. The two differ enough that sharing would have
 * meant a component with a mode switch on every decision 11 made.
 *
 * THE FIDELITY CAVEAT 08 AND 10 BOTH CARRIED IS GONE. A `Modal` is not the
 * navigator, so it said nothing about presentation. This file is the body of
 * `src/app/seriesDetail.tsx`, a root-level `formSheet` sibling — so what you
 * see IS the presentation, and the wrench row performs a real
 * `slide_from_right` push of the real editor over a live sheet. That is ticket
 * 13's headline question.
 *
 * WHAT IT DELIBERATELY DOES NOT DO:
 *   - No `series.artwork` column exists (schema v33 is unbuilt) and the harness
 *     writes nothing to the DB, so a "pin" is a boolean in `protoStore` drawn
 *     as the series' LAST book's cover. It has to be a visibly different cover
 *     or an override cannot be told from the derived art.
 *   - No `Series Backgrounds` column exists either; the harness knob stands in.
 *
 * IT DOES WRITE TO THE DATABASE, and that is a deliberate exception to the
 * harness rule. Ticket 13 asks for rows that play FOR REAL, and playback is
 * inherently stateful: `handleBookPlay` stamps `last_played_at`, promotes
 * `NotStarted` → `Started`, and writes the active book. Restart-from-zero adds
 * a chapter-index/progress reset on top. Real books on the emulator therefore
 * move. Synthetic SERIES are still pure memory — only the books they point at
 * are real, and those were always real (see README's first constraint).
 */
import React, { memo, useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
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
import { useIsBookActiveAndPlaying } from '@/store/playerState';
import { setTitleDetailsNavIntent } from '@/store/titleDetailsNavIntent';
import { handleBookPlay } from '@/helpers/handleBookPlay';
import { awaitPlayerReady } from '@/helpers/awaitPlayerReady';
import {
  updateChapterIndexInDB,
  updateChapterProgressInDB,
} from '@/db/chapterQueries';
import { Book } from '@/types/Book';
import type { DerivedSeries } from '@/helpers/seriesAssembly';
import type { ProtoSeries } from './syntheticSeries';
import { useProtoStore } from './protoStore';
import {
  getSeriesFacts,
  seriesMetaLine,
  fitInBox,
  bookCoverShape,
  CoverShape,
} from './seriesFacts';
import {
  CoverCluster,
  OriginChip,
  CompletionBar,
  CLUSTER_MAX_LAYERS,
} from './seriesCardParts';
import ProtoSeriesEdit from './ProtoSeriesEdit';

/** Square box every row cover is fitted into, so titles stay left-aligned. */
const ROW_COVER_BOX = 46;

/** Cluster size on the hero. 08 used 84 on the browse row; a detail hero can
 *  afford more, and 104 was the first prototype's figure the driver saw. */
const HERO_CLUSTER = 104;

/**
 * Lines of series name shown before the title truncates and becomes tappable.
 * Four, because 4 × ~26dp ≈ 104dp — exactly the cluster's height, so the title
 * block and the artwork stay balanced. Carried over from `ProtoSeriesDetail`.
 */
const TITLE_LINE_CAP = 4;

/**
 * Scrim opacity over the hero backdrop. Ticket 12 fixed the cover-cluster
 * scrim at 0.42 in BOTH toggle states and its reasoning binds here too: the
 * thing being darkened must not vary with a preference, or legibility does.
 * This is a different surface (the backdrop, not the front cover) so it gets
 * its own value, but it is likewise constant.
 */
const HERO_SCRIM = 0.55;

type TextLayoutEvent = Parameters<
  NonNullable<React.ComponentProps<typeof Text>['onTextLayout']>
>[0];

type Row = {
  book: Book;
  canonical: number | null;
  done: boolean;
  index: number;
  shape: CoverShape;
};

/**
 * Restart-from-zero, ticket 11's forced consequence of rows that play.
 *
 * `handleBookPlay` has NO `Finished` case (`handleBookPlay.ts:44-68`): it reads
 * the stored chapter index and progress and resumes there, which on a finished
 * book is the last few seconds. Everywhere else in the app that is survivable
 * because you arrived via `titleDetails` and can seek; this screen has no route
 * to `titleDetails` at all, so there would be no escape hatch. Zeroing the
 * stored position BEFORE the play call is the smallest change that gets there,
 * and it is why the reset lives at the call site rather than inside the helper
 * — retrofitting `BookGridItem` is explicitly out of scope (map, 2026-08-04).
 *
 * NOTE what it does NOT do: `bookProgressValue` stays `Finished`, so the row
 * keeps its ✓. That reads as correct (you HAVE finished it; you are
 * re-listening) but it is a judgement, not a given — flagged for the driver.
 */
async function rewindFinishedBook(bookId: string) {
  await updateChapterIndexInDB(bookId, 0);
  await updateChapterProgressInDB(bookId, 0);
}

const ProtoSeriesDetailSheet = ({ series }: { series: DerivedSeries }) => {
  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const seriesBackgrounds = useProtoStore((s) => s.seriesBackgrounds);
  const editorTarget = useProtoStore((s) => s.editorTarget);
  const pinned = useProtoStore((s) => s.pinnedSeries[series.id] ?? false);

  const [protoEditing, setProtoEditing] = useState(false);
  const [titleExpanded, setTitleExpanded] = useState(false);
  const [titleOverflows, setTitleOverflows] = useState(false);

  const handleTitleLayout = useCallback((e: TextLayoutEvent) => {
    const overflows = e.nativeEvent.lines.length > TITLE_LINE_CAP;
    setTitleOverflows((prev) => (prev === overflows ? prev : overflows));
  }, []);

  const toggleTitle = useCallback(() => setTitleExpanded((v) => !v), []);

  const facts = getSeriesFacts(series, CLUSTER_MAX_LAYERS);
  const numbers = (series as ProtoSeries).canonicalNumbers ?? [];

  /*
   * Ticket 11: pinned art rides the fan's FRONT CARD and REPLACES card 0
   * rather than prepending, so 08's cluster width is untouched. `cluster[0]`
   * already IS the derived series art — `getSeriesFacts` walks `books` in
   * position order — which is why `series.artwork ?? books[0].artwork` is one
   * expression in the real implementation.
   */
  const pinnedShape =
    pinned && series.books.length > 0
      ? bookCoverShape(series.books[series.books.length - 1])
      : null;
  const cluster = pinnedShape
    ? [pinnedShape, ...facts.cluster.slice(1)]
    : facts.cluster;

  const rows: Row[] = series.books.map((book, index) => ({
    book,
    canonical: numbers[index] ?? null,
    done: facts.progressValues[index] === 2,
    index,
    shape: bookCoverShape(book),
  }));

  const renderRow = useCallback(({ item }: { item: Row }) => <BookRow row={item} />, []);

  // Books repeat under synthetic data, so bookId alone is not unique.
  const keyExtractor = useCallback(
    (item: Row) => `${item.book.bookId}-${item.index}`,
    [],
  );

  /*
   * THE HEADLINE QUESTION OF TICKET 13.
   *
   * `series/edit/[id]` sits inside the `series` group, which the root stack
   * gives `animation: 'slide_from_right'` (`_layout.tsx:288-293`) — an OPAQUE
   * push. Every other focused flow this app launches from a sheet is a
   * `transparentModal`. 11 chose to leave the editor where it is (option A) on
   * the understanding that 13 would find out whether Android survives it.
   *
   * The documented fallback if it does not: move the editor to a root-level
   * `transparentModal` matching `editTitleDetails`, and re-check
   * `seriesDraftStore`'s reset-on-group-entry lifetime, which the group
   * boundary currently owns.
   */
  const openEditor = useCallback(() => {
    if (editorTarget === 'proto') {
      setProtoEditing(true);
      return;
    }
    console.log(`[proto13] wrench → real editor push, series ${series.id}`);
    router.navigate({
      pathname: '/series/edit/[id]',
      params: { id: series.id },
    });
  }, [editorTarget, router, series.id]);

  const heroPlayTarget = facts.nextUp ?? series.books[0] ?? null;
  const heroFinished = facts.nextUp === null;

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: themeColors.background, paddingTop: insets.top + 8 },
      ]}
    >
      {/*
        Ticket 11: the header is `titleDetails`' 55×7 grab handle and NOTHING
        else. The 48dp nav row with its ChevronLeft and "Series" label is gone —
        a back chevron on a bottom sheet is a mixed metaphor, and the hero's
        series name already identifies the screen.
      */}
      <View style={styles.dismissContainer}>
        <Pressable
          hitSlop={10}
          onPress={() => router.back()}
          style={[
            styles.dismissIndicator,
            {
              backgroundColor: withOpacity(themeColors.background, 0.66),
              borderColor: themeColors.textMuted,
            },
          ]}
          accessibilityLabel='Close series'
        />
      </View>

      <FlashList
        data={rows}
        renderItem={renderRow}
        keyExtractor={keyExtractor}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/*
              THE HERO BACKDROP — ticket 11 amends 12: `Series Backgrounds`
              governs this too, at near-zero cost because both states were
              already designed (ON = 08's browse treatment, OFF = the flat
              hero). 08's scrim is heaviest on the LEFT under the text, which
              transfers directly because the hero has 08's shape: cluster left,
              text right.

              08'S THEME-COUPLING TRAP APPLIES AT FULL SIZE HERE. Anything drawn
              on this surface must be coloured against the surface the component
              itself paints, NOT against the palette — that bug made a
              theme-coloured glyph invisible in light mode. The gradient below is
              built FROM `themeColors.background`, so it darkens toward the
              theme's own ground and the text on top stays a theme colour
              legitimately. A fixed near-white would be the wrong fix here and
              the right one on the cluster, which is why they differ.
            */}
            {seriesBackgrounds && (
              <View style={StyleSheet.absoluteFill} pointerEvents='none'>
                <FastImage
                  source={{
                    uri: cluster[0]?.uri ?? unknownBookImageUri,
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
                      backgroundColor: withOpacity(
                        themeColors.background,
                        HERO_SCRIM,
                      ),
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
                {/*
                  Vertical fade at the foot. Without it the backdrop's bottom
                  edge is a hard seam across the middle of the sheet, which
                  reads as a rendering fault rather than a treatment.
                */}
                <LinearGradient
                  colors={[
                    withOpacity(themeColors.background, 0),
                    themeColors.background,
                  ]}
                  locations={[0.55, 1]}
                  style={StyleSheet.absoluteFill}
                />
              </View>
            )}

            <View style={styles.hero}>
              <View style={styles.heroTop}>
                <CoverCluster covers={cluster} size={HERO_CLUSTER} />
                <View style={styles.heroText}>
                  {titleOverflows ? (
                    <Pressable
                      onPress={toggleTitle}
                      android_ripple={{
                        color: withOpacity(themeColors.divider, 0.16),
                      }}
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

                  {/* Off-screen measurement copy — a capped <Text> reports only
                      the lines it drew, so it cannot tell "exactly 4" from
                      "clipped at 4". Cheap here (one title, one mount); do NOT
                      copy into a recycled cell. */}
                  <Text
                    style={[styles.heroTitle, styles.titleMeasure]}
                    onTextLayout={handleTitleLayout}
                    pointerEvents='none'
                  >
                    {series.name}
                  </Text>

                  <Text
                    numberOfLines={1}
                    style={[styles.heroMeta, { color: themeColors.textMuted }]}
                  >
                    {seriesMetaLine(facts)}
                    {facts.range !== '' ? ` · #${facts.range}` : ''}
                  </Text>
                  <View style={styles.chipRow}>
                    <OriginChip series={series} />
                  </View>
                </View>
              </View>

              <CompletionBar facts={facts} />

              {heroPlayTarget && (
                <HeroPlayButton
                  book={heroPlayTarget}
                  finished={heroFinished}
                  label={
                    heroFinished
                      ? `Restart · ${heroPlayTarget.bookTitle}`
                      : facts.nextUpNumber !== null
                        ? `${facts.nextUpStarted ? 'Continue' : 'Next'} · #${facts.nextUpNumber} ${heroPlayTarget.bookTitle}`
                        : `${facts.nextUpStarted ? 'Continue' : 'Next'} · ${heroPlayTarget.bookTitle}`
                  }
                />
              )}

              {/*
                THE SOLE ROUTE TO THE EDITOR. Ticket 11 DELETED the ⋮ rather
                than fill it (one item duplicating a visible row two inches
                below it is not worth its pixels), which amends 10's "two
                visible routes, one word" down to one. The wrench glyph and the
                word `Edit series` are both 10's rulings and unchanged.
              */}
              <Pressable
                style={styles.fixRow}
                onPress={openEditor}
                android_ripple={{ color: withOpacity(themeColors.divider, 0.16) }}
              >
                <Wrench size={15} color={themeColors.textMuted} />
                <Text style={[styles.fixLabel, { color: themeColors.textMuted }]}>
                  Edit series
                </Text>
                {editorTarget === 'proto' && (
                  <Text
                    style={[styles.fixHint, { color: themeColors.primary }]}
                  >
                    proto editor
                  </Text>
                )}
              </Pressable>

              <View
                style={[
                  styles.divider,
                  { backgroundColor: withOpacity(themeColors.divider, 0.18) },
                ]}
              />
            </View>
          </View>
        }
      />

      {protoEditing && (
        <ProtoSeriesEdit series={series} onClose={() => setProtoEditing(false)} />
      )}
    </View>
  );
};

/**
 * Series-level play. Same restart rule as the rows: a finished series' button
 * says `Restart` and targets `books[0]` (08's ruling — hiding the button on a
 * finished series left the row's right side empty, so it read as an unfinished
 * layout), and getting there needs the same rewind the rows do.
 */
const HeroPlayButton = memo(function HeroPlayButton({
  book,
  finished,
  label,
}: {
  book: Book;
  finished: boolean;
  label: string;
}) {
  const { colors: themeColors } = useTheme();
  const activeBookId = useQueueStore((s) => s.activeBookId);
  const setActiveBookId = useQueueStore((s) => s.setActiveBookId);

  const onPress = useCallback(async () => {
    if (!book.bookId) return;
    if (finished) await rewindFinishedBook(book.bookId);
    await awaitPlayerReady();
    const playbackState = await TrackPlayer.getPlaybackState();
    void handleBookPlay(
      book,
      playbackState.state === State.Playing,
      book.bookId === activeBookId,
      activeBookId,
      setActiveBookId,
    );
  }, [book, finished, activeBookId, setActiveBookId]);

  return (
    <Pressable
      style={[styles.continueButton, { backgroundColor: themeColors.primary }]}
      android_ripple={{ color: withOpacity('#000000', 0.12) }}
      onPress={onPress}
    >
      <Play size={16} color={themeColors.background} fill={themeColors.background} />
      <Text
        numberOfLines={1}
        style={[styles.continueLabel, { color: themeColors.background }]}
      >
        {label}
      </Text>
    </Pressable>
  );
});

/**
 * A book row, in the two modes `RowMode` describes.
 *
 * `whole` is ticket 11's ruling: one `Pressable` over everything, and no glyph
 * — with a single target there is nothing for a glyph to discriminate.
 *
 * `split` puts the two `Pressable`s side by side: the ARTWORK plays and the
 * WORDS explain. That is the arrangement `BookGridItem` already uses (cover +
 * play badge → playback, card body → `titleDetails`), so it is the app's
 * convention rather than an invention — and it is what stops this screen being
 * the only place in the app where a book is shown and cannot be inspected.
 *
 * THE GLYPH'S GROUND DIFFERS BETWEEN THE TWO SCREENS, and copying 08 verbatim
 * was wrong. 08's browse glyph sits on an 84dp cover that merely STANDS IN for
 * a series, so the driver licensed scrimming the whole front card: "we can lose
 * artwork detail here without a real sacrifice." Here the 46dp cover IS the
 * book's identity in a list the user scans to find one — so the scrim shrinks
 * to a disc behind the glyph and the rest of the cover keeps full brightness,
 * matching `BookGridItem`, which likewise never darkens the whole cover. The
 * hairline border is kept from 08: a 42% black disc can otherwise vanish into
 * dark artwork.
 */
const BookRow = memo(function BookRow({ row }: { row: Row }) {
  const { colors: themeColors } = useTheme();
  const router = useRouter();
  const rowMode = useProtoStore((s) => s.rowMode);
  const activeBookId = useQueueStore((s) => s.activeBookId);
  const setActiveBookId = useQueueStore((s) => s.setActiveBookId);
  const isPlaying = useIsBookActiveAndPlaying(row.book.bookId ?? '');

  const split = rowMode === 'split';

  const onPlay = useCallback(async () => {
    if (!row.book.bookId) return;
    if (row.done) {
      console.log(`[proto13] restart-from-zero: ${row.book.bookTitle}`);
      await rewindFinishedBook(row.book.bookId);
    }
    await awaitPlayerReady();
    const playbackState = await TrackPlayer.getPlaybackState();
    void handleBookPlay(
      row.book,
      playbackState.state === State.Playing,
      row.book.bookId === activeBookId,
      activeBookId,
      setActiveBookId,
    );
  }, [row.book, row.done, activeBookId, setActiveBookId]);

  /*
   * THE UNTESTED THING. `titleDetails` is a root-level `formSheet`
   * (`_layout.tsx:242-249`) and so is `seriesDetail`, so this presents a sheet
   * OVER a sheet — a stack nothing in this app builds today. The nav-intent
   * flag is mandatory, not decoration: `TitleDetails` dismisses itself on mount
   * if it is absent, which is the fix for the remount-restores-the-route ghost
   * (`titleDetailsNavIntent.ts`, mirroring `playerNavIntent.ts`).
   */
  const onOpenDetails = useCallback(() => {
    console.log(`[proto13] row text → titleDetails: ${row.book.bookTitle}`);
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

  /* Number + cover. In `split` this is the play target — together they clear
     80dp of width, where the 46dp cover alone would be under the 48dp
     minimum. */
  const leading = (
    <>
      <Text
        style={[
          styles.rowNumber,
          {
            color:
              row.canonical === null
                ? withOpacity(themeColors.textMuted, 0.45)
                : themeColors.textMuted,
          },
        ]}
      >
        {/* Ticket 07: the badge shows the CANONICAL number and is blank when
            unknown — position is already carried by layout. */}
        {row.canonical === null ? '–' : `#${row.canonical}`}
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
        {(isPlaying || split) && (
          <View style={styles.rowGlyphLayer} pointerEvents='none'>
            {isPlaying ? (
              <LoaderKitView
                style={styles.rowLoader}
                name='LineScaleParty'
                animationSpeedMultiplier={0.55}
                color={themeColors.primary}
              />
            ) : (
              /*
               * NOTHING OUTSIDE THE GLYPH IS DARKENED (driver, 2026-08-04).
               * The scrim did not shrink to a badge, it shrank to the GLYPH:
               * the same 0.42 black is now the triangle's `fill`, so the
               * artwork still shows through it exactly as it did through the
               * scrim — the darkened region is simply bounded by the play
               * shape instead of a rectangle, and the near-white stroke is its
               * border. Every pixel outside the triangle is untouched cover.
               *
               * Keeping 0.42 rather than going opaque is the driver's call and
               * it is the conservative one: it is the value 08 measured and 12
               * then froze across both toggle states, so contrast under the
               * glyph is unchanged from the treatment already signed off.
               *
               * Both colours are FIXED, not theme colours — 08's light-theme
               * defect was a glyph coloured from the palette while sitting on
               * artwork the palette knows nothing about.
               */
              <Play
                size={22}
                color='#F5F5F5'
                fill={withOpacity('#000000', 0.42)}
                strokeWidth={1.5}
              />
            )}
          </View>
        )}
      </View>
    </>
  );

  const trailing = (
    <>
      <View style={styles.rowText}>
        <Text numberOfLines={2} style={[styles.rowTitle, { color: themeColors.text }]}>
          {row.book.bookTitle}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.rowAuthor, { color: themeColors.textMuted }]}
        >
          {row.book.author}
        </Text>
      </View>
      {row.done && <Check size={18} color={themeColors.success} />}
    </>
  );

  if (!split) {
    return (
      <Pressable
        style={styles.row}
        onPress={onPlay}
        android_ripple={ripple}
        accessibilityLabel={`Play ${row.book.bookTitle}`}
      >
        {leading}
        {trailing}
      </Pressable>
    );
  }

  return (
    // No vertical padding here — the two halves carry it, so the row's height
    // matches `whole` mode exactly rather than doubling it. The modes have to
    // be comparable or the A/B measures the wrong thing.
    <View style={styles.rowSplit}>
      <Pressable
        style={styles.rowLeading}
        onPress={onPlay}
        android_ripple={ripple}
        accessibilityLabel={`Play ${row.book.bookTitle}`}
      >
        {leading}
      </Pressable>
      <Pressable
        style={styles.rowTrailing}
        onPress={onOpenDetails}
        android_ripple={ripple}
        accessibilityLabel={`${row.book.bookTitle} details`}
      >
        {trailing}
      </Pressable>
    </View>
  );
});

export default memo(ProtoSeriesDetailSheet);

const styles = StyleSheet.create({
  screen: { flex: 1 },
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
  chipRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    borderRadius: 21,
    marginTop: 18,
    paddingHorizontal: 16,
  },
  continueLabel: {
    fontFamily: 'Rubik',
    fontSize: fontSize.xs,
    fontWeight: '600',
    marginLeft: 8,
    flexShrink: 1,
  },
  fixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  fixLabel: {
    fontFamily: 'Rubik',
    fontSize: fontSize.xs,
    marginLeft: 8,
  },
  fixHint: {
    fontFamily: 'Rubik',
    fontSize: 10,
    marginLeft: 8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: screenPadding.horizontal,
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
  /* Split-mode halves. `rowLeading` hugs its content so the text keeps every
     pixel it had in `whole` mode — the split must not cost layout, or the two
     modes stop being comparable. */
  rowSplit: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: screenPadding.horizontal,
  },
  rowLeading: {
    flexDirection: 'row',
    alignItems: 'center',
    // Same vertical padding as the trailing half so the play target is the
    // FULL height of the row beside the artwork, not just the 46dp cover
    // (driver: the pressable should cover the entire image). Both halves then
    // ripple to the same bounds, which is what makes the split legible as two
    // targets rather than one target with a dead patch.
    paddingVertical: 8,
  },
  rowTrailing: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  rowText: {
    flex: 1,
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
