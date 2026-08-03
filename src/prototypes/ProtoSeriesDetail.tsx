/**
 * THROWAWAY — Series UX redesign prototype harness (ticket 08). See ./README.md.
 *
 * The series detail screen, shared by the `Cards`, `Rich header` and `Picker`
 * variants.
 *
 * SHARED ON PURPOSE. Ticket 08 asks what the repeating unit of the BROWSE
 * screen is; three variants that also each invented their own detail screen
 * would make the driver compare six things and decide none of them. All three
 * agree a detail screen exists — they disagree about how much work it has to
 * do — so it is built once here and they differ only in how you reach it.
 * Ticket 08 decides this screen's EXISTENCE AND JOB; its contents are the next
 * ticket's, and everything below is a sketch sized to make the browse decision
 * judgeable.
 *
 * FIDELITY CAVEAT, worth stating before the driver reads anything into it:
 * this is a `Modal`, not a route. It slides over the whole screen so the
 * "you have left the library" feeling is roughly right, but it is NOT the
 * navigator, so it says nothing about push-vs-formSheet for a real detail
 * screen. Ticket 05 already settled that question for the wizard and its
 * reasoning is not automatically transferable. Using the navigator here would
 * have meant real routes plus a full JS reload on every `screenOptions` tweak
 * (map: "Navigator `screenOptions` changes do not apply via fast refresh").
 */
