import { BooksList } from '@/components/BooksList';
import { useNavigationSearch } from '@/hooks/useNavigationSearch';
import { defaultStyles } from '@/styles';
import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { bookTitleFilter } from '@/helpers/filter';
import Header from '@/components/Header';
import { BooksHome } from '@/components/BooksHome';
import { useScanExternalFileSystem } from '@/hooks/useScanExternalFileSystem';
import { useAuthors } from '@/store/library';

const LibraryScreen = () => {
  const [toggleView, setToggleView] = React.useState(false);
  useScanExternalFileSystem(); // Call the hook to trigger scanning and store update

  const search = useNavigationSearch({
    searchBarOptions: {
      placeholder: 'Search in library',
    },
  });

  const library = useAuthors();
  // console.log('library', library);

  const filteredBooks = useMemo(() => {
    if (!search) return library;
    return library.filter(bookTitleFilter(search));
  }, [search, library]);

  return (
    <View style={defaultStyles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* MOVE HEADER ABOVE SCROLL VIEW TO DOCK IT AT TOP OF SCREEN */}
        <Header setToggleView={setToggleView} toggleView={toggleView} />
        <ScrollView>
          {toggleView ? (
            <BooksList authors={filteredBooks} scrollEnabled={false} />
          ) : (
            <BooksHome authors={filteredBooks} scrollEnabled={false} />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

export default LibraryScreen;
