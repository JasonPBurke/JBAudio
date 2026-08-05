/**
 * THROWAWAY — ticket 15. The editor surface shared by variants E and F.
 *
 * E and F disagree about exactly ONE thing: how you get from "I want to add
 * books" to a set of chosen books.
 *
 *   E  a panel with two steps — pick authors, then pick their books
 *   F  an accordion — tap an author, their books unfold in place, no step
 *
 * Everything around that is identical, so it lives here rather than being
 * copy-pasted. That is not tidiness: the driver's fixes on 2026-08-04 (lock the
 * sort control right, move the remove affordance) have to land on BOTH variants
 * or the A/B is comparing a fixed screen against an unfixed one, which is
 * exactly the confound ticket 15 was warned about when the lineup was chosen.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import Animated, { type AnimatedRef } from 'react-native-reanimated';
import Sortable, { type SortableGridRenderItem } from 'react-native-sortables';
import { ArrowDownWideNarrow, GripVertical, ImagePlus, Plus, Trash2 } from 'lucide-react-native';

import { useTheme } from '@/hooks/useTheme';
import { SeriesBookRow } from '@/components/SeriesBookRow';
import { unknownBookImageUri } from '@/constants/images';
import { fontSize } from '@/constants/tokens';
import { withOpacity } from '@/helpers/colorUtils';
import { compareBookTitles } from '@/helpers/miscellaneous';
import { rippleOf } from './wizardShared';
import { Book } from '@/types/Book';

/** '', '  ' and 'abc' are all "no number" — `decimal-pad` still allows junk. */
export function parseNum(value: string | undefined): number | null {
  const n = parseFloat((value ?? '').trim());
  return Number.isFinite(n) ? n : null;
}

/* --------------------------------------------------------- numbering --- */

/**
 * The driver's numbering rule, and the only one implemented.
 *
 *   · every row's box starts EMPTY;
 *   · `Sort by number` orders by what was typed, and rows left blank fall to
 *     the end, alphabetical among themselves;
 *   · if NOTHING was typed, save assigns 1..n from the final drag order.
 *
 * It needs no cascade machinery and it lands exactly on ticket 07's schema:
 * `canonical_number` is nullable, so blank means null rather than a guess.
 *
 * Note what this makes `Sort by number`: a MANUAL action, not a save-time rule.
 * 07 gave `position` sole sort authority, so what you dragged is what is
 * written — silently re-sorting a hand-dragged list on save would be the app
 * overruling the gesture the whole screen is built around.
 */
export function useNumbering({
  ordered,
  setOrdered,
  titleOf,
}: {
  ordered: string[];
  setOrdered: (keys: string[]) => void;
  titleOf: (key: string) => string;
}) {
  const [numbers, setNumbers] = useState<Record<string, string>>({});

  const setNumber = useCallback((key: string, value: string) => {
    setNumbers((prev) => ({ ...prev, [key]: value }));
  }, []);

  const numberedCount = useMemo(
    () => ordered.filter((k) => parseNum(numbers[k]) !== null).length,
    [ordered, numbers],
  );

  const sortByNumber = useCallback(() => {
    setOrdered(
      [...ordered].sort((a, b) => {
        const av = parseNum(numbers[a]);
        const bv = parseNum(numbers[b]);
        if (av !== null && bv !== null) return av - bv;
        if (av !== null) return -1;
        if (bv !== null) return 1;
        return compareBookTitles(titleOf(a), titleOf(b));
      }),
    );
  }, [ordered, numbers, setOrdered, titleOf]);

  /** The rule in force, as a sentence rather than a tally (no book totals). */
  const numberingNote = useMemo(() => {
    if (ordered.length === 0) return null;
    // Kept to ~36 characters: it shares a row with `Sort by number`, and the
    // first draft ran to 61 and wrapped into it on a 411dp screen.
    if (numberedCount === 0) return 'Numbers set from this order on save.';
    if (numberedCount < ordered.length) return 'Books left blank sort to the end.';
    return null;
  }, [ordered.length, numberedCount]);

  /** Surface the state: the rule is only believable if you see what it made. */
  const buildSaveBody = useCallback(() => {
    const anyNumbered = numberedCount > 0;
    const lines = ordered.map((k, i) => {
      const n = parseNum(numbers[k]);
      const shown = n !== null ? String(n) : anyNumbered ? '—' : String(i + 1);
      return `${shown.padStart(3)}   ${titleOf(k)}`;
    });
    const rule = anyNumbered
      ? 'Blank numbers stay blank (canonical_number = null) and sort to the end.'
      : `Nothing was typed, so numbers are set 1–${ordered.length} from this order.`;
    return `${lines.join('\n')}\n\n${rule}\n\nNothing was written to the database.`;
  }, [ordered, numbers, numberedCount, titleOf]);

  return { numbers, setNumber, numberedCount, sortByNumber, numberingNote, buildSaveBody };
}

