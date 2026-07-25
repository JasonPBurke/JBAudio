import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRouter } from 'expo-router';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import Sortable, {
  type SortableGridRenderItem,
} from 'react-native-sortables';
import { GripVertical } from 'lucide-react-native';

import { useTheme } from '@/hooks/useTheme';
import { useLibraryStore } from '@/store/library';
import { useSeriesDraftStore } from '@/store/seriesDraftStore';
import { SeriesBookRow } from '@/components/SeriesBookRow';
import { bookStructuralKey } from '@/helpers/bookStructuralKey';
import { createSeries } from '@/db/seriesQueries';
import { Book } from '@/types/Book';
import { fontSize, screenPadding } from '@/constants/tokens';

export default function SeriesCreateOrder() {
  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const scrollableRef = useAnimatedRef<Animated.ScrollView>();

  const name = useSeriesDraftStore((s) => s.name);
  const orderedBookKeys = useSeriesDraftStore((s) => s.orderedBookKeys);
  const setOrderedKeys = useSeriesDraftStore((s) => s.setOrderedKeys);
  const resetForCreate = useSeriesDraftStore((s) => s.resetForCreate);
  const books = useLibraryStore((state) => state.books);

  const [submitting, setSubmitting] = useState(false);

  // Resolve structural keys → live book for display.
  const keyMap = useMemo(() => {
    const m = new Map<string, Book>();
    for (const book of Object.values(books)) {
      const key = bookStructuralKey(book);
      if (key) m.set(key, book);
    }
    return m;
  }, [books]);

  const renderItem = useCallback<SortableGridRenderItem<string>>(
    ({ item: bookKey }) => {
      const book = keyMap.get(bookKey);
      return (
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
      );
    },
    [keyMap, themeColors],
  );

  const handleCreate = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await createSeries(name, orderedBookKeys);
      resetForCreate();
      // Pop the whole series group off the root stack, revealing the library
      // with its Series toggle intact.
      (navigation.getParent() ?? navigation).goBack();
    } catch (e) {
      console.error('createSeries failed', e);
      setSubmitting(false);
    }
  }, [submitting, name, orderedBookKeys, resetForCreate, navigation]);

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
          {name || 'New Series'}
        </Text>
        <Text style={[styles.instruction, { color: themeColors.textMuted }]}>
          Drag the handles to put the books in series order.
        </Text>
      </View>

      <Animated.ScrollView
        ref={scrollableRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        <Sortable.Grid
          columns={1}
          data={orderedBookKeys}
          renderItem={renderItem}
          rowGap={8}
          scrollableRef={scrollableRef}
          onDragEnd={({ data }) => setOrderedKeys(data)}
          customHandle
        />
      </Animated.ScrollView>

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
          onPress={handleCreate}
          disabled={submitting}
          style={[
            styles.createButton,
            { backgroundColor: themeColors.primary, opacity: submitting ? 0.6 : 1 },
          ]}
        >
          <Text style={[styles.createText, { color: themeColors.background }]}>
            Create Series
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
    gap: 6,
  },
  title: {
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: fontSize.lg,
  },
  instruction: {
    fontFamily: 'Rubik',
    fontSize: fontSize.sm,
  },
  listContent: {
    paddingHorizontal: screenPadding.horizontal,
    paddingVertical: 8,
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
  createButton: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 8,
  },
  createText: {
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: fontSize.base,
  },
});
