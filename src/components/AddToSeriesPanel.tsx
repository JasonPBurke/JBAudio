/**
 * §F8 — `Add to series…`, the picker.
 *
 * JOIN-ONLY: it lists the series that exist and adds the book to one. There is
 * deliberately NO `New series…` row — book-first stays austere, and creating a
 * series is the editor's job. §F9 has no counterpart here either: removal
 * changes a *series'* membership and the tombstone is series-scoped, so there
 * is no book-first remove.
 *
 * ⚠ IT IS NOT ITS OWN `Modal`. It renders INSIDE `titleDetails`' existing
 * overflow modal, which swaps its content rather than dismissing one modal and
 * presenting another — sequencing two RN modals across a dismissal is the
 * Android black-screen hazard, and there is no reason to take it for a panel
 * that is only ever reached from that menu.
 *
 * ⚠ AND IT IS THEMED, unlike the series line one screen behind it. That is not
 * an inconsistency, it is K9's rule applied in the other direction: this panel
 * paints its own card (`modalBackground`), so its text takes its colour from
 * the theme. The subheading sits on an artwork-derived mesh gradient that the
 * SCREEN painted, so it takes its colour from that surface. Same rule, two
 * surfaces.
 */
import { useMemo, useState } from 'react';
import {
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';

import { fontSize } from '@/constants/tokens';
import { useTheme } from '@/hooks/useTheme';
import { Book } from '@/types/Book';
import { bookStructuralKey } from '@/helpers/bookStructuralKey';
import { useDerivedSeries } from '@/store/seriesStore';
import type { DerivedSeries } from '@/helpers/seriesAssembly';
import { addBookToSeries } from '@/db/seriesQueries';

const AddToSeriesPanel = ({
  book,
  onClose,
}: {
  book: Book;
  onClose: () => void;
}) => {
  const { colors: themeColors } = useTheme();
  const series = useDerivedSeries();
  const [joining, setJoining] = useState<string | null>(null);
  const [frozen, setFrozen] = useState<DerivedSeries[] | null>(null);

  const bookKey = bookStructuralKey(book);

  // A series the book is already in is not something it can join. Membership
  // is resolved by the store, so a tombstoned ("removed") row is NOT a member
  // and its series stays in this list — joining restores the tombstone rather
  // than creating a second row.
  const joinable = useMemo(
    () => series.filter((s) => !s.books.some((b) => b.bookId === book.bookId)),
    [series, book.bookId],
  );

  /*
   * ⚠ THE LIST IS FROZEN WHILE A JOIN IS IN FLIGHT, and this is a DEVICE
   * FINDING (2026-08-13), not caution.
   *
   * This panel is a live view of a list the user's own tap mutates: the write
   * lands, the store re-emits, the series they just joined stops being
   * joinable — and on a one-series library that empties the list. The panel is
   * still mounted for those few frames, so `No series to join.` painted as the
   * last thing on screen before the confirmation, which reads as a FAILURE
   * MESSAGE for the action that just succeeded.
   *
   * Snapshotting on tap rather than suppressing the empty state: the rows must
   * also not shuffle under the spinner.
   */
  const rows = frozen ?? joinable;

  const handleJoin = async (seriesId: string, name: string) => {
    if (!bookKey || joining) return;
    setFrozen(joinable);
    setJoining(seriesId);
    try {
      await addBookToSeries(seriesId, bookKey);
      onClose();
      Alert.alert('Added', `Added to ${name}.`, [{ text: 'OK' }]);
    } catch {
      setJoining(null);
      setFrozen(null);
      Alert.alert(
        'Error',
        'Failed to add this book to the series. Please try again.',
        [{ text: 'OK' }],
      );
    }
  };

  return (
    <Pressable style={styles.overlay} onPress={onClose}>
      {/* Swallows the backdrop press so a tap inside the card never dismisses. */}
      <Pressable
        style={[
          styles.card,
          { backgroundColor: themeColors.modalBackground },
        ]}
        onPress={() => {}}
      >
        <Text style={[styles.heading, { color: themeColors.text }]}>
          Add to series
        </Text>
        {rows.length === 0 || !bookKey ? (
          <Text style={[styles.empty, { color: themeColors.textMuted }]}>
            No series to join.
          </Text>
        ) : (
          <ScrollView
            style={styles.list}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {rows.map((s, index) => (
              <Pressable
                key={s.id}
                onPress={() => handleJoin(s.id, s.name)}
                style={[
                  styles.row,
                  {
                    borderBottomColor: themeColors.divider,
                    borderBottomWidth:
                      index === rows.length - 1 ? 0 : 1,
                  },
                ]}
              >
                <Text
                  style={[styles.rowText, { color: themeColors.text }]}
                  numberOfLines={2}
                >
                  {s.name}
                </Text>
                {joining === s.id ? (
                  <ActivityIndicator
                    size='small'
                    color={themeColors.textMuted}
                  />
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        )}
      </Pressable>
    </Pressable>
  );
};

export default AddToSeriesPanel;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    // A cap, not a height: a two-series library draws a small card and a
    // 28-series one scrolls.
    maxHeight: '70%',
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  heading: {
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: fontSize.sm,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  list: {
    flexGrow: 0,
  },
  empty: {
    fontFamily: 'Rubik',
    fontSize: fontSize.sm,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowText: {
    fontFamily: 'Rubik',
    fontSize: fontSize.sm,
    flex: 1,
  },
});