import React, { memo, useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import FastImage from '@d11/react-native-fast-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronLeft, Play, Wrench } from 'lucide-react-native';

import { unknownBookImageUri } from '@/constants/images';
import { fontSize, screenPadding } from '@/constants/tokens';
import { useTheme } from '@/hooks/useTheme';
import { withOpacity } from '@/helpers/colorUtils';
import { Book } from '@/types/Book';
import type { DerivedSeries } from '@/helpers/seriesAssembly';
import type { ProtoSeries } from './syntheticSeries';
import {
  getSeriesFacts,
  seriesMetaLine,
  fitInBox,
  bookCoverShape,
  CoverShape,
} from './seriesFacts';
import { CoverCluster, OriginChip, CompletionBar } from './seriesCardParts';

/** Square box every row cover is fitted into, so titles stay left-aligned. */
const ROW_COVER_BOX = 46;

/**
 * Lines of series name shown before the title truncates and becomes tappable.
 *
 * Four, not three or five, because 4 × ~26dp ≈ 104dp — exactly the height of
 * the cover cluster beside it, so the title block and the artwork stay
 * balanced. Past that the header starts to eat the book list.
 *
 * The browse row caps at 2 lines and does NOT expand (driver, 2026-08-03: two
 * lines is enough to recognise a series, and the full name lives here). That
 * makes this screen the last place a 95-character name can be read in full, so
 * it must always be reachable — hence tap-to-expand rather than a hard clip.
 */
const TITLE_LINE_CAP = 4;

/**
 * Derived from the prop rather than imported: RN 0.83 deprecates the exported
 * `TextLayoutEventData`, and reading the type off `Text` itself stays correct
 * whatever the export is called next version.
 */
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

const ProtoSeriesDetail = ({
  series,
  onClose,
}: {
  series: DerivedSeries | null;
  onClose: () => void;
}) => {
  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();

  const [titleExpanded, setTitleExpanded] = useState(false);
  // Whether the name actually overflows `TITLE_LINE_CAP`. Measured off-screen
  // rather than inferred: a `<Text>` with `numberOfLines` reports only the
  // lines it drew, so it cannot tell "exactly 4" from "clipped at 4".
  const [titleOverflows, setTitleOverflows] = useState(false);

  const handleTitleLayout = useCallback(
    (e: TextLayoutEvent) => {
      const overflows = e.nativeEvent.lines.length > TITLE_LINE_CAP;
      setTitleOverflows((prev) => (prev === overflows ? prev : overflows));
    },
    [],
  );

  const toggleTitle = useCallback(() => setTitleExpanded((v) => !v), []);

  const facts = series ? getSeriesFacts(series, 3) : null;
  const numbers = (series as ProtoSeries | null)?.canonicalNumbers ?? [];

  const rows: Row[] = series
    ? series.books.map((book, index) => ({
        book,
        canonical: numbers[index] ?? null,
        done: facts!.progressValues[index] === 2,
        index,
        // 500×500 fallback matches BookGridItem — see `seriesFacts.ts`.
        shape: bookCoverShape(book),
      }))
    : [];

  const renderRow = useCallback(
    ({ item }: { item: Row }) => (
      <BookRow row={item} />
    ),
    [],
  );

  // Books repeat under synthetic data, so bookId alone is not unique.
  const keyExtractor = useCallback(
    (item: Row) => `${item.book.bookId}-${item.index}`,
    [],
  );

  if (!series || !facts) return null;

  return (
    <Modal
      visible
      animationType='slide'
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View
        style={[
          styles.screen,
          {
            backgroundColor: themeColors.background,
            paddingTop: insets.top,
          },
        ]}
      >
        <View style={styles.navRow}>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={styles.backButton}
            android_ripple={{
              color: withOpacity(themeColors.divider, 0.16),
              borderless: true,
              radius: 20,
            }}
            accessibilityLabel='Back to library'
          >
            <ChevronLeft size={26} color={themeColors.icon} />
          </Pressable>
          <Text
            numberOfLines={1}
            style={[styles.navTitle, { color: themeColors.textMuted }]}
          >
            Series
          </Text>
        </View>

        <FlashList
          data={rows}
          renderItem={renderRow}
          keyExtractor={keyExtractor}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.hero}>
              <View style={styles.heroTop}>
                <CoverCluster covers={facts.cluster} size={104} />
                <View style={styles.heroText}>
                  {/*
                    No "Show full name" label (driver, 2026-08-03): the trailing
                    ellipsis is the affordance.

                    The title becomes a control ONLY when it actually overflows.
                    Not `disabled` — TalkBack announces a disabled control as
                    dimmed, which implies it could become enabled. A name that
                    fits is a plain `<Text>`: nothing in the accessibility tree,
                    nothing to tap, no ripple firing on a no-op.

                    Measuring is cheap HERE because this is one title mounted
                    once per screen. Do not copy the hidden-measure trick into a
                    recycled list cell without re-checking: a duplicate <Text>
                    doubles per-cell text layout, which is the expensive part of
                    FlashList.
                  */}
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
                        numberOfLines={
                          titleExpanded ? undefined : TITLE_LINE_CAP
                        }
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
                    Off-screen measurement copy: same style, same width, no line
                    cap — the only way to learn the TRUE line count. Zero opacity
                    and behind everything, so it never paints or catches a touch.
                  */}
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

              {facts.nextUp && (
                <Pressable
                  style={[
                    styles.continueButton,
                    { backgroundColor: themeColors.primary },
                  ]}
                  android_ripple={{ color: withOpacity('#000000', 0.12) }}
                >
                  <Play
                    size={16}
                    color={themeColors.background}
                    fill={themeColors.background}
                  />
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.continueLabel,
                      { color: themeColors.background },
                    ]}
                  >
                    {facts.nextUpNumber !== null
                      ? `Continue · #${facts.nextUpNumber} ${facts.nextUp.bookTitle}`
                      : `Continue · ${facts.nextUp.bookTitle}`}
                  </Text>
                </Pressable>
              )}

              {/*
                The correction entry point. Ticket 02 removed the confirmation
                gate (detection just creates the series), so what a detected
                series still owes the user is a way to FIX it — which is
                ticket 10's surface, and this is the anchor 08 has to leave it.
              */}
              <Pressable
                style={styles.fixRow}
                android_ripple={{
                  color: withOpacity(themeColors.divider, 0.16),
                }}
              >
                <Wrench size={15} color={themeColors.textMuted} />
                <Text style={[styles.fixLabel, { color: themeColors.textMuted }]}>
                  Fix this series
                </Text>
              </Pressable>

              <View
                style={[
                  styles.divider,
                  { backgroundColor: withOpacity(themeColors.divider, 0.18) },
                ]}
              />
            </View>
          }
        />
      </View>
    </Modal>
  );
};

const BookRow = memo(function BookRow({ row }: { row: Row }) {
  const { colors: themeColors } = useTheme();
  return (
    <Pressable
      style={styles.row}
      android_ripple={{ color: withOpacity(themeColors.divider, 0.16) }}
    >
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
        {/*
          Ticket 07: the badge shows the CANONICAL number and is blank when
          unknown — position is already carried by the layout, so a bare dash
          here is the honest rendering of "we don't know", not a gap to fill.
        */}
        {row.canonical === null ? '–' : `#${row.canonical}`}
      </Text>
      {/*
        FIXED-WIDTH container, cover drawn to its own shape inside it. The
        container is what keeps every title starting at the same x — without it
        a wide cover shoves that one book's text right and the column goes
        ragged (driver, 2026-08-03).
      */}
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
      </View>
      <View style={styles.rowText}>
        <Text
          numberOfLines={2}
          style={[styles.rowTitle, { color: themeColors.text }]}
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
      {row.done && <Check size={18} color={themeColors.success} />}
    </Pressable>
  );
});

export default memo(ProtoSeriesDetail);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 6,
  },
  backButton: {
    padding: 6,
  },
  navTitle: {
    fontFamily: 'Rubik',
    fontSize: fontSize.sm,
    marginLeft: 4,
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
