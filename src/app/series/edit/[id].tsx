import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from 'expo-router';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import Sortable, {
  type SortableGridRenderItem,
} from 'react-native-sortables';
import { GripVertical, Plus } from 'lucide-react-native';

import { useTheme } from '@/hooks/useTheme';
import { useLibraryStore } from '@/store/library';
import { useDerivedSeries } from '@/store/seriesStore';
import { useSeriesDraftStore } from '@/store/seriesDraftStore';
import { SeriesBookRow } from '@/components/SeriesBookRow';
import { bookStructuralKey } from '@/helpers/bookStructuralKey';
import { deleteSeries, updateSeries } from '@/db/seriesQueries';
import { Book } from '@/types/Book';
import { fontSize, screenPadding } from '@/constants/tokens';

export default function SeriesEdit() {
  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const scrollableRef = useAnimatedRef<Animated.ScrollView>();

  const { id } = useLocalSearchParams<{ id: string }>();

  const allSeries = useDerivedSeries();
  const series = useMemo(
    () => allSeries.find((s) => s.id === id),
    [allSeries, id],
  );

  const name = useSeriesDraftStore((s) => s.name);
  const setName = useSeriesDraftStore((s) => s.setName);
  const orderedBookKeys = useSeriesDraftStore((s) => s.orderedBookKeys);
  const setOrderedKeys = useSeriesDraftStore((s) => s.setOrderedKeys);
  const resetForEdit = useSeriesDraftStore((s) => s.resetForEdit);
  const books = useLibraryStore((state) => state.books);

  const [submitting, setSubmitting] = useState(false);

  // Seed the draft from the series, but ONLY when the draft isn't already an
  // edit-draft for this series. Keying on draft identity (not a per-mount ref)
  // means returning from the "Add books" sub-flow does NOT re-seed and clobber
  // the in-progress draft. The series object identity changes on every store
  // emit, so this effect must be a cheap no-op once seeded.
  useEffect(() => {
    if (!series) return;
    const draft = useSeriesDraftStore.getState();
    if (draft.mode === 'edit' && draft.editingSeriesId === series.id) return;
    const keys = series.books
      .map((b) => bookStructuralKey(b))
      .filter((k): k is string => !!k);
    resetForEdit(series.id, series.name, keys);
  }, [series, resetForEdit]);

  // Reset the draft when this screen is removed by a back action — Android
  // hardware back OR edge-swipe — so discarded edits never resurface on
  // re-open. beforeRemove (a navigation event) is reliable for gestures where
  // React unmount cleanups are not, because native-stack detaches popped
  // screens without tearing them down. It does NOT fire on forward pushes, so
  // the Add-books sub-flow (which pushes on top and pops back) is unaffected.
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', () => {
      useSeriesDraftStore.getState().resetForCreate();
    });
    return unsub;
  }, [navigation]);

  const keyMap = useMemo(() => {
    const m = new Map<string, Book>();
    for (const book of Object.values(books)) {
      const key = bookStructuralKey(book);
      if (key) m.set(key, book);
    }
    return m;
  }, [books]);

  const handleRemove = useCallback(
    (bookKey: string) => {
      setOrderedKeys(orderedBookKeys.filter((k) => k !== bookKey));
    },
    [orderedBookKeys, setOrderedKeys],
  );

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
          onRemove={() => handleRemove(bookKey)}
          dragHandle={
            <Sortable.Handle>
              <GripVertical size={22} color={themeColors.textMuted} />
            </Sortable.Handle>
          }
        />
      );
    },
    [keyMap, themeColors, handleRemove],
  );

  // Pops the whole series group off the root stack. Button paths reset the
  // draft explicitly here because this goes through the PARENT navigator, where
  // the child's beforeRemove may not fire; gesture/hardware back is covered by
  // the beforeRemove listener above.
  const exitGroup = useCallback(() => {
    (navigation.getParent() ?? navigation).goBack();
  }, [navigation]);

  const handleCancel = useCallback(() => {
    useSeriesDraftStore.getState().resetForCreate();
    exitGroup();
  }, [exitGroup]);

  const handleSave = useCallback(async () => {
    if (submitting || !id) return;
    setSubmitting(true);
    try {
      await updateSeries(id, name, orderedBookKeys);
      useSeriesDraftStore.getState().resetForCreate();
      exitGroup();
    } catch (e) {
      console.error('updateSeries failed', e);
      setSubmitting(false);
    }
  }, [submitting, id, name, orderedBookKeys, exitGroup]);

  const handleDelete = useCallback(() => {
    if (!id) return;
    Alert.alert(
      'Delete series?',
      'This removes the series. Your books are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSeries(id);
              useSeriesDraftStore.getState().resetForCreate();
              exitGroup();
            } catch (e) {
              console.error('deleteSeries failed', e);
            }
          },
        },
      ],
    );
  }, [id, exitGroup]);

  const canSave = name.trim().length > 0;

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
          Edit series
        </Text>
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

        <Pressable
          style={[styles.addButton, { borderColor: themeColors.primary }]}
          android_ripple={{ color: themeColors.dividerAlpha16 }}
          onPress={() => router.navigate('/series/create/authors' as any)}
        >
          <Plus size={18} color={themeColors.primary} />
          <Text style={[styles.addText, { color: themeColors.primary }]}>
            Add books
          </Text>
        </Pressable>

        <Pressable
          style={styles.deleteButton}
          onPress={handleDelete}
          hitSlop={8}
        >
          <Text style={[styles.deleteText, { color: themeColors.danger }]}>
            Delete Series
          </Text>
        </Pressable>
      </Animated.ScrollView>

      <View style={[styles.footer, { borderTopColor: themeColors.divider }]}>
        <Pressable
          onPress={handleCancel}
          style={styles.footerButton}
          hitSlop={8}
        >
          <Text style={[styles.cancelText, { color: themeColors.textMuted }]}>
            Cancel
          </Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          disabled={!canSave || submitting}
          style={[
            styles.saveButton,
            {
              backgroundColor: canSave
                ? themeColors.primary
                : themeColors.divider,
              opacity: submitting ? 0.6 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.saveText,
              {
                color: canSave
                  ? themeColors.background
                  : themeColors.textMuted,
              },
            ]}
          >
            Save
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
  listContent: {
    paddingHorizontal: screenPadding.horizontal,
    paddingVertical: 8,
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