/* ------------------------------------------------------- identity row --- */

export function EditorIdentityRow({
  name,
  onChangeName,
  heroUri,
}: {
  name: string;
  onChangeName: (v: string) => void;
  heroUri: string;
}) {
  const { colors: themeColors } = useTheme();
  return (
    <View style={styles.identityRow}>
      {/* Ticket 10's artwork slot: pressable cover + ImagePlus, parity with
          editTitleDetails. */}
      <Pressable
        onPress={() =>
          Alert.alert('Prototype', 'Would open /coverArtSearch for the series.')
        }
        style={styles.coverWrap}
      >
        <FastImage
          source={{ uri: heroUri }}
          style={styles.cover}
          resizeMode={FastImage.resizeMode.cover}
        />
        <View
          style={[
            styles.coverBadge,
            { backgroundColor: withOpacity(themeColors.background, 0.7) },
          ]}
        >
          <ImagePlus size={16} color={themeColors.primary} />
        </View>
      </Pressable>
      <View style={styles.identityFields}>
        <TextInput
          value={name}
          onChangeText={onChangeName}
          placeholder='Series name (required)'
          placeholderTextColor={themeColors.textMuted}
          style={[
            styles.nameInput,
            { color: themeColors.text, borderColor: themeColors.divider },
          ]}
        />
        <Text style={[styles.caption, { color: themeColors.textMuted }]}>
          Cover art follows the first book.
        </Text>
      </View>
    </View>
  );
}

export function useHeroUri(ordered: string[], keyMap: Map<string, Book>) {
  return useMemo(() => {
    const first = ordered[0] ? keyMap.get(ordered[0]) : undefined;
    return first?.artwork ?? unknownBookImageUri;
  }, [ordered, keyMap]);
}

/* -------------------------------------------------------- order list --- */

/**
 * The Order stage: a numbered, draggable list, with the sort control above it.
 *
 * Two driver fixes from 2026-08-04 live here.
 *
 * 1. THE SORT CONTROL IS PINNED RIGHT. The note beside it disappears once every
 *    book is numbered, and with `justify: space-between` the button slid left
 *    into the vacated space — a control that moves when nothing about it
 *    changed. The note's slot is now ALWAYS rendered at `flex: 1`, empty or
 *    not, so the button's position is a property of the row rather than of the
 *    note's content.
 *
 * 2. REMOVE MOVED OUT OF THE ROW'S TAIL. `SeriesBookRow`'s own `onRemove` puts a
 *    `Minus` immediately left of the drag grip, which cost the title horizontal
 *    space AND sat one thumb-width from the handle you are meant to press and
 *    hold. It is now a `Trash2` badge at the card's top-left, over the cover.
 *    `SeriesBookRow` itself is untouched — it is production code shared with the
 *    real editor, and A–D are the comparison record.
 *
 *    The glyph carries its own scrim rather than darkening the artwork, which is
 *    ticket 13's house rule, and it is `textMuted` rather than `danger`: removing
 *    a book from a series does nothing to the book, and N rows of red trash cans
 *    would read as a warning the screen does not mean.
 */
