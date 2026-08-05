/**
 * THROWAWAY — ticket 15, variant A: THREE STEPS, DEFECTS FIXED.
 *
 * The control. `Authors → Books → Order`, exactly the shape that ships today,
 * with 05's three defects repaired so the funnel is judged on its SHAPE rather
 * than on its finish. Without this variant the ticket cannot tell "the funnel
 * is wrong" apart from "the funnel is unpolished", which is the confound the
 * driver was warned about when picking the lineup.
 *
 * The one thing to watch: step 1 asks for a commitment (which authors?) before
 * it has shown you anything to commit to, and `selectedAuthorNames` is then
 * discarded — it never reaches `createSeries`.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import Sortable, { type SortableGridRenderItem } from 'react-native-sortables';
import { Check, GripVertical } from 'lucide-react-native';

import { useTheme } from '@/hooks/useTheme';
import { useLibraryStore } from '@/store/library';
import { SeriesBookRow } from '@/components/SeriesBookRow';
import { fontSize, screenPadding } from '@/constants/tokens';
import {
  ProtoAuthorHeading,
  ProtoNameField,
  ProtoWizardFooter,
  ProtoWizardHeader,
  PoolRow,
  rippleOf,
  styles as shared,
  useBookPool,
  useHardwareBack,
  useKeyMap,
  useWizardDraft,
} from './wizardShared';

type Step = 'authors' | 'books' | 'order';

export default function VariantA({ onExit }: { onExit: () => void }) {
  const { colors: themeColors } = useTheme();
  const [step, setStep] = useState<Step>('authors');

  const name = useWizardDraft((s) => s.name);
  const setName = useWizardDraft((s) => s.setName);
  const authorFilter = useWizardDraft((s) => s.authorFilter);
  const toggleAuthor = useWizardDraft((s) => s.toggleAuthor);
  const ordered = useWizardDraft((s) => s.ordered);
  const toggleBook = useWizardDraft((s) => s.toggleBook);
  const setOrdered = useWizardDraft((s) => s.setOrdered);

  const authors = useLibraryStore((state) => state.authors);
  const keyMap = useKeyMap();
  const scrollableRef = useAnimatedRef<Animated.ScrollView>();

  // No search field, on purpose: step 1 IS this variant's filter.
  const { rows } = useBookPool({ query: '', authorAllowList: authorFilter });

  const back = useCallback(() => {
    if (step === 'order') {
      setStep('books');
      return true;
    }
    if (step === 'books') {
      setStep('authors');
      return true;
    }
    onExit();
    return true;
  }, [step, onExit]);
  useHardwareBack(back);

  const renderAuthor = useCallback(
    ({ item }: { item: { name: string; books: unknown[] } }) => {
      const isSelected = authorFilter.includes(item.name);
      return (
        <Pressable
          style={[
            localStyles.authorRow,
            {
              borderColor: isSelected ? themeColors.primary : themeColors.divider,
            },
          ]}
          android_ripple={rippleOf(themeColors.divider)}
          onPress={() => toggleAuthor(item.name)}
        >
          <Text
            numberOfLines={1}
            style={[localStyles.authorName, { color: themeColors.text }]}
          >
            {item.name}
          </Text>
          <Text style={[localStyles.authorBooks, { color: themeColors.textMuted }]}>
            {item.books.length}
          </Text>
          <View
            style={[
              localStyles.bubble,
              {
                borderColor: isSelected ? themeColors.primary : themeColors.icon,
                backgroundColor: isSelected ? themeColors.primary : 'transparent',
              },
            ]}
          >
            {isSelected && <Check size={16} color={themeColors.background} />}
          </View>
        </Pressable>
      );
    },
    [authorFilter, themeColors, toggleAuthor],
  );

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

  const booksIssue = useMemo(() => {
    if (name.trim().length === 0) return 'Enter a series name.';
    if (ordered.length === 0) return 'Select at least one book.';
    return null;
  }, [name, ordered]);

  if (step === 'authors') {
    return (
      <View style={shared.screen}>
        <ProtoWizardHeader
          title='New Series'
          subtitle='Select the author(s) whose books make up this series.'
          step={1}
          ofSteps={3}
          onBack={onExit}
        />
        <FlatList
          data={authors}
          keyExtractor={(a) => a.name}
          renderItem={renderAuthor}
          style={shared.list}
          contentContainerStyle={shared.listContent}
          showsVerticalScrollIndicator={false}
        />
        <ProtoWizardFooter
          leftLabel='Exit'
          onLeft={onExit}
          rightLabel='Next'
          rightActive={authorFilter.length > 0}
          note={
            authorFilter.length > 0
              ? `${authorFilter.length} selected`
              : undefined
          }
          onRight={() => {
            if (authorFilter.length === 0) {
              Alert.alert("Can't continue", 'Select at least one author.');
              return;
            }
            setStep('books');
          }}
        />
      </View>
    );
  }

  if (step === 'books') {
    return (
      <View style={shared.screen}>
        <ProtoWizardHeader
          title='Name & select books'
          subtitle='Tap the books that belong in this series.'
          step={2}
          ofSteps={3}
          onBack={() => setStep('authors')}
        />
        <View style={shared.body}>
          <ProtoNameField value={name} onChange={setName} />
        </View>
        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          renderItem={renderPoolRow}
          style={shared.list}
          contentContainerStyle={shared.listContent}
          showsVerticalScrollIndicator={false}
        />
        <ProtoWizardFooter
          leftLabel='Back'
          onLeft={() => setStep('authors')}
          rightLabel='Next'
          rightActive={booksIssue === null}
          note={ordered.length > 0 ? `${ordered.length} books` : undefined}
          onRight={() => {
            if (booksIssue) {
              Alert.alert("Can't continue", booksIssue);
              return;
            }
            setStep('order');
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
        step={3}
        ofSteps={3}
        onBack={() => setStep('books')}
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
        onLeft={() => setStep('books')}
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
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 2,
    borderRadius: 8,
  },
  authorName: { fontFamily: 'Rubik', fontSize: fontSize.base, flex: 1 },
  authorBooks: { fontFamily: 'Rubik', fontSize: 13 },
  bubble: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortContent: {
    paddingHorizontal: screenPadding.horizontal,
    paddingVertical: 8,
  },
});
