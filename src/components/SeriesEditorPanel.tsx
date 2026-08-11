/**
 * The editor's on-demand book picker — spec §E3/§E4.
 *
 * Two steps, Authors then Books, rendered INLINE on the editor surface where
 * the `+ Add books` button was, so the ordered list you are building stays
 * visible above it and never moves while you pick. That siting is the measured
 * one: committing a selection straight into the list moved 547,334 pixels per
 * tap because the list and the picker share one scroll container, so anything
 * landing above the panel shoves it down the screen. Selections are STAGED in
 * the draft store and only unioned into the list when the step is committed.
 *
 * ⚠ WHAT THIS FILE IS, AND WHAT IT IS NOT. Ticket 12 is structural: it moved
 * the wizard's three pushed screens onto the editor's one route without
 * changing what the editor can do, and this panel is that move. The picker's
 * own ticket (13) owns the rest of §E3/E4/E9/E10/E12 and — the one to know
 * about — **§E13, the shipping requirement neither the prototype nor this file
 * meets**: the candidate pool must become the surface's own virtualized list
 * with everything above it as a header component. Here it is mapped rows inside
 * the editor's `ScrollView`, which is bounded in practice because the author
 * step is a volume reducer (ten authors turns ~350 books into ~50 rows) but is
 * NOT bounded in principle. Do not read its absence as an oversight.
 *
 * `X` and `+ Add books` are inverses (§E4): `X` closes the panel and keeps the
 * editor, always, including when nothing was added. It never abandons the
 * series — that is what `Cancel`, the header chevron and hardware back do, and
 * keeping the two apart is what makes every route out of the screen mean one
 * thing (§E5).
 */
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, X } from 'lucide-react-native';

import { SeriesBookRow } from '@/components/SeriesBookRow';
import { fontSize } from '@/constants/tokens';
import { bookStructuralKey } from '@/helpers/bookStructuralKey';
import { withOpacity } from '@/helpers/colorUtils';
import { compareBookTitles } from '@/helpers/miscellaneous';
import { useTheme } from '@/hooks/useTheme';
import { useLibraryStore } from '@/store/library';
import { useSeriesDraftStore } from '@/store/seriesDraftStore';
import { Book } from '@/types/Book';

/** Which step the panel is showing. `null` means the panel is closed. */
export type PickerStep = 'authors' | 'books';

type PoolRow =
  | { type: 'authorHeading'; key: string; name: string }
  | { type: 'book'; key: string; book: Book; bookKey: string };

export function SeriesEditorPanel({
  step,
  onClose,
}: {
  step: PickerStep;
  onClose: () => void;
}) {
  const { colors: themeColors } = useTheme();

  const authors = useLibraryStore((state) => state.authors);
  const selectedAuthorNames = useSeriesDraftStore(
    (s) => s.selectedAuthorNames,
  );
  const toggleAuthor = useSeriesDraftStore((s) => s.toggleAuthor);
  const selectedBookKeys = useSeriesDraftStore((s) => s.selectedBookKeys);
  const toggleBookKey = useSeriesDraftStore((s) => s.toggleBookKey);

  /*
   * Union of the selected authors' books, grouped by author, each group sorted
   * by title. Books without a structural key are excluded — membership is keyed
   * by that path (ADR 0001), so a book that has none cannot be a member.
   */
  const rows: PoolRow[] = useMemo(() => {
    if (step !== 'books') return [];
    const out: PoolRow[] = [];
    const groups = authors
      .filter((a) => selectedAuthorNames.includes(a.name))
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const group of groups) {
      out.push({
        type: 'authorHeading',
        key: `author-${group.name}`,
        name: group.name,
      });
      const sorted = [...group.books].sort((a, b) =>
        compareBookTitles(a.bookTitle, b.bookTitle),
      );
      for (const book of sorted) {
        const bookKey = bookStructuralKey(book);
        if (!bookKey) continue;
        out.push({ type: 'book', key: bookKey, book, bookKey });
      }
    }
    return out;
  }, [step, authors, selectedAuthorNames]);

  return (
    <View style={[styles.panel, { borderColor: themeColors.primary }]}>
      <View style={styles.head}>
        <Text style={[styles.headTitle, { color: themeColors.text }]}>
          Add books
        </Text>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole='button'
          accessibilityLabel='Close the book picker'
        >
          <X size={20} color={themeColors.textMuted} />
        </Pressable>
      </View>

      {step === 'authors'
        ? authors.map((author) => (
            <AuthorRow
              key={author.name}
              name={author.name}
              selected={selectedAuthorNames.includes(author.name)}
              onPress={() => toggleAuthor(author.name)}
            />
          ))
        : rows.map((row) =>
            row.type === 'authorHeading' ? (
              <Text
                key={row.key}
                style={[styles.authorHeading, { color: themeColors.textMuted }]}
              >
                {row.name}
              </Text>
            ) : (
              <SeriesBookRow
                key={row.key}
                context='selection'
                bookId={row.book.bookId}
                title={row.book.bookTitle}
                author={row.book.author}
                artwork={row.book.artwork}
                selected={selectedBookKeys.includes(row.bookKey)}
                onPress={() => toggleBookKey(row.bookKey)}
              />
            ),
          )}
    </View>
  );
}

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
    <Pressable
      style={[
        styles.authorRow,
        { borderColor: selected ? themeColors.primary : themeColors.divider },
      ]}
      android_ripple={{ color: withOpacity(themeColors.divider, 0.16) }}
      onPress={onPress}
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
  );
}

/** The step-appropriate instruction, shown in the editor's header. */
export function pickerSubtitle(step: PickerStep): string {
  return step === 'authors'
    ? 'Whose books are in this series?'
    : 'Tap the books that belong in it.';
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 16,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    gap: 8,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  headTitle: {
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: fontSize.base,
    flexShrink: 1,
    marginRight: 12,
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
    marginTop: 6,
  },
});
