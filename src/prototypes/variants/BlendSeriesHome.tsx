/**
 * THROWAWAY — Series UX redesign prototype harness (ticket 08). See ../README.md.
 *
 * VARIANTS 8-10 of ticket 08: THE CARDS × RICH BLEND. Ticket 08 was REOPENED on
 * 2026-08-03 — the driver was not satisfied with `Rich + continue` and named two
 * specific faults, both about the same thing:
 *
 *   1. the row is too heavy / too few series per screen (~172dp, ~3.5/screen);
 *   2. the static peek row does not earn its height.
 *
 * BOTH HAVE ONE FIX. The peek row's job was "show me the collection", and it
 * spent 66dp of VERTICAL to do it. `CoverCluster` does the same job in ~101dp of
 * HORIZONTAL — which is free, because the text column never needed full width.
 * So the peek row is deleted and cover-presence moves into the fanned stack.
 * That is the whole thesis of these three variants.
 *
 * WHAT CAME FROM WHERE (driver's merge list, 2026-08-03):
 *   from `Cards`  — the horizontal skeleton, the fanned `CoverCluster`, the
 *                   `Next · #9 Eric` line, `fontSize.sm` title, the density.
 *   from `Rich`   — the scrimmed first-cover backdrop, the three-state
 *                   `Start`/`Continue`/`Restart` button, and the chip-free
 *                   full-width meta line.
 *   from NEITHER  — `N finished` is dropped from the meta line, because
 *                   `CompletionBar` already renders `8/41` beneath it.
 *
 * THREE ENTRIES, ONE COMPONENT, TWO BOOLEANS — the same trick `RichPlaySeriesHome`
 * used, so the variants cannot drift apart on anything except the axis being
 * judged:
 *
 *   `Blend card`   container: card      · backdrop: yes (clipped by the card)
 *   `Blend sep`    container: separator · backdrop: yes (full-bleed)
 *   `Blend quiet`  container: separator · backdrop: no
 *
 * `card` vs `sep` isolates the CONTAINER on its own — same backdrop, so the
 * driver reacts to the thing they asked to compare. `quiet` is the second axis
 * (art-heavy vs quiet) and is deliberately NOT collapsed into the first.
 *
 * NO INLINE EXPANSION (driver, 2026-08-03). A tap anywhere opens the detail
 * screen. `activeGridSections` / `setActiveGridSections` arrive as props and are
 * intentionally unused. That keeps this a plain vertical FlashList: no masonry,
 * no `overrideItemLayout`, no `BookGridItem` — and therefore no nested-list
 * construct for the clipped-row bug to live in. Per ticket 08 that is a
 * DIVIDEND, NOT AN ARGUMENT.
 *
 * NO ORIGIN CHIP on browse; provenance stays on the detail screen (driver,
 * 2026-08-03). This is unchanged from the first pass and is what gives the meta
 * line its width back.
 *
 * THE PLAY BUTTON IS A STUB. It logs and does not touch playback. The question
 * is whether the affordance belongs on a browse row, not whether playback works.
 *
 * SHARED-COMPONENT ANSWER: forks nothing, and now uses nothing shared either —
 * `BookGridItem` and `BooksHorizontal` are both unused, so `BooksHome` and
 * `BooksGrid` are untouched.
 */
import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import FastImage from '@d11/react-native-fast-image';
import { Play } from 'lucide-react-native';

import { unknownBookImageUri } from '@/constants/images';
import { useTheme } from '@/hooks/useTheme';
import { fontSize, screenPadding } from '@/constants/tokens';
import { utilsStyles } from '@/styles';
import { withOpacity } from '@/helpers/colorUtils';
import { useResetScrollOnTabChange } from '@/hooks/useResetScrollOnTabChange';
import type { DerivedSeries } from '@/helpers/seriesAssembly';
import type { VariantProps } from '../variantProps';
import { getSeriesFacts, seriesMetaLine, SeriesFacts } from '../seriesFacts';
import {
  CoverCluster,
  CompletionBar,
  CLUSTER_MAX_LAYERS,
  coverClusterWidth,
} from '../seriesCardParts';
import ProtoSeriesDetail from '../ProtoSeriesDetail';

