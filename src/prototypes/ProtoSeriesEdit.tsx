/**
 * THROWAWAY — Series UX redesign prototype harness (ticket 10). See ./README.md.
 *
 * The series EDIT screen, reached from the `Fix this series` row on
 * `ProtoSeriesDetail`. Ticket 10 settled that correction *is* this screen
 * ("editor only", driver 2026-08-03), so what is left to judge is what the
 * screen has to grow to hold everything correction now owes:
 *
 *   1. SERIES ARTWORK — a pressable cover + `ImagePlus` badge beside the name,
 *      mirroring `editTitleDetails.tsx:157-186`, which is the app's ONLY entry
 *      point to `/coverArtSearch`. The open question is whether it fits here at
 *      all; if it does not, the override moves to the detail screen's ⋮ menu
 *      and breaks parity with how a book's cover works.
 *   2. CANONICAL NUMBER per row — ticket 07 ruled the override must exist and
 *      deliberately declined to site it. This is the proposed site.
 *   3. `Sort by number` — ticket 07 considered and declined this action purely
 *      because it had nowhere to live. It now has somewhere.
 *
 * FIDELITY CAVEATS, so nothing is read into them:
 *   - A `Modal`, not a route — same caveat as `ProtoSeriesDetail`. Says nothing
 *     about push-vs-sheet.
 *   - Rows do NOT drag. The grip is drawn so the row's width budget is honest,
 *     but `react-native-sortables` is not wired: ticket 10 is judging what fits
 *     in a row, and the real screen's drag already works and is device-verified.
 *   - Nothing is written to the database, per the harness rule. `Save`, `Cancel`,
 *     `Add books` and `Delete Series` are inert.
 */
import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowUpDown,
  GripVertical,
  ImagePlus,
  Minus,
  Plus,
} from 'lucide-react-native';

import { unknownBookImageUri } from '@/constants/images';
import { fontSize, screenPadding } from '@/constants/tokens';
import { useTheme } from '@/hooks/useTheme';
import { withOpacity } from '@/helpers/colorUtils';
import { Book } from '@/types/Book';
import type { DerivedSeries } from '@/helpers/seriesAssembly';
import type { ProtoSeries } from './syntheticSeries';
import { useProtoStore } from './protoStore';
import { bookCoverShape, fitInBox } from './seriesFacts';

/**
 * The series artwork box. 88 because it is the largest square that leaves the
 * name field a usable width at `screenPadding.horizontal` on a 411dp phone —
 * the thing this prototype exists to let the driver eyeball.
 */
const COVER_BOX = 88;

/**
 * Width of the canonical-number field. Sized for `12.5` and `14b`, not for `8`:
 * ticket 07 made this a STRING that legitimately holds decimals, letter
 * suffixes and ranges (`1-3`), so the common one-digit case is not the case to
 * fit.
 */
const NUMBER_FIELD_WIDTH = 52;

const ROW_COVER_BOX = 56;

type EditRow = {
  /** Stable across reorders; synthetic data repeats books, so bookId is not unique. */
  key: string;
  book: Book;
  /** Free text, NOT a number — see `keyboardType` below. */
  canonical: string;
};

function buildRows(series: DerivedSeries): EditRow[] {
  const numbers = (series as ProtoSeries).canonicalNumbers ?? [];
  return series.books.map((book, index) => ({
    key: `${book.bookId}-${index}`,
    book,
    canonical: numbers[index] === null || numbers[index] === undefined
      ? ''
      : String(numbers[index]),
  }));
}

/**
 * Ticket 03's ordering rule, in memory: `CAST(sequence AS FLOAT) NULLS LAST`.
 * Unparseable and blank both sort last, and ties keep their current relative
 * order (Array.prototype.sort is stable) so a partially-numbered series does
 * not shuffle its unnumbered tail.
 */
function sortByCanonical(rows: EditRow[]): EditRow[] {
  return [...rows].sort((a, b) => {
    const av = parseFloat(a.canonical);
    const bv = parseFloat(b.canonical);
    const aBad = Number.isNaN(av);
    const bBad = Number.isNaN(bv);
    if (aBad && bBad) return 0;
    if (aBad) return 1;
    if (bBad) return -1;
    return av - bv;
  });
}

