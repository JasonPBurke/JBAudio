import BooksList from '@/components/BooksList';
import BooksHome from '@/components/BooksHome';
import BooksGrid from '@/components/BooksGrid';
import { defaultStyles } from '@/styles';
import { useEffect, useMemo, useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '@/components/Header';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { useScanExternalFileSystem } from '@/hooks/useScanExternalFileSystem';
import { useLibraryStore } from '@/store/library';
import { FloatingPlayer } from '@/components/FloatingPlayer';
import { colors } from '@/constants/tokens';
import { X } from 'lucide-react-native';
import { CustomTabs } from '@/components/TabScreen';
import { BookProgressState } from '@/helpers/handleBookPlay';
import * as Sentry from '@sentry/react-native';

const SEARCH_HEIGHT = 65;

const LibraryScreen = ({ navigation }: any) => {
  const { colors: themeColors } = useTheme();
  const [toggleView, setToggleView] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollY = useSharedValue(0);
  const [selectedTab, setSelectedTab] = useState<CustomTabs>(
    CustomTabs.All
  );

  const [activeGridSection, setActiveGridSection] = useState<string | null>(
    null // null for horizontal on load, 'recentlyAdded' for expanded on load
  );

  useScanExternalFileSystem();

  const initStore = useLibraryStore((state) => state.init);
  useEffect(() => {
    // Start observing the database and return the cleanup function.
    const unsubscribe = initStore();
    return () => unsubscribe();
  }, [initStore]);

  const allAuthors = useLibraryStore((state) => state.authors);

  const bookCounts = useMemo(() => {
    const counts = { all: 0, unplayed: 0, playing: 0, finished: 0 };

    for (const author of allAuthors) {
      for (const book of author.books) {
        counts.all++;
        switch (book.bookProgressValue) {
          case BookProgressState.NotStarted:
            counts.unplayed++;
            break;
          case BookProgressState.Started:
            counts.playing++;
            break;
          case BookProgressState.Finished:
            counts.finished++;
            break;
        }
      }
    }

    return counts;
  }, [allAuthors]);

  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]/gi, '');

  const tabFilteredLibrary = useMemo(() => {
    if (selectedTab === CustomTabs.All) {
      return allAuthors;
    }

    const progressStateMap = {
      [CustomTabs.Unplayed]: BookProgressState.NotStarted,
      [CustomTabs.Started]: BookProgressState.Started,
      [CustomTabs.Finished]: BookProgressState.Finished,
    };

    const targetState = progressStateMap[selectedTab];

    return allAuthors.reduce(
      (acc, author) => {
        const matchingBooks = author.books.filter(
          (book) => book.bookProgressValue === targetState
        );
        if (matchingBooks.length > 0) {
          acc.push({ ...author, books: matchingBooks });
        }
        return acc;
      },
      [] as typeof allAuthors
    );
  }, [selectedTab, allAuthors]);

  const filteredLibrary = useMemo(() => {
    if (!searchQuery) return tabFilteredLibrary;
    const qRaw = searchQuery.toLowerCase();
    const qNorm = normalize(searchQuery);
    return tabFilteredLibrary.reduce(
      (acc, author) => {
        const authorMatch = author.name.toLowerCase().includes(qRaw);
        if (authorMatch) {
          // Include all books for authors that match by name
          acc.push(author);
          return acc;
        }
        const matchingBooks = author.books.filter((book) =>
          normalize(book.bookTitle).includes(qNorm)
        );
        if (matchingBooks.length > 0) {
          // Include only titles that match for authors that don't match by name
          acc.push({ ...author, books: matchingBooks });
        }
        return acc;
      },
      [] as typeof allAuthors
    );
  }, [searchQuery, tabFilteredLibrary]);

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
      [0, 25],
      [1, 0],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ translateY }],
      opacity,
    };
  });

  const SearchComponent = (
    <Animated.View style={[styles.searchContainer, searchContainerStyle]}>
      <TextInput
        style={styles.searchInput}
        placeholder='Search books, authors...'
        value={searchQuery}
        onChangeText={setSearchQuery}
        cursorColor={themeColors.primary}
        selectionColor={themeColors.primary}
      />
      {searchQuery.length > 0 && (
        <TouchableOpacity
          onPress={() => setSearchQuery('')}
          style={styles.clearButton}
        >
          <X size={21} color={themeColors.text} strokeWidth={1} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );

  return (
    <View style={[defaultStyles.container, { backgroundColor: themeColors.background }]}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* MOVE HEADER ABOVE SCROLL VIEW TO DOCK IT AT TOP OF SCREEN */}
        <Header
          setToggleView={setToggleView}
          toggleView={toggleView}
          selectedTab={selectedTab}
          setSelectedTab={setSelectedTab}
          bookCounts={bookCounts}
        />

        {toggleView === 0 && (
          <BooksHome
            authors={filteredLibrary}
            setActiveGridSection={setActiveGridSection}
            activeGridSection={activeGridSection}
            onScroll={scrollHandler}
            ListHeaderComponent={SearchComponent}
          />
        )}
        {toggleView === 1 && <BooksList authors={filteredLibrary} />}
        {toggleView === 2 && (
          <BooksGrid
            authors={filteredLibrary}
            standAlone={true}
            flowDirection='column'
          />
        )}
      </SafeAreaView>
      <FloatingPlayer />
    </View>
  );
};

const styles = StyleSheet.create({
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 5,
  },
  searchInput: {
    width: '95%',
    backgroundColor: colors.background,
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
    color: colors.textMuted,
  },
});

export default Sentry.wrap(LibraryScreen);
