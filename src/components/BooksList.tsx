import {
  Text,
  View,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { BookListItem } from './BookListItem';
import { utilsStyles } from '@/styles';
import { Author } from '@/types/Book';
import { screenPadding } from '@/constants/tokens';
import { FlashList, FlashListProps } from '@shopify/flash-list';
import { memo, useCallback, useMemo } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { compareBookTitles } from '@/helpers/miscellaneous';
import {
  LibraryRecencyMode,
  RECENCY_KEY_FOR_MODE,
  sortBooksByRecency,
} from '@/helpers/bookRecency';
import { useResetScrollOnTabChange } from '@/hooks/useResetScrollOnTabChange';
import type { LadderListProps } from '@/types/ladderList';

export type BookListProps = Partial<FlashListProps<string>> &
  LadderListProps & {
    authors: Author[];
    recencyMode?: LibraryRecencyMode;
    onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    ListHeaderComponent?: React.ReactElement;
  };

const BooksList = ({
  authors,
  recencyMode = null,
  onScroll,
  ListHeaderComponent,
  listRef,
  selectedTab,
  onMomentumScrollEnd,
  onScrollEndDrag,
}: BookListProps) => {
  const { colors: themeColors } = useTheme();
  // §H6 -- the list ref belongs to the LIBRARY SCREEN and this component keeps
  // no fallback. `LadderListProps` says why.
  useResetScrollOnTabChange(listRef, selectedTab);
  const bookIds = useMemo(() => {
    // BooksList is only used standalone — flatten all authors' books.
    // Started/Finished tabs order most-recent-first; otherwise by title.
    const allBooks = authors.flatMap((author) => author.books);
    const sorted = recencyMode
      ? sortBooksByRecency(allBooks, RECENCY_KEY_FOR_MODE[recencyMode])
      : allBooks.sort((a, b) =>
          compareBookTitles(a.bookTitle, b.bookTitle),
        );
    return sorted
      .map((book) => book.bookId)
      .filter((bookId): bookId is string => !!bookId);
  }, [authors, recencyMode]);

  const renderBookItem = useCallback(
    ({ item: bookId }: { item: string }) => (
      <BookListItem bookId={bookId} />
    ),
    [],
  );

  return (
    /*
     * §H7 -- the list mounts UNCONDITIONALLY. It used to render only when
     * `bookIds.length > 0`, which satisfied the ladder's arm predicate by the
     * accident of a null ref rather than by the same path every other view
     * takes. Dropping the guard is what makes `ListEmptyComponent` below live
     * code instead of dead code, and it is why this list can be revived with a
     * zero-line diff.
     */
    <View style={{ flex: 1, paddingHorizontal: screenPadding.horizontal }}>
      <View style={{ flex: 1 }}>
        <FlashList
          ref={listRef}
          data={bookIds}
          renderItem={renderBookItem}
          keyExtractor={(item) => item}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          onMomentumScrollEnd={onMomentumScrollEnd}
          onScrollEndDrag={onScrollEndDrag}
          scrollEventThrottle={16}
          ListHeaderComponent={ListHeaderComponent}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 82 }}
          ListFooterComponent={
            bookIds.length > 0 ? (
              <ItemDivider themeColors={themeColors} />
            ) : null
          }
          ItemSeparatorComponent={() => (
            <ItemDivider themeColors={themeColors} />
          )}
          ListEmptyComponent={
            <View>
              <Text
                style={[
                  utilsStyles.emptyComponent,
                  { color: themeColors.textMuted },
                ]}
              >
                No books found
              </Text>
            </View>
          }
        />
      </View>
    </View>
  );
};

const ItemDivider = ({ themeColors }: { themeColors: any }) => (
  <View
    style={{
      ...utilsStyles.itemSeparator,
      marginVertical: 9,
      marginLeft: 75,
      borderColor: themeColors.textMuted,
    }}
  />
);

export default memo(BooksList);