const ProtoSeriesEdit = ({
  series,
  onClose,
}: {
  series: DerivedSeries;
  onClose: () => void;
}) => {
  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState(series.name);
  const [rows, setRows] = useState<EditRow[]>(() => buildRows(series));

  const pinned = useProtoStore((s) => s.pinnedSeries[series.id] ?? false);
  const setPinned = useProtoStore((s) => s.setPinned);

  /**
   * Ticket 08 ruled series art DERIVES from the first book and FOLLOWS a
   * reorder. Reading it off `rows[0]` rather than off the series is what makes
   * that visible: `Sort by number` can change the cover in the header, live.
   * An override FREEZES this — the thing ticket 10 found reads like a bug, and
   * ticket 11 answered with the caption below.
   *
   * Stand-in only: schema v33 is unbuilt and the harness writes nothing, so a
   * pin is a boolean in `protoStore` drawn as the series' LAST book's cover.
   * It has to be a visibly different cover, or an override cannot be told apart
   * from the derived art.
   */
  const coverShape = useMemo(() => {
    if (pinned && rows.length > 0) return bookCoverShape(rows[rows.length - 1].book);
    return rows[0] ? bookCoverShape(rows[0].book) : null;
  }, [rows, pinned]);

  /*
   * THE UN-PIN GAP NOBODY HAD NAMED (ticket 11). Once `series.artwork` is
   * non-null it stays non-null forever — the cover control can only ever set
   * it, so a user who pins by accident has no way back to the derived art. One
   * caption fixes it by being three things at once: an INDICATOR that art is
   * pinned (10 asked for exactly that after `Sort by number` silently changed
   * the cover), an EXPLANATION of where the art comes from otherwise, and the
   * ESCAPE HATCH itself.
   *
   * The real implementation's revert must also DELETE the pinned file, or it
   * leaks into the orphan pile `orphaned-artwork-files-never-cleaned` already
   * tracks.
   */
  const togglePin = useCallback(
    () => setPinned(series.id, !pinned),
    [series.id, pinned, setPinned],
  );

  const canSort = useMemo(
    () => rows.some((r) => !Number.isNaN(parseFloat(r.canonical))),
    [rows],
  );

  const handleSort = useCallback(() => setRows((prev) => sortByCanonical(prev)), []);

  const handleNumberChange = useCallback((key: string, value: string) => {
    // Deliberately does NOT resort. Ticket 07: `position` is the sole sort
    // authority and canonical only *seeds* it — so typing a number must not
    // move the row out from under the cursor. Reordering is the explicit
    // `Sort by number` action and nothing else.
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, canonical: value } : r)),
    );
  }, []);

  const handleRemove = useCallback((key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }, []);

  return (
    <Modal visible animationType='slide' onRequestClose={onClose} statusBarTranslucent>
      <View
        style={[
          styles.screen,
          {
            backgroundColor: themeColors.background,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.screenTitle, { color: themeColors.text }]}>
            Edit series
          </Text>

          <View style={styles.identityRow}>
            {/*
              Parity with editTitleDetails: the artwork IS the button, badged
              with ImagePlus on a 70%-opacity chip. No separate "change art"
              control — the app has no such control for books either.
            */}
            <View style={styles.coverColumn}>
              <Pressable
                style={[styles.coverBox, { borderColor: themeColors.divider }]}
                android_ripple={{ color: withOpacity(themeColors.divider, 0.16) }}
                accessibilityLabel='Change series artwork'
                // Stands in for `/coverArtSearch`, which ticket 10 ruled this
                // control opens — the app's only entry point to it is
                // `editTitleDetails.tsx:78`, i.e. inside the edit form.
                onPress={() => setPinned(series.id, true)}
              >
                {coverShape && (
                  <FastImage
                    source={{
                      uri: coverShape.uri ?? unknownBookImageUri,
                      priority: FastImage.priority.normal,
                      cache: FastImage.cacheControl.immutable,
                    }}
                    style={fitInBox(coverShape, COVER_BOX)}
                    resizeMode={FastImage.resizeMode.cover}
                  />
                )}
                <View
                  style={[
                    styles.coverBadge,
                    { backgroundColor: withOpacity(themeColors.background, 0.7) },
                  ]}
                >
                  <ImagePlus
                    size={16}
                    color={themeColors.textMuted}
                    strokeWidth={1.5}
                  />
                </View>
              </Pressable>

              {/*
                Two states, one element. Derived: a muted statement of fact, not
                a control — there is nothing to revert to. Pinned: a pressable
                that says what pressing it DOES rather than naming its own state
                ("Pinned" would be an indicator that leaves the escape hatch
                unbuilt, which is the gap 11 found).
              */}
              {pinned ? (
                <Pressable
                  onPress={togglePin}
                  hitSlop={6}
                  style={styles.coverCaptionButton}
                  accessibilityLabel='Use first book’s cover instead'
                >
                  <Text
                    style={[styles.coverCaption, { color: themeColors.primary }]}
                  >
                    Use first book’s cover instead
                  </Text>
                </Pressable>
              ) : (
                <Text
                  style={[styles.coverCaption, { color: themeColors.textMuted }]}
                >
                  Using first book’s cover
                </Text>
              )}
            </View>

            <View style={styles.identityText}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder='Series name (required)'
                placeholderTextColor={themeColors.textMuted}
                style={[
                  styles.nameInput,
                  { color: themeColors.text, borderColor: themeColors.divider },
                ]}
              />
              <Pressable
                onPress={handleSort}
                disabled={!canSort}
                style={[styles.sortButton, { opacity: canSort ? 1 : 0.4 }]}
                android_ripple={{
                  color: withOpacity(themeColors.divider, 0.16),
                }}
              >
                <ArrowUpDown size={15} color={themeColors.primary} />
                <Text style={[styles.sortLabel, { color: themeColors.primary }]}>
                  Sort by number
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps='handled'
        >
          {rows.map((row) => (
            <EditBookRow
              key={row.key}
              row={row}
              onNumberChange={handleNumberChange}
              onRemove={handleRemove}
            />
          ))}

          <Pressable
            style={[styles.addButton, { borderColor: themeColors.primary }]}
            android_ripple={{ color: withOpacity(themeColors.divider, 0.16) }}
          >
            <Plus size={18} color={themeColors.primary} />
            <Text style={[styles.addText, { color: themeColors.primary }]}>
              Add books
            </Text>
          </Pressable>

          <Pressable style={styles.deleteButton} hitSlop={8}>
            <Text style={[styles.deleteText, { color: themeColors.danger }]}>
              Delete Series
            </Text>
          </Pressable>
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: themeColors.divider }]}>
          <Pressable onPress={onClose} style={styles.footerButton} hitSlop={8}>
            <Text style={[styles.cancelText, { color: themeColors.textMuted }]}>
              Cancel
            </Text>
          </Pressable>
          <Pressable
            onPress={onClose}
            style={[styles.saveButton, { backgroundColor: themeColors.primary }]}
          >
            <Text style={[styles.saveText, { color: themeColors.background }]}>
              Save
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const EditBookRow = memo(function EditBookRow({
  row,
  onNumberChange,
  onRemove,
}: {
  row: EditRow;
  onNumberChange: (key: string, value: string) => void;
  onRemove: (key: string) => void;
}) {
  const { colors: themeColors } = useTheme();
  const shape = bookCoverShape(row.book);

  return (
    <View style={styles.row}>
      {/*
        `decimal-pad`, settled by the driver 2026-08-04 — which AMENDS ticket 07.
        07 made `canonical_number` a string to hold `12.5`, `14b` and `1-3`, but
        Android's numeric input types exclude letters, so honouring that string
        meant a full alphabetic keyboard on a mostly-numeric field. The driver
        dropped the letter forms instead (`14b` is rare and renames to `14.1`),
        which makes every value float-parseable and the column a nullable NUMBER.
        Ranges are the real casualty: an omnibus of 1–3 now carries one number.

        TRAP for the implementation: `decimal-pad` renders the LOCALE's decimal
        separator, so a comma-decimal user types `14,1` and `parseFloat` returns
        14 — silently. Normalise the separator before parsing.
      */}
      <TextInput
        value={row.canonical}
        keyboardType='decimal-pad'
        onChangeText={(v) => onNumberChange(row.key, v)}
        placeholder='#'
        placeholderTextColor={withOpacity(themeColors.textMuted, 0.5)}
        style={[
          styles.numberInput,
          { color: themeColors.text, borderColor: themeColors.divider },
        ]}
        accessibilityLabel={`Number for ${row.book.bookTitle}`}
      />

      <View style={styles.rowCoverBox}>
        <FastImage
          source={{
            uri: row.book.artwork ?? unknownBookImageUri,
            priority: FastImage.priority.low,
            cache: FastImage.cacheControl.immutable,
          }}
          style={[styles.rowCover, fitInBox(shape, ROW_COVER_BOX)]}
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

      <Pressable
        onPress={() => onRemove(row.key)}
        hitSlop={8}
        style={styles.remove}
      >
        <Minus size={20} color={themeColors.textMuted} />
      </Pressable>
      <GripVertical size={22} color={themeColors.textMuted} />
    </View>
  );
});

