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
import { StackActions } from '@react-navigation/native';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import FastImage from '@d11/react-native-fast-image';
import Sortable, {
  type SortableGridRenderItem,
} from 'react-native-sortables';
import {
  ArrowDownWideNarrow,
  ChevronLeft,
  GripVertical,
  ImagePlus,
  ListOrdered,
  Plus,
  Trash2,
} from 'lucide-react-native';

import { SeriesEditorPanel } from '@/components/SeriesEditorPanel';
import { SeriesBookRow } from '@/components/SeriesBookRow';
import { unknownBookImageUri } from '@/constants/images';
import { fontSize, screenPadding } from '@/constants/tokens';
import {
  clearSeriesArtwork,
  createSeries,
  deleteSeries,
  loadRememberedNumbers,
  updateSeries,
} from '@/db/seriesQueries';
import { bookStructuralKey } from '@/helpers/bookStructuralKey';
import { withOpacity } from '@/helpers/colorUtils';
import {
  disabledControlColors,
  disabledTextColor,
} from '@/helpers/controlColors';
import {
  editorCoverShape,
  seriesArtworkCaption,
  sharedAuthorName,
} from '@/helpers/seriesArtwork';
import type { DerivedSeries } from '@/helpers/seriesAssembly';
import {
  COVER_BOX_SIZE,
  identityRowIsStacked,
  numberFieldWidth,
  sortRowIsStacked,
} from '@/helpers/seriesEditorGeometry';
import { popCountAfterSeriesDelete } from '@/helpers/seriesNavigation';
import { fitInBox } from '@/helpers/seriesRowGeometry';
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

/**
 * The series cover control — spec §D6, §D7, §D10.
 *
 * A pressable cover with an add-image badge, and a caption under it. Both
 * mirror the book editor (`editTitleDetails.tsx`), which is the app's ONLY
 * entry point to cover-art search: the artwork IS the button, badged with
 * `ImagePlus` on a 70%-opacity chip. There is no separate "change art" row,
 * for books or for series.
 *
 * ── Why it lives beside the name field, and not on the detail sheet ───────
 *
 * §D10. `Sort by number` silently changes a derived cover — artwork follows
 * the first book, and re-sorting moves which book that is. That reads like a
 * bug and is not, so the override sits on the one screen where you watch it
 * happen: re-sort, see the cover change, pin it if you disagree. Which is also
 * why the preview reads the LIVE DRAG ORDER rather than the saved series.
 *
 * ── The caption does indicator, explanation and escape hatch at once ──────
 *
 * §D7, and the two states are not a state and its negation — see
 * `seriesArtworkCaption`. Words rather than a pin badge: a badge tells you the
 * state and gives you nothing to press, so reverting would need a second,
 * undiscoverable affordance.
 *
 * The pressable state carries the accent and the muted state does not, which
 * is `Sort by number`'s convention on this same header — accent means there is
 * something here to press.
 */
const SeriesCoverControl = React.memo(function SeriesCoverControl({
  artwork,
  firstBook,
  stacked,
  onPress,
  onRevert,
}: {
  artwork: string | null;
  /** The first book IN THE CURRENT DRAG ORDER — see §D10 above. */
  firstBook?: Book;
  /** §D6 — the column becomes a row past the font-scale threshold. */
  stacked: boolean;
  onPress: () => void;
  onRevert: () => void;
}) {
  const { colors: themeColors } = useTheme();
  const shape = editorCoverShape(artwork, firstBook);
  const caption = seriesArtworkCaption(artwork);

  const box = (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: themeColors.dividerAlpha16 }}
      accessibilityRole='button'
      accessibilityLabel='Change series artwork'
      style={[styles.coverBox, { borderColor: themeColors.divider }]}
    >
      <FastImage
        source={{
          uri: shape.uri ?? unknownBookImageUri,
          priority: FastImage.priority.normal,
          cache: FastImage.cacheControl.immutable,
        }}
        // Sized to the artwork's own proportions inside a constant square box,
        // so a tall cover leaves background either side rather than being
        // stretched — the same rule the browse fan's layers use.
        style={fitInBox(shape, COVER_BOX_SIZE)}
        resizeMode={FastImage.resizeMode.cover}
      />
      <View
        style={[
          styles.coverBadge,
          { backgroundColor: withOpacity(themeColors.background, 0.7) },
        ]}
      >
        <ImagePlus size={16} color={themeColors.textMuted} strokeWidth={1.5} />
      </View>
    </Pressable>
  );

  const captionNode = caption.reverts ? (
    <Pressable
      onPress={onRevert}
      // The caption is the smallest type on the screen AND a target, so the
      // slop is what makes it a real one: ~30dp of text becomes ~54dp of
      // touchable, past Android's 48dp minimum.
      hitSlop={12}
      accessibilityRole='button'
      accessibilityLabel={caption.text}
      style={styles.coverCaptionButton}
    >
      <Text style={[styles.coverCaption, { color: themeColors.primary }]}>
        {caption.text}
      </Text>
    </Pressable>
  ) : (
    <Text style={[styles.coverCaption, { color: themeColors.textMuted }]}>
      {caption.text}
    </Text>
  );

  return stacked ? (
    <View style={styles.coverRow}>
      {box}
      <View style={styles.coverCaptionWide}>{captionNode}</View>
    </View>
  ) : (
    <View style={styles.coverColumn}>
      {box}
      {captionNode}
    </View>
  );
});

