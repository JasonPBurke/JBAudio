/**
 * The editor's on-demand book picker — spec §E3/§E4/§E13, and §H7.
 *
 * Two steps, Authors then Books, running on the editor surface where the
 * `+ Add books` button was, so the ordered list you are building stays visible
 * above it and never moves while you pick. That siting is the measured one:
 * committing a selection straight into the list moved 547,334 pixels per tap
 * because the list and the picker share one scroll container, so anything
 * landing above the panel shoves it down the screen. Selections are STAGED in
 * the draft store and only unioned into the list when the step is committed —
 * 28,488 changed pixels per tap, none of them above the panel.
 *
 * ── §E13: the pool IS the surface's list ──────────────────────────────────
 *
 * The prototype (and ticket 12's port of it) rendered the pool as mapped rows
 * inside the editor's `ScrollView`. That is fine at eight books and not fine
 * against 350: every candidate row mounts, with its artwork, whether or not it
 * is on screen. Here the containment is inverted — the pool is a `FlashList`
 * and everything above it (the ordered list, then the panel's own head) rides
 * as `ListHeaderComponent` and row 0. Nothing else changes about the flow.
 *
 * Three consequences of that inversion, all deliberate:
 *
 * 1. **The head is DATA, not part of the list header**, so it can be
 *    `stickyHeaderIndices: [0]` and pin itself under the editor's header. `X`
 *    is the inverse of `+ Add books` (§E4) and must stay reachable from the
 *    bottom of a 350-book pool — the same argument that put the step's commit
 *    button in the editor's fixed footer instead of inline under the pool.
 * 2. **Horizontal padding lives on the ROWS, never on `contentContainerStyle`.**
 *    FlashList renders the pinned copy of a sticky row in an absolutely
 *    positioned overlay at `left: 0, right: 0`, outside the content container,
 *    so padding applied there would make the head jump full-bleed the instant
 *    it pins.
 * 3. **`maintainVisibleContentPosition` is off.** It is on by default in
 *    FlashList 2.x and anchors the topmost visible item; this list's data is
 *    replaced wholesale when the step commits, which is exactly the case where
 *    that anchor lands somewhere meaningless. The step change scrolls to the
 *    head instead, deterministically.
 *
 * ── §H7: this surface is EXEMPT from the geometry rules ───────────────────
 *
 * No `min(width, 600)` content cap here, on purpose. Its radio buttons and the
 * ordered list's drag grabbers are TARGETS, and a target wants a predictable
 * screen edge. The cap is browse-row-only (§H2).
 *
 * `X` and `+ Add books` are inverses (§E4): `X` closes the panel and keeps the
 * editor, always, including when nothing was added. It never abandons the
 * series — that is what `Cancel`, the header chevron and hardware back do, and
 * keeping the two apart is what makes every route out of the screen mean one
 * thing (§E5).
 *
 * ⚠ KNOWN AND DELIBERATE (§E12): `Books → Authors` has no direct affordance.
 * Getting back is `X` then `+ Add books`, which loses the author selection. A
 * chevron in this head restores it in ~5 lines — add it only on evidence that
 * it reads wrong in use.
 */
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Check, X } from 'lucide-react-native';

import { SeriesBookRow } from '@/components/SeriesBookRow';
import { fontSize, screenPadding } from '@/constants/tokens';
import { withOpacity } from '@/helpers/colorUtils';
import {
  PICKER_HEAD_INDEX,
  pickerRows,
  type PickerRow,
  type PickerStep,
} from '@/helpers/seriesPickerRows';
import { useTheme } from '@/hooks/useTheme';
import { useLibraryStore } from '@/store/library';
import { useSeriesDraftStore } from '@/store/seriesDraftStore';

