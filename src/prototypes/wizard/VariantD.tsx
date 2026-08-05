/**
 * THROWAWAY — ticket 15, variant D: CREATE-THEN-EDIT.
 *
 * A name prompt, then the editor. The whole wizard directory goes.
 *
 * The prompt is drawn as a dialog over a dimmed backdrop rather than as a
 * fourth screen, because D's argument is that naming is a QUESTION, not a
 * stage — if the prompt needs a screen of its own, D has re-invented step 1.
 *
 * ── Two things this variant is built to make visible ──────────────────────
 *
 * 1. THE EMPTY ROOM. You arrive in an editor with zero books, so the first
 *    thing the flow shows you is an empty list and a button. Variants A/B/C
 *    all open on something to act on. Whether that reads as "get started" or
 *    as "nothing happened" is the judgment D exists to collect.
 *
 * 2. `Add books` HAS NOWHERE TO GO. D's headline is that it deletes three
 *    screens — but `books.tsx` is SHARED with the editor (`isEdit` switches
 *    `Next`→`Done`, books.tsx:93-101), so deleting it means the editor must
 *    grow its own picker. That is built here as an inline section, and it is a
 *    COST of D, not a bonus: the saving is two screens, not three.
 *
 * ── What is NOT modelled, deliberately ───────────────────────────────────
 *
 * The naive create-then-edit writes the series at the prompt, so the editor
 * has a real id to edit. That is unsafe here: `createSeries` tolerates an
 * empty membership array (`seriesQueries.ts:67`) and `deleteEmptySeries()`
 * runs on every library scan (`scanLibrary.ts:964`), so a create abandoned
 * before a book is added silently disappears — and `handleDelete`/`Cancel`
 * would have to clean up after themselves. This prototype defers the write to
 * `Save`, which is the safe version and the one that should be judged.
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
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import Sortable, { type SortableGridRenderItem } from 'react-native-sortables';
import { ArrowDownWideNarrow, GripVertical, ImagePlus, Plus, X } from 'lucide-react-native';

import { useTheme } from '@/hooks/useTheme';
import { SeriesBookRow } from '@/components/SeriesBookRow';
import { unknownBookImageUri } from '@/constants/images';
import { fontSize, screenPadding } from '@/constants/tokens';
import { withOpacity } from '@/helpers/colorUtils';
import {
  ProtoAuthorHeading,
  ProtoEmptyPool,
  ProtoPrimaryButton,
  ProtoSearchField,
  ProtoWizardFooter,
  ProtoWizardHeader,
  styles as shared,
  useBookPool,
  useHardwareBack,
  useKeyMap,
  useWizardDraft,
} from './wizardShared';

export default function VariantD({ onExit }: { onExit: () => void }) {
  const { colors: themeColors } = useTheme();
  const [named, setNamed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [numbers, setNumbers] = useState<Record<string, string>>({});

  const name = useWizardDraft((s) => s.name);
  const setName = useWizardDraft((s) => s.setName);
  const query = useWizardDraft((s) => s.query);
  const setQuery = useWizardDraft((s) => s.setQuery);
  const ordered = useWizardDraft((s) => s.ordered);
  const toggleBook = useWizardDraft((s) => s.toggleBook);
  const setOrdered = useWizardDraft((s) => s.setOrdered);

  const keyMap = useKeyMap();
  const scrollableRef = useAnimatedRef<Animated.ScrollView>();
  const { rows, matchCount, totalCount } = useBookPool({ query });

  const back = useCallback(() => {
    if (adding) {
      setAdding(false);
      return true;
    }
    onExit();
    return true;
  }, [adding, onExit]);
  useHardwareBack(back);

  const heroUri = useMemo(() => {
    const first = ordered[0] ? keyMap.get(ordered[0]) : undefined;
    return first?.artwork ?? unknownBookImageUri;
  }, [ordered, keyMap]);

  const hasAnyNumber = useMemo(
    () => Object.values(numbers).some((v) => !Number.isNaN(parseFloat(v))),
    [numbers],
  );

  const sortByNumber = useCallback(() => {
    // 07: `position` keeps sole sort authority and canonical only SEEDS it, so
    // this is an explicit action and typing a number never resorts. NULLS LAST,
    // stable — matching ticket 10's ruling.
    setOrdered(
      [...ordered].sort((a, b) => {
        const av = parseFloat(numbers[a] ?? '');
        const bv = parseFloat(numbers[b] ?? '');
        const an = Number.isNaN(av);
        const bn = Number.isNaN(bv);
        if (an && bn) return 0;
        if (an) return 1;
        if (bn) return -1;
        return av - bv;
      }),
    );
  }, [ordered, numbers, setOrdered]);

  const renderSortable = useCallback<SortableGridRenderItem<string>>(
    ({ item: bookKey }) => {
      const book = keyMap.get(bookKey);
      return (
        <View style={localStyles.editRow}>
          <View style={localStyles.editRowBody}>
            <SeriesBookRow
              context='sortable'
              bookId={book?.bookId}
              title={book?.bookTitle}
              author={book?.author}
              artwork={book?.artwork}
              onRemove={() => toggleBook(bookKey)}
              dragHandle={
                <Sortable.Handle>
                  <GripVertical size={22} color={themeColors.textMuted} />
                </Sortable.Handle>
              }
            />
          </View>
          {/* 10 AMENDED 07: `canonical_number` is a nullable NUMBER and the
              field is `decimal-pad`, because `14b`/`1-3` forced an alphabetic
              keyboard on every edit. Locale trap kept in view: `decimal-pad`
              shows the locale separator and `parseFloat('14,1')` is 14. */}
          <TextInput
            value={numbers[bookKey] ?? ''}
            onChangeText={(v) =>
              setNumbers((prev) => ({ ...prev, [bookKey]: v }))
            }
            placeholder='#'
            placeholderTextColor={themeColors.textMuted}
            keyboardType='decimal-pad'
            style={[
              localStyles.numberField,
              { color: themeColors.text, borderColor: themeColors.divider },
            ]}
          />
        </View>
      );
    },
    [keyMap, numbers, themeColors, toggleBook],
  );

  /* ------------------------------------------------------- the prompt --- */

  if (!named) {
    return (
      <View style={[shared.screen, localStyles.promptBackdrop]}>
        <View
          style={[
            localStyles.promptCard,
            { backgroundColor: themeColors.background },
          ]}
        >
          <Text style={[localStyles.promptTitle, { color: themeColors.text }]}>
            Name your series
          </Text>
          <Text
            style={[localStyles.promptBody, { color: themeColors.textMuted }]}
          >
            You can add books and put them in order next.
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder='Series name'
            placeholderTextColor={themeColors.textMuted}
            autoFocus
            style={[
              localStyles.promptInput,
              { color: themeColors.text, borderColor: themeColors.divider },
            ]}
          />
          <View style={localStyles.promptButtons}>
            <Pressable onPress={onExit} hitSlop={8} style={localStyles.promptCancel}>
              <Text
                style={[localStyles.promptCancelText, { color: themeColors.textMuted }]}
              >
                Cancel
              </Text>
            </Pressable>
            <ProtoPrimaryButton
              label='Continue'
              active={name.trim().length > 0}
              onPress={() => {
                if (name.trim().length === 0) {
                  Alert.alert("Can't continue", 'Enter a series name.');
                  return;
                }
                setNamed(true);
              }}
            />
          </View>
        </View>
      </View>
    );
  }

  /* ------------------------------------------------------- the editor --- */

  return (
    <View style={shared.screen}>
      <ProtoWizardHeader
        title='Edit series'
        subtitle={
          ordered.length === 0
            ? 'This series has no books yet.'
            : `${ordered.length} books`
        }
        onBack={onExit}
      />

      <Animated.ScrollView
        ref={scrollableRef}
        style={shared.list}
        contentContainerStyle={localStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps='handled'
      >
        {/* Ticket 10's artwork slot: pressable cover + ImagePlus, parity with
            editTitleDetails. With no books yet there is no derived cover to
            show — the placeholder IS the empty room, stated in artwork. */}
        <View style={localStyles.identityRow}>
          <Pressable
            onPress={() =>
              Alert.alert('Prototype', 'Would open /coverArtSearch for the series.')
            }
            style={localStyles.coverWrap}
          >
            <FastImage
              source={{ uri: heroUri }}
              style={localStyles.cover}
              resizeMode={FastImage.resizeMode.cover}
            />
            <View
              style={[
                localStyles.coverBadge,
                { backgroundColor: withOpacity(themeColors.background, 0.7) },
              ]}
            >
              <ImagePlus size={16} color={themeColors.primary} />
            </View>
          </Pressable>
          <View style={localStyles.identityFields}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder='Series name (required)'
              placeholderTextColor={themeColors.textMuted}
              style={[
                localStyles.nameInput,
                { color: themeColors.text, borderColor: themeColors.divider },
              ]}
            />
            <Text style={[localStyles.caption, { color: themeColors.textMuted }]}>
              {ordered.length === 0
                ? 'Cover art follows the first book.'
                : 'Using the first book’s cover.'}
            </Text>
          </View>
        </View>

        {ordered.length === 0 ? (
          <View style={localStyles.emptyRoom}>
            <Text style={[localStyles.emptyRoomText, { color: themeColors.textMuted }]}>
              No books in this series yet.
            </Text>
          </View>
        ) : (
          <>
            <View style={localStyles.sortRow}>
              <Pressable
                onPress={sortByNumber}
                disabled={!hasAnyNumber}
                style={localStyles.sortButton}
                hitSlop={8}
              >
                <ArrowDownWideNarrow
                  size={16}
                  color={hasAnyNumber ? themeColors.primary : themeColors.textMuted}
                />
                <Text
                  style={[
                    localStyles.sortText,
                    {
                      color: hasAnyNumber
                        ? themeColors.primary
                        : themeColors.textMuted,
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
        )}

        {/* The cost of deleting books.tsx: the editor grows its own picker. */}
        {adding ? (
          <View
            style={[localStyles.pickerPanel, { borderColor: themeColors.primary }]}
          >
            <View style={localStyles.pickerHead}>
              <Text style={[localStyles.pickerTitle, { color: themeColors.text }]}>
                Add books
              </Text>
              <Pressable onPress={() => setAdding(false)} hitSlop={10}>
                <X size={20} color={themeColors.textMuted} />
              </Pressable>
            </View>
            <ProtoSearchField
              value={query}
              onChange={setQuery}
              placeholder={`Search ${totalCount} books`}
            />
            {rows.length === 0 ? (
              <ProtoEmptyPool query={query} />
            ) : (
              rows.map((row) =>
                row.type === 'heading' ? (
                  <ProtoAuthorHeading
                    key={row.key}
                    name={row.name}
                    count={row.count}
                  />
                ) : (
                  <View key={row.key} style={localStyles.poolRow}>
                    <SeriesBookRow
                      context='selection'
                      bookId={row.book.bookId}
                      title={row.book.bookTitle}
                      author={row.book.author}
                      artwork={row.book.artwork}
                      selected={ordered.includes(row.bookKey)}
                      onPress={() => toggleBook(row.bookKey)}
                    />
                  </View>
                ),
              )
            )}
            {query.trim().length > 0 && (
              <Text
                style={[localStyles.pickerNote, { color: themeColors.textMuted }]}
              >
                {matchCount} match
              </Text>
            )}
          </View>
        ) : (
          <Pressable
            style={[localStyles.addButton, { borderColor: themeColors.primary }]}
            android_ripple={{ color: themeColors.dividerAlpha16 }}
            onPress={() => setAdding(true)}
          >
            <Plus size={18} color={themeColors.primary} />
            <Text style={[localStyles.addText, { color: themeColors.primary }]}>
              Add books
            </Text>
          </Pressable>
        )}

        <Pressable
          style={localStyles.deleteButton}
          onPress={() =>
            Alert.alert(
              'Delete series?',
              'This removes the series. Your books are not affected.',
              [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: onExit }],
            )
          }
          hitSlop={8}
        >
          <Text style={[localStyles.deleteText, { color: themeColors.danger }]}>
            Delete Series
          </Text>
        </Pressable>
      </Animated.ScrollView>

      <ProtoWizardFooter
        leftLabel='Cancel'
        onLeft={onExit}
        rightLabel='Save'
        rightActive={name.trim().length > 0 && ordered.length > 0}
        onRight={() => {
          if (ordered.length === 0) {
            Alert.alert("Can't save", 'Add at least one book.');
            return;
          }
          Alert.alert(
            'Prototype',
            `Would create “${name}” with ${ordered.length} books.\n\nNothing was written to the database.`,
            [{ text: 'OK', onPress: onExit }],
          );
        }}
      />
    </View>
  );
}

const localStyles = StyleSheet.create({
  promptBackdrop: {
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  promptCard: { borderRadius: 14, padding: 20, gap: 10 },
  promptTitle: {
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: fontSize.lg,
  },
  promptBody: { fontFamily: 'Rubik', fontSize: fontSize.sm },
  promptInput: {
    fontFamily: 'Rubik',
    fontSize: fontSize.base,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  promptButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 6,
  },
  promptCancel: { paddingVertical: 12, paddingHorizontal: 12 },
  promptCancelText: { fontFamily: 'Rubik', fontSize: fontSize.base },

  scrollContent: {
    paddingHorizontal: screenPadding.horizontal,
    paddingTop: 12,
    paddingBottom: 16,
  },
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

  emptyRoom: { paddingVertical: 44, alignItems: 'center' },
  emptyRoomText: { fontFamily: 'Rubik', fontSize: fontSize.sm },

  sortRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 18, marginBottom: 8 },
  sortButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  sortText: { fontFamily: 'Rubik', fontSize: fontSize.sm, fontWeight: '600' },

  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editRowBody: { flex: 1 },
  numberField: {
    width: 52,
    textAlign: 'center',
    fontFamily: 'Rubik',
    fontSize: fontSize.sm,
    borderWidth: 1,
    borderRadius: 8,
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
  addText: { fontFamily: 'Rubik', fontWeight: '600', fontSize: fontSize.base },

  pickerPanel: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 10,
  },
  pickerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerTitle: {
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: fontSize.base,
  },
  pickerNote: { fontFamily: 'Rubik', fontSize: 12, textAlign: 'right' },
  poolRow: { marginBottom: 8 },

  deleteButton: { alignItems: 'center', marginTop: 28, paddingVertical: 12 },
  deleteText: {
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: fontSize.base,
  },
});