export default memo(ProtoSeriesEdit);

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: screenPadding.horizontal,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 12,
  },
  screenTitle: {
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: fontSize.lg,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  coverColumn: {
    width: COVER_BOX,
    gap: 6,
  },
  coverCaption: {
    fontFamily: 'Rubik',
    fontSize: 10,
    lineHeight: 13,
  },
  coverCaptionButton: {
    paddingVertical: 2,
  },
  coverBox: {
    width: COVER_BOX,
    height: COVER_BOX,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  coverBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    borderRadius: 10,
    padding: 4,
  },
  identityText: {
    flex: 1,
    gap: 6,
  },
  nameInput: {
    fontFamily: 'Rubik',
    fontSize: fontSize.base,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  sortLabel: {
    fontFamily: 'Rubik',
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: screenPadding.horizontal,
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
    paddingVertical: 6,
  },
  numberInput: {
    width: NUMBER_FIELD_WIDTH,
    fontFamily: 'Rubik',
    fontSize: fontSize.sm,
    textAlign: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  rowCoverBox: {
    width: ROW_COVER_BOX,
    height: ROW_COVER_BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCover: { borderRadius: 4 },
  rowText: { flex: 1 },
  rowTitle: {
    fontFamily: 'Rubik',
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  rowAuthor: {
    fontFamily: 'Rubik',
    fontSize: 13,
    marginTop: 2,
  },
  remove: { padding: 2 },
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
  addText: {
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: fontSize.base,
  },
  deleteButton: {
    alignItems: 'center',
    marginTop: 28,
    paddingVertical: 12,
  },
  deleteText: {
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: fontSize.base,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenPadding.horizontal,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerButton: { paddingVertical: 12, paddingHorizontal: 8 },
  cancelText: { fontFamily: 'Rubik', fontSize: fontSize.base },
  saveButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  saveText: {
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: fontSize.base,
  },
});
