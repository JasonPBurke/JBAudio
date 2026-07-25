import React, { useCallback, useMemo } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '@/hooks/useTheme';
import { useLibraryStore } from '@/store/library';
import { useSeriesDraftStore } from '@/store/seriesDraftStore';
import { SeriesBookRow } from '@/components/SeriesBookRow';
import { bookStructuralKey } from '@/helpers/bookStructuralKey';
import { compareBookTitles } from '@/helpers/miscellaneous';
import { Book } from '@/types/Book';
import { fontSize, screenPadding } from '@/constants/tokens';

type Row =
  | { type: 'authorHeading'; key: string; name: string }
  | { type: 'book'; key: string; book: Book; bookKey: string };

export default function SeriesCreateBooks() {
  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const authors = useLibraryStore((state) => state.authors);
  const selectedAuthorNames = useSeriesDraftStore(
    (s) => s.selectedAuthorNames,
  );
  const name = useSeriesDraftStore((s) => s.name);
  const setName = useSeriesDraftStore((s) => s.setName);
  const selectedBookKeys = useSeriesDraftStore((s) => s.selectedBookKeys);
  const toggleBookKey = useSeriesDraftStore((s) => s.toggleBookKey);
  const setOrderedKeys = useSeriesDraftStore((s) => s.setOrderedKeys);
  const appendBookKeys = useSeriesDraftStore((s) => s.appendBookKeys);
  const mode = useSeriesDraftStore((s) => s.mode);
  const editingSeriesId = useSeriesDraftStore((s) => s.editingSeriesId);
  const isEdit = mode === 'edit';

  // Union of the selected authors' books, grouped by author (author subheading),
  // each group sorted by title. Books without a structural key are excluded.
  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
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
  }, [authors, selectedAuthorNames]);

  const canProceed = isEdit
    ? selectedBookKeys.length > 0
    : name.trim().length > 0 && selectedBookKeys.length > 0;

  const handleNext = useCallback(() => {
    if (isEdit) {
      // Add-books sub-flow: append the selection (additive; removals happen on
      // the edit screen) and return to the already-mounted edit screen.
      appendBookKeys(selectedBookKeys);
      router.navigate(`/series/edit/${editingSeriesId}` as any);
      return;
    }
    // Create flow: seed the order step in display order (author-grouped).
    const ordered = rows
      .filter((r) => r.type === 'book' && selectedBookKeys.includes(r.bookKey))
      .map((r) => (r as Extract<Row, { type: 'book' }>).bookKey);
    setOrderedKeys(ordered);
    router.navigate('/series/create/order' as any);
  }, [
    isEdit,
    appendBookKeys,
    editingSeriesId,
    rows,
    selectedBookKeys,
    setOrderedKeys,
    router,
  ]);

  const renderItem = useCallback(
    ({ item }: { item: Row }) => {
      if (item.type === 'authorHeading') {
        return (
          <Text
            style={[styles.authorHeading, { color: themeColors.textMuted }]}
          >
            {item.name}
          </Text>
        );
      }
      return (
        <SeriesBookRow
          context='selection'
          bookId={item.book.bookId}
          title={item.book.bookTitle}
          author={item.book.author}
          artwork={item.book.artwork}
          selected={selectedBookKeys.includes(item.bookKey)}
          onPress={() => toggleBookKey(item.bookKey)}
        />
      );
    },
    [selectedBookKeys, themeColors, toggleBookKey],
  );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: themeColors.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: themeColors.text }]}>
          {isEdit ? 'Add books' : 'Name & select books'}
        </Text>
        {!isEdit && (
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
        )}
        <Text style={[styles.instruction, { color: themeColors.textMuted }]}>
          {isEdit
            ? 'Tap books to add to this series.'
            : 'Tap the books that belong in this series.'}
        </Text>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      <View style={[styles.footer, { borderTopColor: themeColors.divider }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.footerButton}
          hitSlop={8}
        >
          <Text style={[styles.backText, { color: themeColors.textMuted }]}>
            Back
          </Text>
        </Pressable>
        <Pressable
          onPress={handleNext}
          disabled={!canProceed}
          style={[
            styles.nextButton,
            {
              backgroundColor: canProceed
                ? themeColors.primary
                : themeColors.divider,
            },
          ]}
        >
          <Text
            style={[
              styles.nextText,
              {
                color: canProceed
                  ? themeColors.background
                  : themeColors.textMuted,
              },
            ]}
          >
            {isEdit ? 'Done' : 'Next'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: screenPadding.horizontal,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  title: {
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: fontSize.lg,
  },
  nameInput: {
    fontFamily: 'Rubik',
    fontSize: fontSize.base,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  instruction: {
    fontFamily: 'Rubik',
    fontSize: fontSize.sm,
  },
  listContent: {
    paddingHorizontal: screenPadding.horizontal,
    paddingVertical: 8,
  },
  authorHeading: {
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: fontSize.sm,
    marginTop: 14,
    marginBottom: 6,
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
  backText: { fontFamily: 'Rubik', fontSize: fontSize.base },
  nextButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  nextText: {
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: fontSize.base,
  },
});
