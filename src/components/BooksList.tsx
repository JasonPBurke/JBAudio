'use no memo'; // Receives Reanimated scroll handler

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
import React from 'react';
import { compareBookTitles } from '@/helpers/miscellaneous';

export type BookListProps = Partial<FlashListProps<string>> & {
  authors: Author[];
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  ListHeaderComponent?: React.ReactElement;
};

const BooksList = ({
  authors,
  onScroll,
  ListHeaderComponent,
}: BookListProps) => {
  const { colors: themeColors } = useTheme();
  const bookIds = useMemo(() => {
    return authors
      .flatMap((author) =>
        [...author.books]
          .sort((a, b) => compareBookTitles(a.bookTitle, b.bookTitle))
          .map((book) => book.bookId),
      )
      .filter((bookId): bookId is string => !!bookId); // Filter out null/undefined and assert type
  }, [authors]);

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