export function OrderedList({
  ordered,
  setOrdered,
  keyMap,
  numbers,
  setNumber,
  onRemove,
  scrollableRef,
  sortByNumber,
  numberedCount,
  numberingNote,
}: {
  ordered: string[];
  setOrdered: (keys: string[]) => void;
  keyMap: Map<string, Book>;
  numbers: Record<string, string>;
  setNumber: (key: string, value: string) => void;
  onRemove: (key: string) => void;
  scrollableRef: AnimatedRef<Animated.ScrollView>;
  sortByNumber: () => void;
  numberedCount: number;
  numberingNote: string | null;
}) {
  const { colors: themeColors } = useTheme();

  const renderSortable = useCallback<SortableGridRenderItem<string>>(
    ({ item: bookKey }) => {
      const book = keyMap.get(bookKey);
      return (
        <View style={styles.numberedRow}>
          {/* Number on the LEFT, empty by default. 10 amended 07 to a nullable
              NUMBER with a `decimal-pad`, because `14b`/`1-3` forced an
              alphabetic keyboard on every edit. Locale trap kept in view:
              `decimal-pad` shows the locale separator, and parseFloat('14,1')
              is 14. */}
          <TextInput
            value={numbers[bookKey] ?? ''}
            onChangeText={(v) => setNumber(bookKey, v)}
            placeholder='#'
            placeholderTextColor={themeColors.textMuted}
            keyboardType='decimal-pad'
            style={[
              styles.numberField,
              { color: themeColors.text, borderColor: themeColors.divider },
            ]}
          />
          <View style={styles.numberedBody}>
            <SeriesBookRow
              context='sortable'
              bookId={book?.bookId}
              title={book?.bookTitle}
              author={book?.author}
              artwork={book?.artwork}
              dragHandle={
                <Sortable.Handle>
                  <GripVertical size={22} color={themeColors.textMuted} />
                </Sortable.Handle>
              }
            />
            <Pressable
              onPress={() => onRemove(bookKey)}
              hitSlop={10}
              style={[
                styles.removeBadge,
                { backgroundColor: withOpacity(themeColors.background, 0.78) },
              ]}
            >
              <Trash2 size={15} color={themeColors.textMuted} />
            </Pressable>
          </View>
        </View>
      );
    },
    [keyMap, numbers, setNumber, onRemove, themeColors],
  );

  return (
    <>
      <View style={styles.sortRow}>
        {/* Always rendered, empty or not — this is what pins the button right. */}
        <View style={styles.sortNoteSlot}>
          {!!numberingNote && (
            <Text style={[styles.sortNote, { color: themeColors.textMuted }]}>
              {numberingNote}
            </Text>
          )}
        </View>
        <Pressable
          onPress={sortByNumber}
          disabled={numberedCount === 0}
          style={[
            styles.sortButton,
            numberedCount === 0 && styles.sortButtonDisabled,
          ]}
          hitSlop={8}
        >
          <ArrowDownWideNarrow
            size={16}
            color={numberedCount > 0 ? themeColors.primary : themeColors.textMuted}
          />
          <Text
            style={[
              styles.sortText,
              {
                color:
                  numberedCount > 0 ? themeColors.primary : themeColors.textMuted,
              },
            ]}
          >
            Sort by number
          </Text>
        </Pressable>
      </View>
      <Sortable.Grid
        columns={1}
        data={ordered}
        renderItem={renderSortable}
        rowGap={8}
        scrollableRef={scrollableRef}
        onDragEnd={({ data }) => setOrdered(data)}
        customHandle
      />
    </>
  );
}

export function AddBooksButton({ onPress }: { onPress: () => void }) {
  const { colors: themeColors } = useTheme();
  return (
    <Pressable
      style={[styles.addButton, { borderColor: themeColors.primary }]}
      android_ripple={rippleOf(themeColors.divider)}
      onPress={onPress}
    >
      <Plus size={18} color={themeColors.primary} />
      <Text style={[styles.addText, { color: themeColors.primary }]}>
        Add books
      </Text>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  identityRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  coverWrap: { width: 88, height: 88, borderRadius: 8, overflow: 'hidden' },
  cover: { width: 88, height: 88 },
  coverBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    borderRadius: 12,
    padding: 4,
  },
  identityFields: { flex: 1, gap: 6 },
  nameInput: {
    fontFamily: 'Rubik',
    fontSize: fontSize.base,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  caption: { fontFamily: 'Rubik', fontSize: 12 },

  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
    marginBottom: 8,
  },
  sortNoteSlot: { flex: 1 },
  sortNote: { fontFamily: 'Rubik', fontSize: 12 },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  sortButtonDisabled: { opacity: 0.4 },
  sortText: { fontFamily: 'Rubik', fontSize: fontSize.sm, fontWeight: '600' },

  numberedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  numberField: {
    width: 46,
    textAlign: 'center',
    fontFamily: 'Rubik',
    fontSize: fontSize.sm,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 9,
  },
  numberedBody: { flex: 1 },
  removeBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    borderRadius: 13,
    padding: 5,
  },

  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  addText: { fontFamily: 'Rubik', fontWeight: '600', fontSize: fontSize.base },
});