/**
 * ⚠ THE VISIBLE UNIVERSE — every book this screen is able to put on screen, and
 * therefore every book the user is able to remove.
 *
 * `assembleDerivedSeries` SKIPS membership rows whose key does not resolve
 * against the live library, and `scanLibrary` documents those dangling rows as
 * a deliberate, expected state (its prune is gated on finding an orphan, so a
 * row whose file merely moved legitimately sits there). Such a book is not in
 * `series.books`, so it can never be in the drag order either — and a save that
 * inferred "removed" from that absence would tombstone it permanently.
 *
 * So `Save` hands this to `updateSeries` alongside the drag order, and both are
 * read from HERE, through one function, so the two cannot come to disagree
 * about what the screen could see.
 */
function visibleKeysOf(series: DerivedSeries): string[] {
  return series.books
    .map((b) => bookStructuralKey(b))
    .filter((k): k is string => !!k);
}

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
  /** §D6 — the cover column becomes a cover row at the same threshold. */
  const stackIdentityRow = identityRowIsStacked(PixelRatio.getFontScale());

  const allSeries = useDerivedSeries();
  const series = useMemo(
    () => allSeries.find((s) => s.id === editingSeriesId),
    [allSeries, editingSeriesId],
  );

  const name = useSeriesDraftStore((s) => s.name);
  const setName = useSeriesDraftStore((s) => s.setName);
  const orderedBookKeys = useSeriesDraftStore((s) => s.orderedBookKeys);
  const setOrderedKeys = useSeriesDraftStore((s) => s.setOrderedKeys);
  const commitPickerSelection = useSeriesDraftStore(
    (s) => s.commitPickerSelection,
  );
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

  /*
   * ⚠ WHAT THE SCREEN COULD SEE, FROZEN AT THE MOMENT IT WAS SEEDED — the
   * universe `Save` is allowed to remove from, and the input that stops
   * `planEditorSave` reading a dangling row's absence as a removal.
   *
   * Frozen, not re-read at save time, because `series` is LIVE and a scan
   * landing mid-edit would otherwise corrupt the answer in both directions: a
   * book whose moved file came back would re-enter `series.books` without ever
   * entering the draft, and get tombstoned for never having been in a list it
   * was never offered to; and a book the user just removed could leave
   * `series.books` under them, so their removal would be silently dropped. The
   * question is what the user was shown, and that was decided once.
   */
  const visibleAtSeed = useRef<string[] | null>(null);

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
      visibleAtSeed.current = visibleKeysOf(series);
      seeded.current = true;
      return;
    }
    const keys = visibleKeysOf(series);
    // ⚠ THE SAME ARRAY the drag order is seeded from, kept so `Save` can tell a
    // removal from a row nobody could have removed. Captured rather than re-read
    // for the reason the seed itself is captured — see `visibleAtSeed`.
    visibleAtSeed.current = keys;
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

  /*
   * A11 — what this series remembers about books it is not showing, i.e. the
   * numbers sitting on its tombstones. Read ONCE per presentation, into a ref
   * rather than state: nothing renders it, it only fills a box at the moment a
   * removed book is put back, and a re-render on arrival would be churn.
   *
   * DEVICE-FOUND (2026-08-13): without this, removing a book and re-adding it
   * silently cleared its canonical number — the box came back blank and Save
   * wrote the blank over the stored value.
   */
  const rememberedNumbers = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!editingSeriesId) return;
    let live = true;
    loadRememberedNumbers(editingSeriesId)
      .then((map) => {
        if (live) rememberedNumbers.current = map;
      })
      .catch((e) => console.error('loadRememberedNumbers failed', e));
    return () => {
      live = false;
    };
  }, [editingSeriesId]);

  const keyMap = useMemo(() => {
    const m = new Map<string, Book>();
    for (const book of Object.values(books)) {
      const key = bookStructuralKey(book);
      if (key) m.set(key, book);
    }
    return m;
  }, [books]);

  /**
   * The draft's books, in the order they are currently dragged into.
   *
   * §D10 — the cover control's derived preview reads `[0]` from HERE and not
   * from `series.books`, which is the saved order. Pressing `Sort by number`
   * changes the derived cover, and the whole reason the override sits on this
   * screen is that you get to watch that happen.
   */
  const orderedBooks = useMemo(
    () =>
      orderedBookKeys
        .map((key) => keyMap.get(key))
        .filter((book): book is Book => !!book),
    [orderedBookKeys, keyMap],
  );

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

  /**
   * §K7 — the exit a DELETION takes, which is not the exit an edit takes.
   *
   * A plain `back()` lands on the detail sheet of the series that no longer
   * exists: the route resolves nothing and renders its empty state, which
   * before ticket 12 was a full-screen white sheet. So the editor pops past it
   * — and how far past is READ OFF THE STACK rather than hardcoded to two,
   * because a create has no sheet under it and §F's `titleDetails` series line
   * will put a book's own sheet under the series one, which is not this
   * deletion's to throw away.
   *
   * ⚠ ONE BUTTON REACHES THIS, and briefly two did. An emptying `Save` was
   * also a deletion, and it landed on exactly the dead sheet this exists to
   * skip — DEVICE-FOUND 2026-08-13. The driver's ruling closed that door at
   * the source instead: validation refuses an empty list, so a deletion is
   * always the confirmed one, and this is its only caller.
   */
  const exitAfterDelete = useCallback(
    (deletedSeriesId: string) => {
      useSeriesDraftStore.getState().resetForCreate();
      const routes = navigation.getState()?.routes ?? [];
      const pops = popCountAfterSeriesDelete(routes, deletedSeriesId);
      // One pop IS `back()`, and back() is what every other exit on this
      // screen uses — no reason to leave the router for it.
      if (pops > 1) navigation.dispatch(StackActions.pop(pops));
      else router.back();
    },
    [navigation, router],
  );

  /* ----------------------------------------------------------- the artwork --- */

  /**
   * §D6 — the cover control opens the app's existing cover-art search, which
   * `coverArtSearch` now serves for both books and series.
   *
   * The name is read at press time rather than subscribed to: this callback
   * would otherwise be rebuilt on every keystroke in the name field, which is
   * the churn `NumberedBookRow` was split out to avoid on its own value.
   */
  const openCoverSearch = useCallback(() => {
    if (!editingSeriesId) return;
    router.push({
      pathname: '/coverArtSearch',
      params: {
        seriesId: editingSeriesId,
        seriesName: useSeriesDraftStore.getState().name,
        author: sharedAuthorName(orderedBooks) ?? '',
      },
    });
  }, [editingSeriesId, orderedBooks, router]);

  /**
   * §D7 — reverting to the derived cover is ONE PRESS, with no confirmation,
   * and §K8 makes it delete the pinned file.
   *
   * The asymmetry with pinning (which does confirm, in `coverArtSearch`) is
   * deliberate and is the right way round: pinning destroys a file the user
   * cannot get back except by searching again, while reverting returns the
   * series to the state it is in by default and costs at most one more search.
   * A dialog in front of the escape hatch would also undo the point of §D7 —
   * the caption is pressable so that getting back is obvious and cheap.
   */
  const revertCoverArt = useCallback(() => {
    if (!editingSeriesId) return;
    clearSeriesArtwork(editingSeriesId).catch((e) =>
      console.error('clearSeriesArtwork failed', e),
    );
  }, [editingSeriesId]);

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
      /*
       * ⚠ SAVE CANNOT DELETE. It used to: emptying the list fell through to
       * `deleteSeries`, so this button destroyed a series and suppressed its
       * name with no confirmation, and then landed on the dead sheet (K7
       * through the other door). `seriesEditorIssues` refuses an empty list
       * now — driver ruling on device, 2026-08-13 — so the only exit here is
       * the ordinary one.
       *
       * ⚠ AND IT MAY ONLY REMOVE WHAT IT COULD SHOW, which is what the last
       * argument carries. The falsy case is the safe one and not a real one: a
       * save before the seeding effect has run would ask to remove nothing, and
       * it takes a tap to get here.
       */
      if (editingSeriesId)
        await updateSeries(
          editingSeriesId,
          name,
          orderedBookKeys,
          canonicalNumbers,
          visibleAtSeed.current ?? orderedBookKeys,
        );
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
      /*
       * ⚠ AN UNRECOGNISED FAILURE IS THE ONE THE USER MOST NEEDS TOLD ABOUT —
       * neither of us knows what landed. Without this the button simply
       * re-enables and the sheet stays open, which is pixel-identical to a
       * mis-registered tap: the success path's only signal is `router.back()`,
       * so "the screen did not close" was doing double duty as both `error`
       * and `nothing happened`.
       *
       * `console.error`-only is still right for `revertCoverArt` and the
       * remembered-numbers effect — those are fire-and-forget with no gesture
       * waiting on them. This is the commit. (Code review finding 9; the join
       * door in `AddToSeriesPanel` already alerted on the same write path.)
       */
      console.error(
        editingSeriesId ? 'updateSeries failed' : 'createSeries failed',
        e,
      );
      Alert.alert("Can't save", 'Something went wrong. Please try again.');
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

  /**
   * §D8 — the existing origin-blind dialog, whose copy is already correct, and
   * `deleteSeries` writes A12's suppression row for a detected series (and
   * nothing for a hand-made one, because nothing would recreate it).
   *
   * §K7 — the exit is `exitAfterDelete`; see the comment there for why it
   * reads the stack instead of counting to two.
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
              exitAfterDelete(editingSeriesId);
            } catch (e) {
              console.error('deleteSeries failed', e);
            }
          },
        },
      ],
    );
  }, [editingSeriesId, exitAfterDelete]);

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
      // A11 — a book coming BACK brings its number with it. The store applies
      // it to the keys this pass actually ADDS, computed from the same
      // snapshot as the union, so neither can be filled from a stale read.
      commitPickerSelection(rememberedNumbers.current);
      setPanel(null);
      return;
    }
    void handleSave();
  }, [
    panel,
    selectedAuthorNames,
    selectedBookKeys,
    commitPickerSelection,
    handleSave,
  ]);

  /* -------------------------------------------------------------- rendering --- */

  const subtitle =
    panel !== null
      ? pickerSubtitle(panel)
      : orderedBookKeys.length === 0
        ? // §E6. Only reachable since `X` stopped abandoning the series: before
          // that, a closed panel implied at least one book.
          'Add books to get started.'
        : 'Drag the handles to put the books in series order.';

  const nameField = (
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
        {/*
          §D6 — THE COVER SITS BESIDE THE NAME FIELD, and it is ABSENT FROM THE
          CREATE PASS rather than disabled.

          Absent because there is nothing to write to: the series row does not
          exist until Save, so there is no `series.artwork` column to pin and
          no derived cover to revert to. That is `Delete Series`' precedent
          exactly (§E9) and this screen's stated convention — a control that is
          a function of editing something existing is absent from the create
          pass. Rendering it disabled would also be the failure §D7 rejects: a
          cover you cannot press, telling you a state you cannot change.

          Reaching it on a new series is create → Save → reopen. §D1 already
          accepted a five-tap journey to a rename on this surface.

          ⚠ `Sort by number` STAYS FULL-WIDTH BELOW, not in this row. The
          prototype put it in the right-hand column with the name field; that
          would narrow it by ~102dp and invalidate ticket 14's DEVICE-MEASURED
          `sortRowIsStacked` threshold, which was calibrated against the full
          header width. Both controls are still "beside the name field" in the
          sense §D4 and §D6 mean — in the header, above the list.
        */}
        {!editingSeriesId ? (
          nameField
        ) : stackIdentityRow ? (
          <>
            <SeriesCoverControl
              artwork={series?.artwork ?? null}
              firstBook={orderedBooks[0]}
              stacked
              onPress={openCoverSearch}
              onRevert={revertCoverArt}
            />
            {nameField}
          </>
        ) : (
          <View style={styles.identityRow}>
            <SeriesCoverControl
              artwork={series?.artwork ?? null}
              firstBook={orderedBooks[0]}
              stacked={false}
              onPress={openCoverSearch}
              onRevert={revertCoverArt}
            />
            {/* Centred against the cover column rather than top-aligned: the
                column is ~114dp of cover-plus-caption and a 44dp field pinned
                to its top leaves a hole under it. */}
            <View style={styles.identityText}>{nameField}</View>
          </View>
        )}
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
              {/*
                §I7 — `dangerText`, NOT `danger`. The shared accent measures
                2.59:1 on the light background (measured, not inferred): all
                four shared tokens live in a bag that is spread OVER the
                per-scheme ones, so they are unthemeable by construction and
                all four were picked against the dark ground. `dangerText` is
                the per-scheme escape hatch ticket 08 already cut for
                `successText` — dark keeps #FF5F56 unchanged, light gets a red
                that passes AA. ⚠ It is deliberately NOT a local literal: this
                is a token so the next `danger` surface can inherit the fix.
              */}
              <Text style={[styles.deleteText, { color: themeColors.dangerText }]}>
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
  /** Cover column | name field. See the JSX for why the sort row is not here. */
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  identityText: { flex: 1 },
  coverColumn: { width: COVER_BOX_SIZE, gap: 6 },
  /** The stacked variant: cover left, caption taking the rest of the width. */
  coverRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  coverCaptionWide: { flex: 1 },
  coverBox: {
    width: COVER_BOX_SIZE,
    height: COVER_BOX_SIZE,
    // Centres non-square artwork in the constant box — the same treatment the
    // browse fan's layers give it, minus the pillar, because what shows here
    // is the header's own background rather than a hole in a card.
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  /** Bottom-right, mirroring `editTitleDetails`' badge on the book cover. */
  coverBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    borderRadius: 10,
    padding: 4,
  },
  /**
   * ⚠ 10 IS A DELIBERATE LITERAL AND MUST NOT BE TOKEN-ISED. The scale is
   * `xs: 12 · sm: 16 · base: 20 · lg: 24`, so no token sits below 12, and this
   * caption has to read as an annotation on the field it sits under rather
   * than as a peer of the instruction line below it. Same reasoning as §E14's
   * 13px author cell, which an agent once "corrected" upward and the driver
   * reverted.
   *
   * It carries no `lineHeight`, and the proportional default is right for a
   * 10px caption — but NOT for the reason this comment used to give.
   *
   * ⚠ CORRECTION (code review finding 22, 2026-08-14). This said "a fixed line
   * height is in dp and does NOT follow the OS font scale". **That is false on
   * this stack.** `TextAttributeProps.kt:36-45` converts `lineHeight` with
   * `toPixelFromSP` whenever `allowFontScaling` is set, and it defaults to
   * true (`maxFontSizeMultiplier` is NaN, so nothing caps it either);
   * `toPixelFromDIP` is the `allowFontScaling={false}` branch only. A fixed
   * `lineHeight` therefore scales WITH the glyphs and cannot collapse onto
   * them.
   *
   * ⚠ **Do not go hunting `lineHeight` on small type as a font-scale bug.** The
   * old claim sent a review at `SeriesEditorPanel`'s `fontSize: 13 /
   * lineHeight: 16` author cell, which is correct and had already PASSED a
   * device check at fs 2.0 under ticket 20 — the cells grew taller, which is
   * itself the proof the line height scaled, since a fixed 16dp would have fit
   * two lines inside `minHeight: 42` without growing. A rule with a wrong
   * reason and a harmless conclusion never fails, so nothing corrects it.
   */
  coverCaption: { fontFamily: 'Rubik', fontSize: 10 },
  coverCaptionButton: { paddingVertical: 2 },
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
