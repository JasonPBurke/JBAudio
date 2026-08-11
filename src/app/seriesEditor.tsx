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
  PixelRatio,
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
import {
  ArrowDownWideNarrow,
  ChevronLeft,
  GripVertical,
  ListOrdered,
  Plus,
  Trash2,
} from 'lucide-react-native';

import { SeriesEditorPanel } from '@/components/SeriesEditorPanel';
import { SeriesBookRow } from '@/components/SeriesBookRow';
import { fontSize, screenPadding } from '@/constants/tokens';
import { createSeries, deleteSeries, updateSeries } from '@/db/seriesQueries';
import { bookStructuralKey } from '@/helpers/bookStructuralKey';
import { withOpacity } from '@/helpers/colorUtils';
import {
  disabledControlColors,
  disabledTextColor,
} from '@/helpers/controlColors';
import {
  numberFieldWidth,
  sortRowIsStacked,
} from '@/helpers/seriesEditorGeometry';
import {
  canBulkNumber,
  orderByCanonicalNumber,
  parseCanonicalNumber,
  resolveNumbersForSave,
} from '@/helpers/seriesNumbering';
import {
  pickerSubtitle,
  type PickerStep,
} from '@/helpers/seriesPickerRows';
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

/**
 * One row of the ordered list: the canonical-number box, the shared book row,
 * and the remove badge.
 *
 * ── Why this is its own component ─────────────────────────────────────────
 *
 * It subscribes to ITS OWN number out of the draft store. Reading the whole
 * `numbersByKey` map in the screen and passing a value down would re-render
 * every row on every keystroke, in a list that runs to 41 books on the real
 * library. Here a keystroke re-renders exactly the row being typed into.
 *
 * ── Why it wraps `SeriesBookRow` instead of extending it (ticket 15) ──────
 *
 * `SeriesBookRow` is production code shared with the picker, and the wizard
 * prototype's ruling was explicit that it stays UNTOUCHED — the variants wrap
 * it. Both of this row's additions are therefore siblings, not props:
 *
 *  - the number box sits LEFT of the row, the geometry the driver A/B'd on
 *    device on 2026-08-04;
 *  - remove is a `Trash2` badge at the card's top-left over the cover, moved
 *    off the row's tail. That move is not cosmetic here: the number box takes
 *    ~54dp off the row's left, and vacating the tail is what pays for it.
 *    Titles gained enough that `Discworld 04 - Mort` fits whole.
 *
 * Two sub-decisions inside that, flagged as judgment rather than spec: the
 * glyph carries its OWN SCRIM rather than darkening the artwork (ticket 13's
 * house rule), and it is `textMuted`, NOT `danger` — removing a book from a
 * series does nothing to the book, and N rows of red trash cans would read as
 * a warning the screen does not mean.
 */
