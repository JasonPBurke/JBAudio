/**
 * THROWAWAY — ticket 15, variant C: ONE SCREEN, NO STEPS.
 *
 * Name, search, the selection, and the ordering all on one surface. The claim
 * under test is that the funnel's three stages were never sequential
 * DEPENDENCIES — you can name a series before or after picking its books, and
 * ordering is only meaningful once something is picked, which a single screen
 * expresses by simply not showing the ordered section until then.
 *
 * What separates this from variant D, which looks similar in a screenshot:
 * C writes NOTHING until `Create Series` and reuses no editor code, so an
 * abandoned create leaves no trace at all. D lands you in a real editor over a
 * real row. If C wins, the create flow and the edit flow stay two surfaces that
 * happen to resemble each other; if D wins, they become one surface.
 *
 * Two prototype-grade compromises, both deliberate and both noted so they are
 * not read as design:
 *   - The book pool is rendered inside the same `Animated.ScrollView` as the
 *     sortable grid rather than virtualized. The emulator corpus is 8 books;
 *     the real library is 350+, so a shipped version of this needs the pool to
 *     be a `FlatList` with everything above it as `ListHeaderComponent` — which
 *     is a rendering problem, not a layout one.
 *   - The `Sortable.Grid`-inside-a-`ScrollView` pattern is lifted from
 *     `series/edit/[id].tsx:219-233`, where it is already device-verified.
 */
import React, { useCallback, useMemo } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import Sortable, { type SortableGridRenderItem } from 'react-native-sortables';
import { GripVertical } from 'lucide-react-native';

import { useTheme } from '@/hooks/useTheme';
import { SeriesBookRow } from '@/components/SeriesBookRow';
import { fontSize, screenPadding } from '@/constants/tokens';
import {
  ProtoAuthorHeading,
  ProtoEmptyPool,
  ProtoNameField,
  ProtoSearchField,
  ProtoWizardFooter,
  ProtoWizardHeader,
  styles as shared,
  useBookPool,
  useHardwareBack,
  useKeyMap,
  useWizardDraft,
} from './wizardShared';

export default function VariantC({ onExit }: { onExit: () => void }) {
  const { colors: themeColors } = useTheme();

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
    onExit();
    return true;
  }, [onExit]);
  useHardwareBack(back);

  const renderSortable = useCallback<SortableGridRenderItem<string>>(
    ({ item: bookKey }) => {
      const book = keyMap.get(bookKey);
      const index = ordered.indexOf(bookKey);
      return (
        <View style={localStyles.numberedRow}>
          <Text style={[localStyles.number, { color: themeColors.textMuted }]}>
            {index + 1}
          </Text>
          <View style={localStyles.numberedBody}>
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
        </View>
      );
    },
    [keyMap, ordered, themeColors, toggleBook],
  );

  const issue = useMemo(() => {
    if (name.trim().length === 0) return 'Enter a series name.';
    if (ordered.length === 0) return 'Select at least one book.';
    return null;
  }, [name, ordered]);

  return (
    <View style={shared.screen}>
      <ProtoWizardHeader
        title='New Series'
        subtitle='Name it, pick its books, drag them into order.'
        onBack={onExit}
      />

      <Animated.ScrollView
        ref={scrollableRef}
        style={shared.list}
        contentContainerStyle={localStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps='handled'
      >
        <View style={localStyles.fields}>
          <ProtoNameField value={name} onChange={setName} />
          <ProtoSearchField
            value={query}
            onChange={setQuery}
            placeholder={`Search ${totalCount} books by title or author`}
          />
        </View>

        {/* The ordered section is ABSENT until something is picked. That is the
            single-screen answer to "is Order a step?" — it is a stage that
            appears when it becomes meaningful, rather than a screen you must
            visit. */}
        {ordered.length > 0 && (
          <>
            <SectionLabel
              text={`IN THIS SERIES · ${ordered.length}`}
              hint='drag to order'
            />
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

        <SectionLabel
          text='ADD BOOKS'
          hint={query.trim().length > 0 ? `${matchCount} match` : undefined}
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
      </Animated.ScrollView>

      <ProtoWizardFooter
        leftLabel='Cancel'
        onLeft={onExit}
        rightLabel='Create Series'
        rightActive={issue === null}
        onRight={() => {
          if (issue) {
            Alert.alert("Can't create", issue);
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

function SectionLabel({ text, hint }: { text: string; hint?: string }) {
  const { colors: themeColors } = useTheme();
  return (
    <View
      style={[localStyles.sectionLabel, { borderTopColor: themeColors.divider }]}
    >
      <Text style={[localStyles.sectionText, { color: themeColors.text }]}>
        {text}
      </Text>
      {!!hint && (
        <Text style={[localStyles.sectionHint, { color: themeColors.textMuted }]}>
          {hint}
        </Text>
      )}
    </View>
  );
}

const localStyles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: screenPadding.horizontal,
    paddingTop: 10,
    paddingBottom: 16,
  },
  fields: { gap: 10, marginBottom: 4 },
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingTop: 12,
    marginBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sectionText: {
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 0.8,
  },
  sectionHint: { fontFamily: 'Rubik', fontSize: 12 },
  numberedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  number: {
    fontFamily: 'Rubik',
    fontSize: fontSize.sm,
    width: 20,
    textAlign: 'right',
  },
  numberedBody: { flex: 1 },
  poolRow: { marginBottom: 8 },
});
