import { BookListProps, BooksList } from '@/components/BooksList';
import { screenPadding } from '@/constants/tokens';
import { useNavigationSearch } from '@/hooks/useNavigationSearch';
import { defaultStyles, utilsStyles } from '@/styles';
import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import library from '@/assets/data/library.json';
import { SafeAreaView } from 'react-native-safe-area-context';
import { bookTitleFilter } from '@/helpers/filter';
import Header from '@/components/Header';
import { BooksHome } from '@/components/BooksHome';
import { useScanExternalFileSystem } from '@/hooks/useScanExternalFileSystem';

const LibraryScreen = () => {
  const testLibrary = useScanExternalFileSystem();
  // const reducedTestLibrary = testLibrary.slice(0, 30);
  // console.log(
  //   'reducedTestLibrary',
  //   JSON.stringify(reducedTestLibrary, null, 2)
  // );
  //! BEFORE ADDING THE BOOKS TO THE LIST, YOU HAVE TO SORT THEM BY AUTHOR AND GROUP BOOKS INTO ALBUMS.  THIS WILL REDUCE THE NUMBER OF METADATA IMAGES TO LOAD

  const search = useNavigationSearch({
    searchBarOptions: {
      placeholder: 'Search in library',
    },
  });

  const filteredBooks = useMemo(() => {
    if (!search) return library;
    return library.filter(bookTitleFilter(search));
  }, [search]);

  return (
    <View style={defaultStyles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
        // style={{
        //   paddingHorizontal: screenPadding.horizontal,
        // }}
        >
          {/* MOVE HEADER ABOVE SCROLL VIEW TO DOCK IT AT TOP OF SCREEN */}
          <Header />
          {/* SWITCH LIBRARY VIEW HERE FROM HOME TO LIST BASED ON <Header> BUTTON CLICK */}
          <BooksHome books={testLibrary} />
          <View
            style={{
              ...utilsStyles.itemSeparator,
              marginVertical: 29,
              marginLeft: 0,
            }}
          />
          <BooksList books={testLibrary} scrollEnabled={false} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

export default LibraryScreen;