export function SeriesEditorPanel({
  step,
  onClose,
  listHeader,
}: {
  step: PickerStep;
  onClose: () => void;
  /**
   * §E13's other half — everything above the pool, which is the ordered list
   * you are building. It stays on the surface beneath the panel and is the
   * one thing this list is not allowed to move while you pick.
   */
  listHeader?: React.ReactElement | null;
}) {
  const { colors: themeColors } = useTheme();

  const authors = useLibraryStore((state) => state.authors);
  const selectedAuthorNames = useSeriesDraftStore((s) => s.selectedAuthorNames);
  const toggleAuthor = useSeriesDraftStore((s) => s.toggleAuthor);
  const selectedBookKeys = useSeriesDraftStore((s) => s.selectedBookKeys);
  const toggleBookKey = useSeriesDraftStore((s) => s.toggleBookKey);

  const rows = useMemo(
    () => pickerRows({ step, authors, selected: selectedAuthorNames }),
    [step, authors, selectedAuthorNames],
  );

  /*
   * Membership tests, not the arrays themselves: a 350-book pool asking
   * `includes()` per row per render is the other half of the cost §E13 is
   * about. The sets double as the list's `extraData`, so a tap re-renders the
   * visible cells and nothing else.
   */
  const selection = useMemo(
    () => ({
      authors: new Set(selectedAuthorNames),
      books: new Set(selectedBookKeys),
    }),
    [selectedAuthorNames, selectedBookKeys],
  );

  const listRef = useRef<React.ComponentRef<typeof FlashList<PickerRow>>>(null);

  /*
   * Committing a step replaces the data under a scroll offset that means
   * nothing in the new list — 40 authors down is not 40 books down. Land on
   * the head, which is where the new step starts. The first render is already
   * there via `initialScrollIndex`, so only real changes scroll.
   */
  const shownStep = useRef(step);
  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    listRef.current?.scrollToIndex({
      index: PICKER_HEAD_INDEX,
      animated: false,
    });
  }, [step]);

  const renderItem = useCallback(
    ({ item }: { item: PickerRow }) => {
      switch (item.type) {
        case 'head':
          return <PanelHead onClose={onClose} />;
        case 'author':
          return (
            <AuthorRow
              name={item.name}
              selected={selection.authors.has(item.name)}
              onPress={() => toggleAuthor(item.name)}
            />
          );
        case 'heading':
          return (
            <Text
              style={[styles.authorHeading, { color: themeColors.textMuted }]}
            >
              {item.name}
            </Text>
          );
        case 'book':
          return (
            <View style={styles.poolRow}>
              <SeriesBookRow
                context='selection'
                bookId={item.book.bookId}
                title={item.book.bookTitle}
                author={item.book.author}
                artwork={item.book.artwork}
                selected={selection.books.has(item.bookKey)}
                onPress={() => toggleBookKey(item.bookKey)}
              />
            </View>
          );
        case 'empty':
          return (
            <Text style={[styles.empty, { color: themeColors.textMuted }]}>
              {item.message}
            </Text>
          );
      }
    },
    [selection, toggleAuthor, toggleBookKey, onClose, themeColors],
  );

  return (
    <FlashList
      ref={listRef}
      data={rows}
      extraData={selection}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemType={getItemType}
      ListHeaderComponent={listHeader ?? undefined}
      ListHeaderComponentStyle={styles.listHeader}
      ListFooterComponent={ListFooter}
      stickyHeaderIndices={STICKY_HEAD}
      initialScrollIndex={PICKER_HEAD_INDEX}
      maintainVisibleContentPosition={MVCP_OFF}
      keyboardShouldPersistTaps='handled'
      showsVerticalScrollIndicator={false}
      style={styles.list}
    />
  );
}

const STICKY_HEAD = [PICKER_HEAD_INDEX];
const MVCP_OFF = { disabled: true };

const keyExtractor = (row: PickerRow) => row.key;
/** Rows only recycle into their own kind — a book cell never becomes a heading. */
const getItemType = (row: PickerRow) => row.type;

const ListFooter = () => <View style={styles.listFooter} />;

/**
 * The panel's identity, and the only way out of it that keeps the series.
 *
 * It carries its own opaque base under the accent tint: when it pins, it is an
 * overlay with the pool scrolling underneath, and a translucent band would let
 * every row show through it.
 */