const NumberedBookRow = React.memo(function NumberedBookRow({
  bookKey,
  book,
  onRemove,
}: {
  bookKey: string;
  book?: Book;
  onRemove: () => void;
}) {
  const { colors: themeColors } = useTheme();
  const value = useSeriesDraftStore((s) => s.numbersByKey[bookKey] ?? '');
  const setNumber = useSeriesDraftStore((s) => s.setNumber);

  return (
    <View style={styles.numberedRow}>
      {/*
        §D3 — `decimal-pad`, and NOTHING here resorts the list. `position` keeps
        sole sort authority precisely so a row cannot move out from under the
        cursor mid-edit; re-seeding order is `Sort by number`, a manual act.

        ⚠ K3 — this keypad renders the LOCALE's decimal separator, so a
        comma-decimal user types `14,1`. The raw text is stored raw and
        normalised at the parse (`parseCanonicalNumber`), never on keystroke,
        or the separator their keyboard offered would be rewritten under them.
      */}
      <TextInput
        value={value}
        onChangeText={(next) => setNumber(bookKey, next)}
        placeholder='#'
        placeholderTextColor={themeColors.textMuted}
        keyboardType='decimal-pad'
        // The caret and selection carry the accent, as every other editable
        // field in the app does (`editTitleDetails`' seven fields, `SearchBar`,
        // `coverArtSearch`). The plain-`primary` variant is the form-field one;
        // the two SEARCH fields use `withOpacity(primary, 0.56)` instead.
        cursorColor={themeColors.primary}
        selectionColor={themeColors.primary}
        accessibilityLabel={`Number for ${book?.bookTitle ?? 'this book'}`}
        style={[
          styles.numberField,
          {
            color: themeColors.text,
            borderColor: themeColors.divider,
            // DEVICE-FOUND at font scale 2.0: a fixed 46dp box CLIPPED `4.5`
            // — the `4`'s diagonal cut off flat. The box has to scale with the
            // text it holds, or the number is the one thing a user who raised
            // their font scale cannot read.
            width: numberFieldWidth(PixelRatio.getFontScale()),
          },
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
          onPress={onRemove}
          hitSlop={10}
          accessibilityRole='button'
          accessibilityLabel={`Remove ${book?.bookTitle ?? 'this book'}`}
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
});

export default function SeriesEditorRoute() {
  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const scrollableRef = useAnimatedRef<Animated.ScrollView>();

  /** Absent = create. The route parameter is the mode. */
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editingSeriesId = id || undefined;

  /**
   * K15 — one disabled treatment for every control on this surface, in two
   * shapes. A FILLED control's grey fill signals "off" by itself, so its label
   * is free to be legible; a BARE TEXT control has only its label, so that
   * label has to carry the signal and must sit below body text.
   */
  const disabledColors = useMemo(
    () => disabledControlColors(themeColors),
    [themeColors],
  );
  const disabledLabel = useMemo(
    () => disabledTextColor(themeColors),
    [themeColors],
  );

  /** DEVICE-FOUND at 2.0 — see `seriesEditorGeometry`. */
  const stackSortRow = sortRowIsStacked(PixelRatio.getFontScale());

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
  const numbersByKey = useSeriesDraftStore((s) => s.numbersByKey);
  const setNumbers = useSeriesDraftStore((s) => s.setNumbers);
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
    /*
     * Seed the boxes from the stored numbers. `canonicalNumbers` is
     * INDEX-ALIGNED with `books`, so the number is read at the book's own
     * index — never from a separately-filtered array, which would badge every
     * later book with its neighbour's number.
     *
     * Formatted with a `.` regardless of locale. A comma-decimal user sees
     * `14.1` in a box whose keypad offers `,`; typing over it works either way
     * because K3's parse accepts both, and rendering the separator per-locale
     * would mean carrying a locale into a pure draft for a cosmetic gain.
     */
    const seededNumbers: Record<string, string> = {};
    series.books.forEach((book, index) => {
      const key = bookStructuralKey(book);
      const number = series.canonicalNumbers[index];
      if (key && number != null) seededNumbers[key] = String(number);
    });
    draft.resetForEdit(series.id, series.name, keys, seededNumbers);
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
    ({ item: bookKey }) => (
      <NumberedBookRow
        bookKey={bookKey}
        book={keyMap.get(bookKey)}
        onRemove={() => handleRemove(bookKey)}
      />
    ),
    // Deliberately NOT dependent on `numbersByKey`: each row subscribes to its
    // own number, so typing must not rebuild this callback and re-render the
    // whole list under the cursor.
    [keyMap, handleRemove],
  );

  /* ------------------------------------------------------------ numbering --- */

  /**
   * The list's numbers, parsed, in the list's own drag order. Everything the
   * numbering controls decide is a function of this one array.
   */
  const parsedNumbers = useMemo(
    () => orderedBookKeys.map((key) => parseCanonicalNumber(numbersByKey[key])),
    [orderedBookKeys, numbersByKey],
  );

  /** §D4 — disabled when nothing is numbered; there is no order to seed from. */
  const canSortByNumber = parsedNumbers.some((n) => n !== null);
  /** §D5 — open only on a fully-unnumbered series. */
  const bulkNumberAvailable = canBulkNumber(parsedNumbers);

  /**
   * §D4 — re-seed `position` from the numbers, on demand and never on a
   * keystroke. §D10 is a KNOWN and specified consequence: this silently
   * changes the series cover, because artwork derives from the first book and
   * follows a reorder. That is the behaviour, not a bug — and the argument for
   * siting the artwork override on this same screen (ticket 15).
   */
  const handleSortByNumber = useCallback(() => {
    setOrderedKeys(
      orderByCanonicalNumber(orderedBookKeys, (key) =>
        parseCanonicalNumber(numbersByKey[key]),
      ),
    );
  }, [orderedBookKeys, numbersByKey, setOrderedKeys]);

  /**
   * §D5 — number `1..n` from the current drag order. Calls the same function
   * the save path does, so pressing this is exactly "do now what save would
   * have done", and it is a no-op rather than a bulk destroy if it is ever
   * reached with the gate shut.
   */
  const handleBulkNumber = useCallback(() => {
    const next = resolveNumbersForSave(parsedNumbers);
    const filled: Record<string, string> = {};
    orderedBookKeys.forEach((key, index) => {
      const number = next[index];
      if (number != null) filled[key] = String(number);
    });
    setNumbers(filled);
  }, [orderedBookKeys, parsedNumbers, setNumbers]);

  /*
   * ONE ordered list, rendered into whichever container is on screen — the
   * ScrollView when the panel is closed, the panel's list header when it is
   * open. Building it here rather than twice is what keeps the two states the
   * same list: same rows, same drag, same identity.
   *
   * Not rendered empty: a create starts with no books, and a sortable over an
   * empty list is a drag surface for nothing.
   *
   * ⚠ `scrollableRef` is the ScrollView's, so it is only passed while that
   * ScrollView is the container. Auto-scroll-while-dragging is a ScrollView
   * feature and the picker's list is not one; handing it a detached ref would
   * scroll nothing. Dragging itself still works in both states.
   */
  const orderedList =
    orderedBookKeys.length > 0 ? (
      <Sortable.Grid
        columns={1}
        data={orderedBookKeys}
        renderItem={renderItem}
        rowGap={8}
        scrollableRef={panel === null ? scrollableRef : undefined}
        onDragEnd={({ data }) => setOrderedKeys(data)}
        customHandle
      />
    ) : null;

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
      /*
       * §E7 — an untouched list is numbered `1..n` from its FINAL DRAG ORDER
       * AT SAVE. Resolved here, at the last possible moment, because "final"
       * is the whole point: the order is whatever the last drag left behind.
       * Once anything is numbered the rule stops and blanks stay blank.
       */
      const canonicalNumbers = resolveNumbersForSave(parsedNumbers);
      if (editingSeriesId)
        await updateSeries(editingSeriesId, name, orderedBookKeys, canonicalNumbers);
      else await createSeries(name, orderedBookKeys, canonicalNumbers);
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
  }, [
    submitting,
    issues,
    editingSeriesId,
    name,
    orderedBookKeys,
    parsedNumbers,
    router,
  ]);

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
          // Same convention. This field predates ticket 14 and was missing it
          // too — fixed here rather than left as the one field on the screen
          // with a default-blue caret beside an accent-coloured one.
          cursorColor={themeColors.primary}
          selectionColor={themeColors.primary}
          style={[
            styles.nameInput,
            { color: themeColors.text, borderColor: themeColors.divider },
          ]}
        />
        <Text style={[styles.instruction, { color: themeColors.textMuted }]}>
          {subtitle}
        </Text>

        {/*
          §D4 — `Sort by number` SITS BESIDE THE NAME FIELD, in the header
          rather than in the list, so a control that acts on the whole list is
          not something you have to scroll to find. Absent while the picker is
          open: it acts on the ordered list, and the ordered list is not what
          you are looking at.

          ⚠ THE LEFT SLOT IS ALWAYS RENDERED AT `flex: 1`, EMPTY OR NOT. That
          is what pins the button right. With `space-between` the button slid
          left into the space the note vacated once every book was numbered — a
          control moving when nothing about it had changed. Measured at 0
          differing pixels in the button's bounding box between slot-full and
          slot-empty, comparing like enablement with like.
        */}
        {panel === null && orderedBookKeys.length > 0 && (
          <View style={[styles.sortRow, stackSortRow && styles.sortRowStacked]}>
            <View style={stackSortRow ? styles.sortSlotStacked : styles.sortSlot}>
              {bulkNumberAvailable ? (
                /* §D5 — a pure create, gated to a zero-numbered series. It
                   lives in the note's slot rather than beside the sort button
                   because the two are EXACT OPPOSITES and can never both be
                   actionable: this is enabled only when nothing is numbered,
                   and `Sort by number` only when something is. */
                <Pressable
                  onPress={handleBulkNumber}
                  hitSlop={8}
                  accessibilityRole='button'
                  style={styles.slotButton}
                >
                  <ListOrdered size={16} color={themeColors.primary} />
                  <Text
                    numberOfLines={1}
                    style={[styles.slotText, { color: themeColors.primary }]}
                  >
                    Number 1–{orderedBookKeys.length}
                  </Text>
                </Pressable>
              ) : canSortByNumber &&
                parsedNumbers.some((n) => n === null) ? (
                <Text
                  numberOfLines={2}
                  style={[styles.sortNote, { color: themeColors.textMuted }]}
                >
                  Books left blank sort to the end.
                </Text>
              ) : null}
            </View>
            {/*
              ⚠ K15 — DISABLED IS A COLOUR CHANGE, NEVER AN OPACITY. The
              prototype dimmed this to `opacity: 0.4`, which is the same defect
              in a different costume: it drags the label toward its own
              background instead of away from it. Accent → muted reads as
              inactive and keeps full contrast against the screen.
            */}
            <Pressable
              onPress={handleSortByNumber}
              disabled={!canSortByNumber}
              hitSlop={8}
              accessibilityRole='button'
              accessibilityState={{ disabled: !canSortByNumber }}
              style={styles.sortButton}
            >
              <ArrowDownWideNarrow
                size={16}
                color={canSortByNumber ? themeColors.primary : disabledLabel}
              />
              <Text
                style={[
                  styles.sortText,
                  {
                    color: canSortByNumber
                      ? themeColors.primary
                      : disabledLabel,
                  },
                ]}
              >
                Sort by number
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {/*
        §E13 — WHICH SCROLL CONTAINER OWNS THE SURFACE DEPENDS ON THE PANEL.
        Closed, the ordered list is the screen and lives in a ScrollView that
        `Sortable.Grid` can auto-scroll while you drag. Open, the candidate
        pool is the screen: the panel's own virtualized list takes over and
        the ordered list rides above it as the header component, which is the
        only arrangement where a 350-book pool does not mount 350 rows.
        Nothing about the flow changes — the list is in the same place on
        screen, showing the same rows, and still never moves while you pick.
      */}
      {panel === null ? (
        <Animated.ScrollView
          ref={scrollableRef}
          style={styles.scroll}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps='handled'
        >
          {orderedList}

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

          {/* §E9 — Delete is a function of editing something, so it is absent
              from the create pass. It is also absent while the picker is open,
              which the container swap now makes structural: a destructive
              action does not belong under a list you are adding to, and the
              app's convention is absent rather than disabled. */}
          {!!editingSeriesId && (
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
      ) : (
        <SeriesEditorPanel
          step={panel}
          onClose={closePicker}
          listHeader={orderedList}
        />
      )}

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
              // K15 — the inactive fill was `divider` and its label was
              // `textMuted`, which in the dark palette are the SAME `#d8dee9`:
              // the label was drawn in its own background, measured 1.00:1.
              // Light was 2.98:1, under AA too, which is why this was never
              // the dark-theme-only defect it was filed as.
              backgroundColor: commitActive ? themeColors.primary : disabledColors.fill,
              opacity: submitting ? 0.6 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.saveText,
              {
                color: commitActive ? themeColors.background : disabledColors.label,
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
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  /**
   * DEVICE-FOUND at font scale 2.0: side by side, `Number 1–6` truncated to
   * `Number..` and lost the count that is the whole point of the label. Each
   * control gets its own line instead, and the sort button stays right-aligned
   * on its line — ticket 15's decision is about the NOTE's content moving the
   * button, which the flex:1 slot still guarantees at every scale.
   */
  sortRowStacked: { flexDirection: 'column', alignItems: 'stretch', gap: 4 },
  /** Always rendered, empty or not — this is what pins the button right. */
  sortSlot: { flex: 1 },
  sortSlotStacked: { width: '100%' },
  sortNote: { fontFamily: 'Rubik', fontSize: 12 },
  slotButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  slotText: {
    fontFamily: 'Rubik',
    fontSize: fontSize.sm,
    fontWeight: '600',
    flexShrink: 1,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    paddingVertical: 6,
  },
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
  /** Top-LEFT, over the cover, carrying its own scrim (ticket 13's house rule). */
  removeBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    borderRadius: 13,
    padding: 5,
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
