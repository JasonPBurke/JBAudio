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

export type BookListProps = Partial<FlashListProps<string>> & {
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
}: BookListProps) => {
  const { colors: themeColors } = useTheme();
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
    //? need to put a loader if allBooks.length === 0
    <View style={{ flex: 1, paddingHorizontal: screenPadding.horizontal }}>
      {bookIds.length > 0 && (
        <View style={{ flex: 1 }}>
          <FlashList
            data={bookIds}
            renderItem={renderBookItem}
            keyExtractor={(item) => item}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
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
      )}
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
