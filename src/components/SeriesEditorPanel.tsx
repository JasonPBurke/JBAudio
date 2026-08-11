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
        case 'authorPair':
          return (
            <AuthorPairRow
              left={item.left}
              right={item.right}
              selected={selection.authors}
              onToggle={toggleAuthor}
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
 * One row of §E14's grid: two cells, or one cell and a held-open gap.
 *
 * The gap is a real view rather than nothing. Under `space-between`, a row with
 * a single child centres it — so a trailing odd author would sit in the middle
 * of the screen at full width, which reads as a different kind of row rather
 * than as the last cell of a grid.
 */
function AuthorPairRow({
  left,
  right,
  selected,
  onToggle,
}: {
  left: string;
  right: string | null;
  selected: Set<string>;
  onToggle: (name: string) => void;
}) {
  return (
    <View style={styles.authorPairRow}>
      <AuthorCell
        name={left}
        selected={selected.has(left)}
        onPress={() => onToggle(left)}
      />
      {right === null ? (
        <View style={styles.authorCellGap} />
      ) : (
        <AuthorCell
          name={right}
          selected={selected.has(right)}
          onPress={() => onToggle(right)}
        />
      )}
    </View>
  );
}

/**
 * §E14's author cell — 13px, ~50dp pitch, and a 14px CORNER check rather than
 * the 26dp bubble this row carried when ticket 12 lifted it from the deleted
 * `series/create/authors.tsx`. The metrics are the ones driven on device on
 * 2026-08-04 against a 100-author pool (~18–20 authors per screen); they are
 * transcribed from the prototype, not re-derived.
 *
 * The check is small BUT NOT ABSENT: dropping it would leave the selected state
 * signalled by border colour alone, which is a colour-only state. It is
 * signalled three ways — border, 12% tint, glyph.
 *
 * ⚠ THE FILLED TICK STAYS, and this cell keeps it. Ticket 07 flagged the
 * construct — accent fill with the glyph knocked out in `themeColors.background`
 * — as a light-theme item on that same deleted screen, and fixed the Series
 * Detection card's checkbox the other way round: accent tint, accent glyph. The
 * tint idiom was built here and REVERTED on measurement, on the driver's real
 * light theme, at three accents:
 *
 *   accent                 fill + knockout    tint + accent glyph
 *   auto teal (measured)        2.82:1               2.43:1
 *   amber #FFB606               1.53:1               1.41:1
 *   a dark accent               6.91:1               5.43:1
 *
 * The tint is WORSE at every accent, and both track the user's colour rather
 * than the design — which is the reading the driver already ruled on in 09,
 * withdrawing an accent-contrast finding for exactly this reason. Do not
 * re-swap this without a new measurement.
 *
 * ⚠ The 13 is a deliberate literal. `fontSize` is `xs:12 · sm:16 · base:20 ·
 * lg:24`, so nothing below 16 exists to use. Do not token-ise it — a similar
 * literal was once "corrected" upward as an oversight and the driver reverted
 * it (§E14).
 */
function AuthorCell({
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
    <Pressable
      style={[
        styles.authorCell,
        selected
          ? {
              borderWidth: 1.5,
              borderColor: themeColors.primary,
              backgroundColor: withOpacity(themeColors.primary, 0.12),
            }
          : { borderWidth: 1, borderColor: themeColors.divider },
      ]}
      android_ripple={{ color: withOpacity(themeColors.divider, 0.16) }}
      onPress={onPress}
      accessibilityRole='checkbox'
      accessibilityState={{ checked: selected }}
    >
      <Text
        numberOfLines={2}
        style={[
          styles.authorCellText,
          { color: selected ? themeColors.primary : themeColors.text },
        ]}
      >
        {name}
      </Text>
      {selected && (
        <View
          style={[styles.authorCheck, { backgroundColor: themeColors.primary }]}
        >
          <Check size={9} color={themeColors.background} strokeWidth={3.5} />
        </View>
      )}
    </Pressable>
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
  /*
   * The 8dp gap below is the grid's row gap. With `minHeight: 42` plus the
   * cell's border it makes the ~50dp pitch §E14 measured — the number that
   * turns 100 authors into ~5 screens instead of ~13.
   */
  authorPairRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: screenPadding.horizontal,
    paddingBottom: 8,
  },
  authorCell: {
    width: '48.5%',
    minHeight: 42,
    justifyContent: 'center',
    paddingVertical: 7,
    paddingLeft: 10,
    // Asymmetric on purpose: the right inset is the corner check's berth, so a
    // two-line name never runs under it.
    paddingRight: 20,
    borderRadius: 7,
    // Clips the Android ripple to the rounded corners.
    overflow: 'hidden',
  },
  /** Holds the second column open on a trailing odd author. */
  authorCellGap: { width: '48.5%' },
  authorCellText: { fontFamily: 'Rubik', fontSize: 13, lineHeight: 16 },
  authorCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
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
