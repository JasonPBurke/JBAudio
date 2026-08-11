/**
 * The Series create/edit route — spec §E1/E5/E8/E11, §C2, §J.
 *
 * ONE ROUTE SERVES BOTH. `id` present is an edit, `id` absent is a create, and
 * that single parameter is the only thing that differs between the two passes.
 * The wizard's three pushed screens are gone: its Authors and Books steps are a
 * panel on this surface (`SeriesEditorPanel`), and its Order step is the list
 * this screen already had. §E8's "book picker shared between create and edit"
 * problem therefore DISSOLVED rather than being solved — there is nothing left
 * to share it between.
 *
 * ── Why a root `transparentModal`, and why that is not a re-litigation ─────
 *
 * §E11: the presentation ruling that closed the wizard bought FULL-SCREEN
 * OPAQUE CONTENT WITH A SAVE/CANCEL FOOTER, not a slide. This screen is still
 * exactly that. Only the transition and the route's parent change, and both
 * were forced by measurement (§J1): the opaque push is the only presentation
 * that misbehaves over a live sheet — it presents fine and returns with scroll
 * offset pixel-exact, but popping the group reveals the LIBRARY for ~165ms and
 * the detail sheet then RE-PRESENTS with a full slide-up. Since the sheet is a
 * root sibling (§C2, forced: a screen inside a group cannot be a root-level
 * sheet), the editor has to be one too or it cannot sit above it.
 *
 * ── Back is Cancel, and it is true by construction ────────────────────────
 *
 * §E5: the header chevron, the hardware/gesture back and the footer's `Cancel`
 * all do the same thing — leave the editor. None of them steps back through the
 * panel. There is no `BackHandler` here doing that work: a root route has
 * nothing to step back THROUGH, so back pops the editor and lands on whatever
 * launched it (the library for a create, the detail sheet for an edit). §J2 is
 * what makes that safe — the old `series` group owned no store lifetime, every
 * draft reset lives on a screen, so moving off it orphaned nothing and
 * `exitGroup()` collapses to a plain back-navigation.
 *
 * A stage-walking version was built and REJECTED: it made one gesture mean
 * "undo one step" three times and then "abandon everything" on the fourth, with
 * nothing on screen marking which press you were on.
 *
 * ── The background is themed, deliberately (§K5.2) ────────────────────────
 *
 * The route's `contentStyle` is set in `_layout.tsx`. This screen paints
 * `themeColors.background` too, so the two agree in both themes and no frame
 * between them can flash white. ⚠ The book editor — the `transparentModal` this
 * one is "matching" — hardcodes `#2c2c2cdc`. Do not copy that literal; see the
 * comment on the `Stack.Screen`.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import Sortable, {
  type SortableGridRenderItem,
} from 'react-native-sortables';
import { ChevronLeft, GripVertical, Plus } from 'lucide-react-native';

import {
  SeriesEditorPanel,
  pickerSubtitle,
  type PickerStep,
} from '@/components/SeriesEditorPanel';
import { SeriesBookRow } from '@/components/SeriesBookRow';
import { fontSize, screenPadding } from '@/constants/tokens';
import { createSeries, deleteSeries, updateSeries } from '@/db/seriesQueries';
import { bookStructuralKey } from '@/helpers/bookStructuralKey';
import { SeriesNameConflictError } from '@/helpers/seriesName';
import {
  duplicateNameIssue,
  seriesAuthorStepIssues,
  seriesEditorIssues,
  seriesPickerBookIssues,
} from '@/helpers/seriesValidation';
import { useTheme } from '@/hooks/useTheme';
import { useLibraryStore } from '@/store/library';
import { useSeriesDraftStore } from '@/store/seriesDraftStore';
import { useDerivedSeries } from '@/store/seriesStore';
import { Book } from '@/types/Book';

export default function SeriesEditorRoute() {
  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const scrollableRef = useAnimatedRef<Animated.ScrollView>();

  /** Absent = create. The route parameter is the mode. */
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editingSeriesId = id || undefined;

  const allSeries = useDerivedSeries();
  const series = useMemo(
    () => allSeries.find((s) => s.id === editingSeriesId),
    [allSeries, editingSeriesId],
  );

  const name = useSeriesDraftStore((s) => s.name);
  const setName = useSeriesDraftStore((s) => s.setName);
  const orderedBookKeys = useSeriesDraftStore((s) => s.orderedBookKeys);
  const setOrderedKeys = useSeriesDraftStore((s) => s.setOrderedKeys);
  const appendBookKeys = useSeriesDraftStore((s) => s.appendBookKeys);
  const beginPicker = useSeriesDraftStore((s) => s.beginPicker);
  const selectedAuthorNames = useSeriesDraftStore((s) => s.selectedAuthorNames);
  const selectedBookKeys = useSeriesDraftStore((s) => s.selectedBookKeys);
  const books = useLibraryStore((state) => state.books);

  /*
   * A create opens ON the picker — a fresh create has nothing to order, so an
   * editor with an empty list and a button would be a screen whose only move is
   * the one it made you find. An edit opens on the list, which is what you came
   * for. §E6's empty state is therefore reached by pressing `X` on a fresh
   * create, which is exactly the state that only became reachable once `X`
   * stopped abandoning the series.
   */
  const [panel, setPanel] = useState<PickerStep | null>(
    editingSeriesId ? null : 'authors',
  );
  const [submitting, setSubmitting] = useState(false);

  /*
   * Seed the draft ONCE per presentation.
   *
   * The old edit screen keyed this on draft identity instead, because the
   * Add-books sub-flow pushed two screens on top of it and returning must not
   * re-seed over an in-progress draft. That flow is gone — the picker is a
   * panel on this same route now — so the screen can no longer be re-entered
   * mid-draft, and a per-mount ref says exactly that. Edit mode still waits for
   * the store to resolve the id, and still checks the draft's own identity, so
   * a dev fast-refresh does not clobber typing either.
   */
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    const draft = useSeriesDraftStore.getState();

    if (!editingSeriesId) {
      draft.resetForCreate();
      seeded.current = true;
      return;
    }
    if (!series) return;
    if (draft.mode === 'edit' && draft.editingSeriesId === series.id) {
      seeded.current = true;
      return;
    }
    const keys = series.books
      .map((b) => bookStructuralKey(b))
      .filter((k): k is string => !!k);
    draft.resetForEdit(series.id, series.name, keys);
    seeded.current = true;
  }, [editingSeriesId, series]);

  /*
   * Reset the draft whenever this screen is removed — the footer buttons,
   * hardware back and the edge-swipe gesture alike. `beforeRemove` is a
   * navigation event, which is reliable for gestures where React unmount
   * cleanups are not: the native stack detaches popped screens without tearing
   * them down. Since the editor is a ROOT route with nothing pushed on top of
   * it, this is now the only reset that has to exist — there is no forward push
   * that could fire it by mistake.
   */
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

  /* ------------------------------------------------------- the routes out --- */

  /** §E5 — the chevron, hardware back and `Cancel` are ONE behaviour. */
  const leaveEditor = useCallback(() => {
    useSeriesDraftStore.getState().resetForCreate();
    router.back();
  }, [router]);

  /* ------------------------------------------------------------- the panel --- */

  const openPicker = useCallback(() => {
    beginPicker();
    setPanel('authors');
  }, [beginPicker]);

  /** §E4 — `X` closes the panel onto the editor and never abandons the series. */
  const closePicker = useCallback(() => setPanel(null), []);

  /* ---------------------------------------------------------- save / delete --- */

  const issues = useMemo(
    () =>
      seriesEditorIssues({
        name,
        series: allSeries,
        bookCount: orderedBookKeys.length,
        editingSeriesId,
      }),
    [name, allSeries, orderedBookKeys.length, editingSeriesId],
  );

  const handleSave = useCallback(async () => {
    if (submitting) return;
    if (issues.length > 0) {
      Alert.alert("Can't save", issues.join('\n'));
      return;
    }
    setSubmitting(true);
    try {
      if (editingSeriesId) await updateSeries(editingSeriesId, name, orderedBookKeys);
      else await createSeries(name, orderedBookKeys);
      useSeriesDraftStore.getState().resetForCreate();
      router.back();
    } catch (e) {
      setSubmitting(false);
      // The name was validated against the store; a conflict here means the
      // library changed under us. Say so and leave the user on the field.
      if (e instanceof SeriesNameConflictError) {
        Alert.alert("Can't save", duplicateNameIssue(e.conflictingName));
        return;
      }
      console.error(editingSeriesId ? 'updateSeries failed' : 'createSeries failed', e);
    }
  }, [submitting, issues, editingSeriesId, name, orderedBookKeys, router]);

  /*
   * ⚠ THE DELETE EXIT IS STILL WRONG, KNOWINGLY (§K7). It pops onto the detail
   * sheet of the series it just deleted. That sheet no longer renders white —
   * the route carries a themed background and a grab handle — but the
   * destination is still a screen for something that no longer exists, and
   * popping PAST it belongs to the detection-aware save/delete ticket, which
   * also owns making this write a suppression row rather than a bare delete.
   * Ticket 12 is routing surgery and deliberately changes nothing here.
   */
  const handleDelete = useCallback(() => {
    if (!editingSeriesId) return;
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
              await deleteSeries(editingSeriesId);
              useSeriesDraftStore.getState().resetForCreate();
              router.back();
            } catch (e) {
              console.error('deleteSeries failed', e);
            }
          },
        },
      ],
    );
  }, [editingSeriesId, router]);

  /* ------------------------------------------------------------ the footer --- */

  /*
   * One footer, whose right button commits whatever stage is on screen. The
   * panel's own steps cannot carry it: the pool runs to tens of rows, so an
   * inline `Next` would be below the fold on every pass.
   */
  const commitLabel =
    panel === 'authors' ? 'Next' : panel === 'books' ? 'Done' : 'Save';

  const commitActive =
    panel === 'authors'
      ? selectedAuthorNames.length > 0
      : panel === 'books'
        ? selectedBookKeys.length > 0
        : issues.length === 0;

  /*
   * The inactive button stays PRESSABLE, deliberately and as it always has: a
   * greyed-out button that does nothing gives the user no way to find out what
   * is missing, so pressing it names the problem.
   */
  const handleCommit = useCallback(() => {
    if (panel === 'authors') {
      const stepIssues = seriesAuthorStepIssues(selectedAuthorNames);
      if (stepIssues.length > 0) {
        Alert.alert("Can't continue", stepIssues.join('\n'));
        return;
      }
      setPanel('books');
      return;
    }
    if (panel === 'books') {
      const stepIssues = seriesPickerBookIssues(selectedBookKeys);
      if (stepIssues.length > 0) {
        Alert.alert("Can't continue", stepIssues.join('\n'));
        return;
      }
      appendBookKeys(selectedBookKeys);
      setPanel(null);
      return;
    }
    void handleSave();
  }, [panel, selectedAuthorNames, selectedBookKeys, appendBookKeys, handleSave]);

  /* -------------------------------------------------------------- rendering --- */

  const subtitle =
    panel !== null
      ? pickerSubtitle(panel)
      : orderedBookKeys.length === 0
        ? // §E6. Only reachable since `X` stopped abandoning the series: before
          // that, a closed panel implied at least one book.
          'Add books to get started.'
        : 'Drag the handles to put the books in series order.';

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
      <View style={[styles.header, { borderBottomColor: themeColors.divider }]}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={leaveEditor}
            hitSlop={12}
            accessibilityRole='button'
            accessibilityLabel='Cancel'
          >
            <ChevronLeft size={26} color={themeColors.text} />
          </Pressable>
          <Text
            numberOfLines={1}
            style={[styles.title, { color: themeColors.text }]}
          >
            {editingSeriesId ? 'Edit series' : 'New series'}
          </Text>
        </View>
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
        <Text style={[styles.instruction, { color: themeColors.textMuted }]}>
          {subtitle}
        </Text>
      </View>

      <Animated.ScrollView
        ref={scrollableRef}
        style={styles.scroll}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps='handled'
      >
        {/* Not rendered empty: a create starts with no books, and a sortable
            over an empty list is a drag surface for nothing. */}
        {orderedBookKeys.length > 0 && (
          <Sortable.Grid
            columns={1}
            data={orderedBookKeys}
            renderItem={renderItem}
            rowGap={8}
            scrollableRef={scrollableRef}
            onDragEnd={({ data }) => setOrderedKeys(data)}
            customHandle
          />
        )}

        {panel === null ? (
          <Pressable
            style={[styles.addButton, { borderColor: themeColors.primary }]}
            android_ripple={{ color: themeColors.dividerAlpha16 }}
            onPress={openPicker}
          >
            <Plus size={18} color={themeColors.primary} />
            <Text style={[styles.addText, { color: themeColors.primary }]}>
              Add books
            </Text>
          </Pressable>
        ) : (
          <SeriesEditorPanel step={panel} onClose={closePicker} />
        )}

        {/* §E9 — Delete is a function of editing something, so it is absent
            from the create pass. It is also hidden while the picker is open:
            a destructive action does not belong under a list you are adding
            to, and the app's convention is absent rather than disabled. */}
        {!!editingSeriesId && panel === null && (
          <Pressable
            style={styles.deleteButton}
            onPress={handleDelete}
            hitSlop={8}
          >
            <Text style={[styles.deleteText, { color: themeColors.danger }]}>
              Delete Series
            </Text>
          </Pressable>
        )}
      </Animated.ScrollView>

      <View style={[styles.footer, { borderTopColor: themeColors.divider }]}>
        <Pressable
          onPress={leaveEditor}
          style={styles.footerButton}
          hitSlop={8}
        >
          <Text style={[styles.cancelText, { color: themeColors.textMuted }]}>
            Cancel
          </Text>
        </Pressable>
        <Pressable
          onPress={handleCommit}
          disabled={submitting}
          style={[
            styles.saveButton,
            {
              backgroundColor: commitActive
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
                color: commitActive
                  ? themeColors.background
                  : themeColors.textMuted,
              },
            ]}
          >
            {commitLabel}
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
    paddingBottom: 10,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: {
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: fontSize.lg,
    flexShrink: 1,
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
  scroll: { flex: 1 },
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