function PanelHead({ onClose }: { onClose: () => void }) {
  const { colors: themeColors } = useTheme();
  return (
    <View style={[styles.headBase, { backgroundColor: themeColors.background }]}>
      <View
        style={[
          styles.head,
          {
            backgroundColor: withOpacity(themeColors.primary, 0.1),
            borderColor: themeColors.primary,
          },
        ]}
      >
        <Text
          numberOfLines={1}
          style={[styles.headTitle, { color: themeColors.text }]}
        >
          Add books
        </Text>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole='button'
          accessibilityLabel='Close the book picker'
        >
          <X size={20} color={themeColors.text} />
        </Pressable>
      </View>
    </View>
  );
}

/**
 * ⚠ THE FILLED TICK STAYS. Ticket 07 flagged this construct — accent fill with
 * the glyph knocked out in `themeColors.background` — as a light-theme item on
 * the (now deleted) `series/create/authors.tsx`, and fixed the Series
 * Detection card's checkbox the other way round: accent tint, accent glyph.
 * The tint idiom was built here and REVERTED on measurement, on the driver's
 * real light theme, at three accents:
 *
 *   accent                 fill + knockout    tint + accent glyph
 *   auto teal (measured)        2.82:1               2.43:1
 *   amber #FFB606               1.53:1               1.41:1
 *   a dark accent               6.91:1               5.43:1
 *
 * The tint is WORSE at every accent, and both track the user's colour rather
 * than the design — which is the reading the driver already ruled on in 09,
 * withdrawing an accent-contrast finding for exactly this reason. Selection is
 * signalled three ways regardless (row border, ring, glyph). Do not re-swap
 * this without a new measurement.
 */
function AuthorRow({
  name,
  selected,
  onPress,
}: {
  name: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors: themeColors } = useTheme();
  return (
    <View style={styles.authorRowWrap}>
      <Pressable
        style={[
          styles.authorRow,
          { borderColor: selected ? themeColors.primary : themeColors.divider },
        ]}
        android_ripple={{ color: withOpacity(themeColors.divider, 0.16) }}
        onPress={onPress}
        accessibilityRole='checkbox'
        accessibilityState={{ checked: selected }}
      >
        <Text
          numberOfLines={1}
          style={[styles.authorName, { color: themeColors.text }]}
        >
          {name}
        </Text>
        <View
          style={[
            styles.bubble,
            {
              borderColor: selected ? themeColors.primary : themeColors.icon,
              backgroundColor: selected ? themeColors.primary : 'transparent',
            },
          ]}
        >
          {selected && <Check size={16} color={themeColors.background} />}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  /*
   * Padding is per-row rather than on the content container — see the sticky
   * overlay note in this file's header.
   */
  listHeader: { paddingHorizontal: screenPadding.horizontal, paddingTop: 8 },
  listFooter: { height: 24 },
  headBase: {
    paddingHorizontal: screenPadding.horizontal,
    paddingTop: 8,
    paddingBottom: 10,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  headTitle: {
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: fontSize.base,
    flexShrink: 1,
    marginRight: 12,
  },
  authorRowWrap: {
    paddingHorizontal: screenPadding.horizontal,
    paddingBottom: 8,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 2,
    borderRadius: 8,
  },
  authorName: {
    fontFamily: 'Rubik',
    fontSize: fontSize.base,
    flex: 1,
    marginRight: 12,
  },
  bubble: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorHeading: {
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: fontSize.sm,
    paddingHorizontal: screenPadding.horizontal,
    paddingTop: 6,
    paddingBottom: 4,
  },
  poolRow: {
    paddingHorizontal: screenPadding.horizontal,
    paddingBottom: 8,
  },
  empty: {
    fontFamily: 'Rubik',
    fontSize: fontSize.base,
    paddingHorizontal: screenPadding.horizontal,
    paddingTop: 24,
    textAlign: 'center',
  },
});