/** Long-axis box for one cluster layer. `Cards` used 84 and the driver liked it. */
const CLUSTER_SIZE = 84;
/**
 * Glyph colour for the centred play button. Fixed near-white, NOT a theme
 * colour: it always sits on `CoverCluster`'s dark `frontScrim`, so its ground
 * does not change with the app's theme even though the rest of the row's does.
 */
const SCRIM_GLYPH = '#F5F5F5';
/** Gap between the cluster and the text column. */
const TEXT_GAP = 14;
/** Inner padding of the card container. */
const CARD_PADDING = 12;

/**
 * Where a row separator starts. `BooksList.tsx:103` hard-codes `marginLeft: 75`
 * to clear its 75dp cover so the rule begins under the TEXT — same intent here,
 * but derived, because the cluster's drawn width is `size` plus every layer's
 * peek (~101dp at size 84), not `size`.
 *
 * Uses the MAX layer count, not the per-series count: a 1-book series draws a
 * narrower cluster, and an inset that moved row-to-row would read as a
 * rendering fault rather than a rule.
 */
const SEPARATOR_INSET =
  screenPadding.horizontal + coverClusterWidth(CLUSTER_SIZE) + TEXT_GAP;

type Container = 'card' | 'separator';

/**
 * Where the one-click play affordance lives — the axis added on 2026-08-03,
 * after the driver measured the `Continue` pill at ~111dp of a 412dp row (~27%)
 * and traced four separate faults back to it: wrapped titles, variable row
 * height, a truncated `Next ·` line, and the loss of `N finished` from the meta.
 *
 *   'pill'    right rail, icon + word (the original)
 *   'overlay' bare glyph on the front cover — costs ZERO layout width
 *   'below'   the pill, shrunk, tucked under the fan in the cover column
 */
type PlaySlot = 'pill' | 'overlay' | 'below';

/**
 * How the overlay glyph is drawn. `'corner'` is `BookGridItem`'s small
 * bottom-right badge; `'center'` is larger, centred, and scrims the cover
 * behind it.
 *
 * The scrim is licensed by the driver (2026-08-03): *"we can lose artwork
 * detail here without a real sacrifice as the art is just a series visual
 * representation."* Unlike `BookGridItem`, whose artwork IS the book's
 * identity, this cover is only standing in for the series — so darkening it to
 * buy glyph contrast costs nothing that matters.
 */
type OverlayStyle = 'corner' | 'center';
type Row = { series: DerivedSeries; facts: SeriesFacts };

