import { BookListProps, BooksList } from '@/components/BooksList';
import { screenPadding } from '@/constants/tokens';
import { useNavigationSearch } from '@/hooks/useNavigationSearch';
import { defaultStyles, utilsStyles } from '@/styles';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import library from '@/assets/data/library.json';
import { SafeAreaView } from 'react-native-safe-area-context';
import { bookTitleFilter } from '@/helpers/filter';
import Header from '@/components/Header';
import { BooksHome } from '@/components/BooksHome';
import { Track } from 'react-native-track-player';
import * as RNFS from '@dr.pogodin/react-native-fs';
import { useScanExternalFileSystem } from '@/hooks/useScanExternalFileSystem';

const fileName = 'Audiobooks/Mort.m4b';
const localBook = `${RNFS.ExternalStorageDirectoryPath}/${fileName}`;

//! THIS WILL BE IN ITS OWN USE HOOK TO BUILD THE LIBRARY
const myLibrary: any = [
  {
    url: localBook,
    title: 'Mort',
    author: 'Terry Pratchett',
    artwork: 'https://m.media-amazon.com/images/I/519CzoTby1L._SL1000_.jpg',
  },
  {
    url: `${RNFS.ExternalStorageDirectoryPath}/Audiobooks/Travis Baldree/bookshops-bonedust.m4b`,
    title: 'Bookshops & Bonedust',
    author: 'Travis Baldree',
    artwork: 'https://m.media-amazon.com/images/I/81LnJAvh0mL._SL1500_.jpg',
  },
];

const LibraryScreen = () => {
  const testLibrary = useScanExternalFileSystem();

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
          <BooksList books={filteredBooks} scrollEnabled={false} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

export default LibraryScreen;
