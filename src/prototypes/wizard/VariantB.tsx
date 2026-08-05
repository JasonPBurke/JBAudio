/**
 * THROWAWAY — ticket 15, variant B: PICK → ARRANGE.
 *
 * The Authors STEP becomes a search FIELD. Everything else about the funnel
 * survives, so this variant isolates one claim and nothing else:
 *
 *   > Step 1 was a filter wearing a step's clothes.
 *
 * The evidence for the claim is in the shipping code, not in taste:
 * `selectedAuthorNames` is read in exactly two places — the step's own
 * validator and the `rows` builder in `books.tsx:50-71` — and
 * `createSeries(name, orderedBookKeys)` never sees it. It narrows a list. A
 * search field narrows the same list, and also narrows it by TITLE, which an
 * author gate cannot do.
 *
 * Both readings of "what is the wizard for" stay legible here:
 *   - playlist — reach any book in the library without declaring an author
 *   - rescue   — author headings are still on screen, and typing an author's
 *                name reproduces exactly what step 1 did
 */
import React, { useCallback, useMemo } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import Sortable, { type SortableGridRenderItem } from 'react-native-sortables';
import { GripVertical } from 'lucide-react-native';

import { useTheme } from '@/hooks/useTheme';
import { SeriesBookRow } from '@/components/SeriesBookRow';
import { screenPadding } from '@/constants/tokens';
import {
  ProtoAuthorHeading,
  ProtoEmptyPool,
  ProtoNameField,
  ProtoSearchField,
  ProtoWizardFooter,
  ProtoWizardHeader,
  PoolRow,
  styles as shared,
  useBookPool,
  useHardwareBack,
  useKeyMap,
  useWizardDraft,
} from './wizardShared';

export default function VariantB({ onExit }: { onExit: () => void }) {
  const { colors: themeColors } = useTheme();
  const [step, setStep] = React.useState<'pick' | 'arrange'>('pick');

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
    if (step === 'arrange') {
      setStep('pick');
      return true;
    }
    onExit();
    return true;
  }, [step, onExit]);
  useHardwareBack(back);

  const renderPoolRow = useCallback(
    ({ item }: { item: PoolRow }) => {
      if (item.type === 'heading') {
        return <ProtoAuthorHeading name={item.name} count={item.count} />;
      }
      return (
        <SeriesBookRow
          context='selection'
          bookId={item.book.bookId}
          title={item.book.bookTitle}
          author={item.book.author}
          artwork={item.book.artwork}
          selected={ordered.includes(item.bookKey)}
          onPress={() => toggleBook(item.bookKey)}
        />
      );
    },
    [ordered, toggleBook],
  );

  const renderSortable = useCallback<SortableGridRenderItem<string>>(
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

  const issue = useMemo(() => {
    if (name.trim().length === 0) return 'Enter a series name.';
    if (ordered.length === 0) return 'Select at least one book.';
    return null;
  }, [name, ordered]);

  if (step === 'pick') {
    return (
      <View style={shared.screen}>
        <ProtoWizardHeader
          title='New Series'
          subtitle='Name it, then tap the books that belong in it.'
          step={1}
          ofSteps={2}
          onBack={onExit}
        />
        <View style={shared.body}>
          <ProtoNameField value={name} onChange={setName} />
          <ProtoSearchField
            value={query}
            onChange={setQuery}
            placeholder={`Search ${totalCount} books by title or author`}
          />
        </View>
        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          renderItem={renderPoolRow}
          style={shared.list}
          contentContainerStyle={shared.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps='handled'
          ListEmptyComponent={<ProtoEmptyPool query={query} />}
        />
        <ProtoWizardFooter
          leftLabel='Exit'
          onLeft={onExit}
          rightLabel='Next'
          rightActive={issue === null}
          note={
            query.trim().length > 0
              ? `${ordered.length} picked · ${matchCount} shown`
              : ordered.length > 0
                ? `${ordered.length} picked`
                : undefined
          }
          onRight={() => {
            if (issue) {
              Alert.alert("Can't continue", issue);
              return;
            }
            setStep('arrange');
          }}
        />
      </View>
    );
  }

  return (
    <View style={shared.screen}>
      <ProtoWizardHeader
        title={name || 'New Series'}
        subtitle='Drag the handles to put the books in series order.'
        step={2}
        ofSteps={2}
        onBack={() => setStep('pick')}
      />
      <Animated.ScrollView
        ref={scrollableRef}
        style={shared.list}
        contentContainerStyle={localStyles.sortContent}
        showsVerticalScrollIndicator={false}
      >
        <Sortable.Grid
          columns={1}
          data={ordered}
          renderItem={renderSortable}
          rowGap={8}
          scrollableRef={scrollableRef}
          onDragEnd={({ data }) => setOrdered(data)}
          customHandle
        />
      </Animated.ScrollView>
      <ProtoWizardFooter
        leftLabel='Back'
        onLeft={() => setStep('pick')}
        rightLabel='Create Series'
        rightActive
        onRight={() =>
          Alert.alert(
            'Prototype',
            `Would create “${name}” with ${ordered.length} books.\n\nNothing was written to the database.`,
            [{ text: 'OK', onPress: onExit }],
          )
        }
      />
    </View>
  );
}

const localStyles = StyleSheet.create({
  sortContent: {
    paddingHorizontal: screenPadding.horizontal,
    paddingVertical: 8,
  },
});
