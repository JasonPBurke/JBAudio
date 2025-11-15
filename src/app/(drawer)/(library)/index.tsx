import BooksList from '@/components/BooksList';
import BooksHome from '@/components/BooksHome';
import { BooksGrid } from '@/components/BooksGrid';
import { defaultStyles } from '@/styles';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  View,
  TextInput,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '@/components/Header';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useScanExternalFileSystem } from '@/hooks/useScanExternalFileSystem';
import { useAuthors, useLibraryStore } from '@/store/library';
import { FloatingPlayer } from '@/components/FloatingPlayer';
import { colors } from '@/constants/tokens';

const SEARCH_HEIGHT = 65;

const LibraryScreen = ({ navigation }: any) => {
  const [toggleView, setToggleView] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollY = useSharedValue(0);
  const scrollViewRef = useRef<ScrollView>(null);

  useScanExternalFileSystem();

  const initStore = useLibraryStore((state) => state.init);
  useEffect(() => {
    // Start observing the database and return the cleanup function.
    const unsubscribe = initStore();
    return () => unsubscribe();
  }, [initStore]);

  const library = useAuthors();

  const filteredLibrary = useMemo(() => {
    if (!searchQuery) return library;
    return library.filter((author) =>
      // author.name.toLowerCase().includes(searchQuery.toLowerCase())
      author.books.some((book) =>
        book.bookTitle.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
    // return library.filter(bookTitleFilter(searchQuery));
  }, [searchQuery, library]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.value = event.nativeEvent.contentOffset.y;
  };

  const searchContainerStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollY.value,
      [0, SEARCH_HEIGHT],
      [0, -SEARCH_HEIGHT],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ translateY }],
    };
  });

  return (
    <View style={defaultStyles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* MOVE HEADER ABOVE SCROLL VIEW TO DOCK IT AT TOP OF SCREEN */}
        <Header setToggleView={setToggleView} toggleView={toggleView} />
        <Animated.View
          style={[styles.searchContainer, searchContainerStyle]}
        >
          <TextInput
            style={styles.searchInput}
            placeholder='Search Library...'
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </Animated.View>

        <ScrollView
          ref={scrollViewRef}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: SEARCH_HEIGHT }}
        >
          {toggleView === 0 && (
            <BooksHome authors={filteredLibrary} scrollEnabled={false} />
          )}
          {toggleView === 1 && (
            <BooksList authors={filteredLibrary} scrollEnabled={false} />
          )}
          {toggleView === 2 && (
            <BooksGrid
              authors={filteredLibrary}
              scrollEnabled={false}
              standAlone={true}
              flowDirection='column'
            />
          )}
        </ScrollView>
      </SafeAreaView>
      <FloatingPlayer
        style={{
          position: 'absolute',
          left: 8,
          right: 8,
          bottom: 10,
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  searchContainer: {
    // The search bar is positioned below the header
    // borderColor: 'red',
    // borderWidth: 1,
    zIndex: -1,
  },
  searchInput: {
    backgroundColor: '#383838',
    borderRadius: 5,
    padding: 10,
    margin: 10,
    color: colors.textMuted,
  },
});

export default LibraryScreen;