const BlendSeriesHome = ({
  series,
  onScroll,
  ListHeaderSpacer,
  emptyMessage,
  selectedTab,
  container,
  backdrop,
  playSlot,
  overlayStyle = 'corner',
}: VariantProps & {
  container: Container;
  backdrop: boolean;
  playSlot: PlaySlot;
  overlayStyle?: OverlayStyle;
}) => {
  const { colors: themeColors } = useTheme();
  const [detailSeries, setDetailSeries] = useState<DerivedSeries | null>(null);

  const listRef = useRef<React.ComponentRef<typeof FlashList<Row>>>(null);
  useResetScrollOnTabChange(listRef, selectedTab);

  const rows: Row[] = useMemo(
    // Cap at the cluster's layer count: unlike the peek row, this layout draws a
    // fixed number of covers, so there is nothing for extra candidates to do.
    () =>
      series.map((s) => ({
        series: s,
        facts: getSeriesFacts(s, CLUSTER_MAX_LAYERS),
      })),
    [series],
  );

  const handleOpenDetail = useCallback(
    (s: DerivedSeries) => setDetailSeries(s),
    [],
  );
  const handleCloseDetail = useCallback(() => setDetailSeries(null), []);

  const renderItem = useCallback(
    ({ item }: { item: Row }) => (
      <BlendRow
        series={item.series}
        facts={item.facts}
        container={container}
        backdrop={backdrop}
        playSlot={playSlot}
        overlayStyle={overlayStyle}
        onOpenDetail={handleOpenDetail}
      />
    ),
    [handleOpenDetail, container, backdrop, playSlot, overlayStyle],
  );

  const keyExtractor = useCallback((item: Row) => item.series.id, []);

  /*
   * Separator + footer, mirroring `BooksList.tsx:71-78` — that screen draws a
   * rule BETWEEN items and one more after the last, so the list terminates on a
   * line instead of trailing off. Card mode passes undefined: its rows are
   * bounded objects already and a rule between them would double the edge.
   */
  const Divider = useCallback(
    () => (
      <View
        style={{
          ...utilsStyles.itemSeparator,
          marginVertical: 9,
          marginLeft: SEPARATOR_INSET,
          borderColor: themeColors.textMuted,
        }}
      />
    ),
    [themeColors.textMuted],
  );

  return (
    <View style={{ flex: 1, paddingTop: 8 }}>
      <FlashList
        ref={listRef}
        data={rows}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onScroll={onScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={ListHeaderSpacer}
        ItemSeparatorComponent={container === 'separator' ? Divider : undefined}
        ListFooterComponent={
          container === 'separator' && rows.length > 0 ? Divider : undefined
        }
        ListEmptyComponent={
          <Text
            style={[utilsStyles.emptyComponent, { color: themeColors.textMuted }]}
          >
            {emptyMessage}
          </Text>
        }
        contentContainerStyle={{ paddingBottom: 58 }}
        showsVerticalScrollIndicator={false}
      />
      <ProtoSeriesDetail series={detailSeries} onClose={handleCloseDetail} />
    </View>
  );
};

const BlendRow = memo(function BlendRow({
  series,
  facts,
  container,
  backdrop,
  playSlot,
  overlayStyle,
  onOpenDetail,
}: {
  series: DerivedSeries;
  facts: SeriesFacts;
  container: Container;
  backdrop: boolean;
  playSlot: PlaySlot;
  overlayStyle: OverlayStyle;
  onOpenDetail: (series: DerivedSeries) => void;
}) {
  const { colors: themeColors } = useTheme();
  const handlePress = useCallback(
    () => onOpenDetail(series),
    [series, onOpenDetail],
  );

  const isCard = container === 'card';
  const backdropUri = facts.cluster[0]?.uri ?? null;

  /*
   * Three states, one button — ALWAYS present (driver, 2026-08-02: "finished
   * series should read 'restart' with a play button"). An earlier build hid it
   * on finished series, which was literally correct but left the right side of
   * those rows empty, so a completed series read as an unfinished LAYOUT.
   *
   * `Continue` is also wrong for a series never opened — Bobiverse renders 0/1
   * and read `Continue` on the first build.
   */
  const finished = facts.nextUp === null;
  const touched = facts.progressValues.some((v) => v > 0);
  const playLabel = finished ? 'Restart' : touched ? 'Continue' : 'Start';
  // Restart goes back to the top of the series, not to a next-up that is null.
  const playTarget = finished ? series.books[0] : facts.nextUp;

  const handlePlay = useCallback(() => {
    // STUB — see the file header. The question is the affordance, not playback.
    console.log(
      `[proto] ${playLabel} stub: ${series.name} → ${playTarget?.bookTitle ?? '(empty)'}`,
    );
  }, [series.name, playLabel, playTarget]);

  return (
    <View style={isCard ? styles.cardOuter : undefined}>
      <Pressable
        onPress={handlePress}
        android_ripple={{ color: withOpacity(themeColors.divider, 0.16) }}
        accessibilityLabel={`${series.name}, ${facts.bookCount} books`}
        style={
          isCard
            ? [
                styles.card,
                {
                  backgroundColor: themeColors.modalBackground,
                  borderColor: withOpacity(themeColors.divider, 0.12),
                },
              ]
            : styles.plainRow
        }
      >
        {/*
          The card clips the backdrop via its own overflow+radius; the separator
          variant has no container, so the same art simply bleeds edge to edge —
          which is the one thing that genuinely cannot be held constant across
          the two containers.
        */}
        {backdrop && (
          <>
            <FastImage
              source={{
                uri: backdropUri ?? unknownBookImageUri,
                priority: FastImage.priority.low,
                cache: FastImage.cacheControl.immutable,
              }}
              style={StyleSheet.absoluteFill}
              resizeMode={FastImage.resizeMode.cover}
            />
            {/*
              Scrim heaviest on the LEFT, under the text. The reverse was built
              first in `Rich header` and every title fought its own cover.
            */}
            <LinearGradient
              colors={[
                themeColors.background,
                withOpacity(themeColors.background, 0.92),
                withOpacity(themeColors.background, 0.55),
              ]}
              locations={[0, 0.45, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </>
        )}

        <View style={styles.rowContent}>
          {playSlot === 'below' ? (
            /*
             * The pill moves out of the text row entirely and tucks under the
             * fan, sized to the cluster's exact width so the two read as one
             * object. Costs ~20dp of height and hands the text column ~123dp
             * back — and because the cover column (84 + 8 + 32 = 124dp) is now
             * TALLER than the text stack, it is what sets the row height. That
             * makes the row FIXED again: a 2-line title no longer changes it.
             */
            <View style={styles.coverColumn}>
              <CoverCluster covers={facts.cluster} size={CLUSTER_SIZE} />
              <PlayPill
                label={playLabel}
                seriesName={series.name}
                onPress={handlePlay}
                compact
              />
            </View>
          ) : (
            <CoverCluster
              covers={facts.cluster}
              size={CLUSTER_SIZE}
              overlayAlign={overlayStyle === 'center' ? 'center' : 'corner'}
              frontScrim={
                playSlot === 'overlay' && overlayStyle === 'center' ? 0.42 : 0
              }
              overlay={
                playSlot === 'overlay' ? (
                  <PlayIcon
                    label={playLabel}
                    seriesName={series.name}
                    onPress={handlePlay}
                    centered={overlayStyle === 'center'}
                  />
                ) : undefined
              }
            />
          )}

          <View style={styles.textCol}>
            <Text
              numberOfLines={2}
              style={[styles.title, { color: themeColors.text }]}
            >
              {series.name}
            </Text>

            {/*
              `N finished` RESTORED (driver, 2026-08-03). It was dropped when
              the `Continue` pill left only ~127dp here and the tally was
              crowding out ticket 07's canonical range. Moving the play
              affordance off this row bought ~123dp back, so both fit again.
              `seriesCountLine` survives as the lever if that reverses.
            */}
            <Text
              numberOfLines={1}
              style={[styles.meta, { color: themeColors.textMuted }]}
            >
              {seriesMetaLine(facts)}
              {facts.range !== '' ? ` · #${facts.range}` : ''}
            </Text>

            <CompletionBar facts={facts} compact />

            {/*
              "Next up" is what earns the row its height — browse answers "what
              do I play" without opening anything, and it names what the button
              beside it will actually do.
            */}
            {facts.nextUp ? (
              <Text
                numberOfLines={1}
                style={[styles.nextUp, { color: themeColors.textMuted }]}
              >
                {/*
                  THREE states, not two (driver, 2026-08-03). `Continue` means
                  you are mid-book; `Next` means you finished the last one and
                  this is what follows. That distinction is what lets the play
                  button drop its own word without losing the information —
                  between this line and the progress bar, every state the
                  `Start`/`Continue`/`Restart` label carried is still stated.
                */}
                {facts.nextUpStarted ? 'Continue' : 'Next'} ·{' '}
                {facts.nextUpNumber !== null
                  ? `#${facts.nextUpNumber} ${facts.nextUp.bookTitle}`
                  : facts.nextUp.bookTitle}
              </Text>
            ) : (
              <Text
                numberOfLines={1}
                style={[styles.nextUp, { color: themeColors.success }]}
              >
                Series complete
              </Text>
            )}
          </View>

          {playSlot === 'pill' && (
            <PlayPill
              label={playLabel}
              seriesName={series.name}
              onPress={handlePlay}
            />
          )}
        </View>
      </Pressable>
    </View>
  );
});

/**
 * Icon + word. `compact` is the under-the-fan form: shorter, tighter, and
 * sized to the cluster's exact width so the pair reads as a single object
 * rather than a button that happens to sit nearby.
 */
const PlayPill = memo(function PlayPill({
  label,
  seriesName,
  onPress,
  compact = false,
}: {
  label: string;
  seriesName: string;
  onPress: () => void;
  compact?: boolean;
}) {
  const { colors: themeColors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={[
        styles.pill,
        compact ? styles.pillCompact : styles.pillRail,
        {
          backgroundColor: themeColors.backgroundAlpha59,
          // Hairline: the translucent ground vanishes over dark backdrops,
          // leaving the button with no edge. Tied to the glyph colour so it
          // tracks the theme rather than hard-coding a grey.
          borderColor: withOpacity(themeColors.icon, 0.4),
        },
      ]}
      android_ripple={{ color: withOpacity(themeColors.divider, 0.16) }}
      accessibilityLabel={`${label} ${seriesName}`}
    >
      <Play
        size={compact ? 16 : 20}
        color={themeColors.icon}
        strokeWidth={1}
        absoluteStrokeWidth
      />
      <Text style={[styles.pillText, { color: themeColors.text }]}>{label}</Text>
    </Pressable>
  );
});

/**
 * Bare glyph, pinned to the front cover's bottom-right — `BookGridItem`'s own
 * treatment (`pausedIconBase`: `padding: 6`, `borderRadius: 4`, outlined `Play`
 * over `backgroundAlpha59`). Costs ZERO layout width, which is the entire point.
 *
 * The three states survive only through `accessibilityLabel`; visually a
 * finished series and an untouched one are identical here. That is a real cost
 * the driver accepted on 2026-08-03 in exchange for the ~123dp.
 */
const PlayIcon = memo(function PlayIcon({
  label,
  seriesName,
  onPress,
  centered = false,
}: {
  label: string;
  seriesName: string;
  onPress: () => void;
  centered?: boolean;
}) {
  const { colors: themeColors } = useTheme();
  /*
   * The scrim is NOT rendered here. It is `CoverCluster`'s `frontScrim`, so the
   * cover layer clips it to its own rounded corners — drawn here it was a
   * sibling of the layers and its square corners outlined the cover as a box.
   */
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={[
        styles.playIcon,
        centered && styles.playIconCentered,
        {
          backgroundColor: centered
            ? 'transparent'
            : themeColors.backgroundAlpha59,
          borderColor: withOpacity(
            themeColors.icon,
            // The centred glyph sits on its own scrim and needs no ground, so
            // the border would only draw a box around nothing.
            centered ? 0 : 0.4,
          ),
        },
      ]}
      android_ripple={{ color: withOpacity(themeColors.divider, 0.16) }}
      accessibilityLabel={`${label} ${seriesName}`}
    >
      <Play
        size={centered ? 40 : 20}
        /*
         * The centred glyph is deliberately NOT `themeColors.icon`. It sits on
         * a 42% black scrim that this component controls, so its ground is dark
         * in BOTH themes — taking its colour from the page palette made it dark
         * on dark and invisible in light mode. The corner glyph keeps the theme
         * colour, because it sits on unscrimmed artwork.
         */
        color={centered ? SCRIM_GLYPH : themeColors.icon}
        strokeWidth={1}
        absoluteStrokeWidth
      />
    </Pressable>
  );
});

/** Registry entry: bounded card, backdrop clipped inside it. */
export const BlendCard = memo(function BlendCard(props: VariantProps) {
  return (
    <BlendSeriesHome {...props} container='card' backdrop playSlot='pill' />
  );
});

/** Registry entry: pill replaced by a bare glyph ON the front cover. */
export const BlendIcon = memo(function BlendIcon(props: VariantProps) {
  return (
    <BlendSeriesHome {...props} container='card' backdrop playSlot='overlay' />
  );
});

/**
 * Registry entries: the centred-glyph treatment applied to the two SEPARATOR
 * containers, so the play-affordance question and the container question can be
 * judged together rather than one having to be settled before the other.
 *
 * `Blend quiet ctr` is the extreme of the set — the only variant where cover
 * art appears nowhere except the cluster, and the cluster's own front cover is
 * scrimmed 42% besides. Worth knowing what the row reads like with almost all
 * the artwork taken out of it.
 */
export const BlendSeparatorCenter = memo(function BlendSeparatorCenter(
  props: VariantProps,
) {
  return (
    <BlendSeriesHome
      {...props}
      container='separator'
      backdrop
      playSlot='overlay'
      overlayStyle='center'
    />
  );
});

export const BlendQuietCenter = memo(function BlendQuietCenter(
  props: VariantProps,
) {
  return (
    <BlendSeriesHome
      {...props}
      container='separator'
      backdrop={false}
      playSlot='overlay'
      overlayStyle='center'
    />
  );
});

/** Registry entry: bigger glyph CENTRED on the front cover, over a 42% scrim. */
export const BlendCenter = memo(function BlendCenter(props: VariantProps) {
  return (
    <BlendSeriesHome
      {...props}
      container='card'
      backdrop
      playSlot='overlay'
      overlayStyle='center'
    />
  );
});

/** Registry entry: pill shrunk and moved under the fan; row grows ~20dp. */
export const BlendStack = memo(function BlendStack(props: VariantProps) {
  return (
    <BlendSeriesHome {...props} container='card' backdrop playSlot='below' />
  );
});

/** Registry entry: no container, inset hairline rule, full-bleed backdrop. */
export const BlendSeparator = memo(function BlendSeparator(
  props: VariantProps,
) {
  return (
    <BlendSeriesHome
      {...props}
      container='separator'
      backdrop
      playSlot='pill'
    />
  );
});

/** Registry entry: no container, inset hairline rule, NO cover art behind text. */
export const BlendQuiet = memo(function BlendQuiet(props: VariantProps) {
  return (
    <BlendSeriesHome
      {...props}
      container='separator'
      backdrop={false}
      playSlot='pill'
    />
  );
});

const styles = StyleSheet.create({
  cardOuter: {
    paddingHorizontal: screenPadding.horizontal,
    paddingBottom: 10,
  },
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    // Required, or the backdrop paints over the rounded corners.
    overflow: 'hidden',
  },
  /*
   * No horizontal padding out here: the separator variants let the backdrop
   * bleed to both screen edges, so the inset lives on `rowContent` instead.
   */
  plainRow: {
    overflow: 'hidden',
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: screenPadding.horizontal,
    paddingVertical: CARD_PADDING,
  },
  textCol: {
    flex: 1,
    marginLeft: TEXT_GAP,
  },
  title: {
    fontFamily: 'Rubik',
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  meta: {
    fontFamily: 'Rubik',
    fontSize: fontSize.xs,
    marginTop: 4,
  },
  nextUp: {
    fontFamily: 'Rubik',
    fontSize: 11,
    marginTop: 8,
  },
  /*
   * `BookGridItem`'s play treatment (driver, 2026-08-03): an OUTLINED `Play` in
   * `themeColors.icon` over `backgroundAlpha59` at `borderRadius: 4` — no fill,
   * no amber. The hairline border is a DELIBERATE divergence from
   * `BookGridItem`, which has none: the grid button always sits on cover art,
   * whereas this one sits on a scrim that can match its own ground and vanish.
   */
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillRail: {
    height: 40,
    paddingHorizontal: 14,
    marginLeft: 12,
  },
  /*
   * Width is pinned to the cluster's so the fan and the button share an edge
   * and read as one control. Shorter and tighter than the rail form: this one
   * is buying its space back in height, so it should spend as little as it can.
   */
  pillCompact: {
    height: 32,
    width: coverClusterWidth(CLUSTER_SIZE),
    justifyContent: 'center',
    paddingHorizontal: 10,
    marginTop: 8,
  },
  pillText: {
    fontFamily: 'Rubik',
    fontSize: fontSize.xs,
    fontWeight: '600',
    marginLeft: 8,
  },
  /** `BookGridItem`'s `pausedIconBase` — padding 6, radius 4, plus our hairline. */
  playIcon: {
    padding: 6,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  /*
   * Optical centring: a triangle's visual mass sits left of its bounding box,
   * so a geometrically-centred `Play` reads as offset. Same 3dp nudge
   * `RichPlaySeriesHome`'s icon button uses.
   */
  playIconCentered: {
    padding: 0,
    paddingLeft: 3,
  },
  coverColumn: {
    alignItems: 'center',
  },
});
