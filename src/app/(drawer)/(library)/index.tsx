import BooksList from '@/components/BooksList';
import BooksHome from '@/components/BooksHome';
import { BooksGrid } from '@/components/BooksGrid';
import { defaultStyles } from '@/styles';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '@/components/Header';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { ScrollView } from 'react-native-gesture-handler';
import { useScanExternalFileSystem } from '@/hooks/useScanExternalFileSystem';
import { useAuthors, useLibraryStore } from '@/store/library';
import { FloatingPlayer } from '@/components/FloatingPlayer';
import { colors } from '@/constants/tokens';
import { X } from 'lucide-react-native';

const SEARCH_HEIGHT = 65;

const LibraryScreen = ({ navigation }: any) => {
  const [toggleView, setToggleView] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollY = useSharedValue(0);
  const scrollViewRef = useRef<Animated.ScrollView>(null);

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

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const searchContainerStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollY.value,
      [0, SEARCH_HEIGHT],
      [0, -SEARCH_HEIGHT],
      Extrapolation.CLAMP
    );

    const opacity = interpolate(
      scrollY.value,
      [0, 20],
      [1, 0],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ translateY }],
      opacity,
    };
  });

  return (
    <View style={defaultStyles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* MOVE HEADER ABOVE SCROLL VIEW TO DOCK IT AT TOP OF SCREEN */}
        <Header setToggleView={setToggleView} toggleView={toggleView} />

        <Animated.ScrollView
          ref={scrollViewRef}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 0 }}
        >
          {/* Search Bar */}
          <Animated.View
            style={[styles.searchContainer, searchContainerStyle]}
          >
            <TextInput
              style={styles.searchInput}
              placeholder='Search Library...'
              value={searchQuery}
              onChangeText={setSearchQuery}
              cursorColor={colors.primary}
              selectionColor={colors.primary}
            />
            {searchQuery.length > 0 && ( // Conditionally render the clear button
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                style={styles.clearButton}
              >
                <X size={21} color={colors.text} strokeWidth={1} />
              </TouchableOpacity>
            )}
          </Animated.View>
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
        </Animated.ScrollView>
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
    // width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    // justifyContent: 'space-between',
    // borderWidth: 1,
    // borderColor: '#ccc',
    borderRadius: 5,
    // paddingHorizontal: 10,
    // margin: 10,
  },
  searchInput: {
    width: '95%',
    backgroundColor: '#303030',
    borderRadius: 5,
    padding: 10,
    margin: 10,
    color: colors.textMuted,
  },
  clearButton: {
    position: 'absolute',
    right: 12,
    padding: 5,
  },
  clearButtonText: {
    fontSize: 16,
    color: '#999',
  },
});

export default LibraryScreen;
