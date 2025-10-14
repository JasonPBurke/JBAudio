import BooksList from '@/components/BooksList';
import { BooksHome } from '@/components/BooksHome';
import { BooksGrid } from '@/components/BooksGrid';
// import { useNavigationSearch } from '@/hooks/useNavigationSearch';
import { defaultStyles } from '@/styles';
import React, { use, useEffect, useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// import { bookTitleFilter } from '@/helpers/filter';
import Header from '@/components/Header';
import { useScanExternalFileSystem } from '@/hooks/useScanExternalFileSystem';
import { useAuthors, useLibraryStore } from '@/store/library';
// import database from '@/db';
// import Book from '@/db/models/Book';
// import Author from '@/db/models/Author';

const LibraryScreen = () => {
  const [toggleView, setToggleView] = React.useState(false);

  useScanExternalFileSystem(); // Call the hook to trigger scanning and store update

  const initStore = useLibraryStore((state) => state.init);
  useEffect(() => {
    // Start observing the database and return the cleanup function.
    const unsubscribe = initStore();
    return () => unsubscribe();
  }, [initStore]); // Re-run effect if initStore reference changes

  // const search = useNavigationSearch({
  //   searchBarOptions: {
  //     placeholder: 'Search in library',
  //   },
  // });

  const library = useAuthors();

  // console.log('LibraryScreen library state:', library);

  // const filteredBooks = useMemo(() => {
  //   if (!search) return library;
  //   return library.filter(bookTitleFilter(search));
  // }, [search, library]);

  return (
    <View style={defaultStyles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* MOVE HEADER ABOVE SCROLL VIEW TO DOCK IT AT TOP OF SCREEN */}
        <Header setToggleView={setToggleView} toggleView={toggleView} />
        <ScrollView>
          {!toggleView ? (
            <BooksHome authors={library} scrollEnabled={false} />
          ) : (
            <BooksList authors={library} scrollEnabled={false} />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

export default LibraryScreen;
