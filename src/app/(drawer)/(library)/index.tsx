'use no memo'; // Uses Reanimated scroll handler

import BooksList from '@/components/BooksList';
import BooksHome from '@/components/BooksHome';
import BooksGrid from '@/components/BooksGrid';
import SearchBar, { SEARCH_BAR_HEIGHT } from '@/components/SearchBar';
import { defaultStyles } from '@/styles';
import { useCallback, useMemo, useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '@/components/Header';
import { useScanExternalFileSystem } from '@/hooks/useScanExternalFileSystem';
import { useLibraryStore } from '@/store/library';
import { FloatingPlayer } from '@/components/FloatingPlayer';
import { CustomTabs } from '@/components/TabScreen';
import { BookProgressState } from '@/helpers/handleBookPlay';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useScrollDirection } from '@/hooks/useScrollDirection';
import * as Sentry from '@sentry/react-native';

// Normalize text for search matching (move outside component to avoid recreation)
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/gi, '');

const LibraryScreen = ({ navigation }: any) => {
  const { colors: themeColors } = useTheme();
  const [toggleView, setToggleView] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
  const { onScroll, isVisible } = useScrollDirection();
  const [selectedTab, setSelectedTab] = useState<CustomTabs>(
    CustomTabs.Unplayed,
  );

  const [activeGridSection, setActiveGridSection] = useState<string | null>(
    null, // null for horizontal on load, 'recentlyAdded' for expanded on load
  );

  useScanExternalFileSystem();

  // Note: Library store init is handled in _layout.tsx to ensure it runs before useSetupTrackPlayer

  const allAuthors = useLibraryStore((state) => state.authors);

  // Step 1: Apply search filter to all authors (if search is active)
  const searchFilteredAuthors = useMemo(() => {
    if (!debouncedSearchQuery) return allAuthors;

    const trimmed = debouncedSearchQuery.trim();
    const qRaw = trimmed.toLowerCase();
    const qNorm = normalize(trimmed);

    return allAuthors.reduce(
      (acc, author) => {
        const authorMatch = author.name.toLowerCase().includes(qRaw);
        if (authorMatch) {
          // Include all books for authors that match by name
          acc.push(author);
          return acc;
        }
        const matchingBooks = author.books.filter((book) =>
          normalize(book.bookTitle).includes(qNorm),
        );
        if (matchingBooks.length > 0) {
          // Include only titles that match for authors that don't match by name
          acc.push({ ...author, books: matchingBooks });
        }
        return acc;
      },
      [] as typeof allAuthors,
    );
  }, [debouncedSearchQuery, allAuthors]);

  // Step 2: Calculate counts from search-filtered authors
  const bookCounts = useMemo(() => {
    const counts = { all: 0, unplayed: 0, playing: 0, finished: 0 };

    for (const author of searchFilteredAuthors) {
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
  }, [searchFilteredAuthors]);

  // Step 3: Apply tab filter to search-filtered authors
  const tabFilteredLibrary = useMemo(() => {
    if (selectedTab === CustomTabs.All) {
      return searchFilteredAuthors;
    }

    const progressStateMap = {
      [CustomTabs.Unplayed]: BookProgressState.NotStarted,
      [CustomTabs.Started]: BookProgressState.Started,
      [CustomTabs.Finished]: BookProgressState.Finished,
    };

    const targetState = progressStateMap[selectedTab];

    return searchFilteredAuthors.reduce(
      (acc, author) => {
        const matchingBooks = author.books.filter(
          (book) => book.bookProgressValue === targetState,
        );
        if (matchingBooks.length > 0) {
          acc.push({ ...author, books: matchingBooks });
        }
        return acc;
      },
      [] as typeof allAuthors,
    );
  }, [selectedTab, searchFilteredAuthors]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  // Spacer to offset list content below the absolute-positioned search bar
  const ListSpacer = useMemo(
    () => <View style={{ height: SEARCH_BAR_HEIGHT }} />,
    [],
  );

  return (
    <View
      style={[
        defaultStyles.container,
        { backgroundColor: themeColors.background },
      ]}
    >
      <SafeAreaView style={{ flex: 1 }}>
        {/* MOVE HEADER ABOVE SCROLL VIEW TO DOCK IT AT TOP OF SCREEN */}
        <Header
          setToggleView={setToggleView}
          toggleView={toggleView}
          selectedTab={selectedTab}
          setSelectedTab={setSelectedTab}
          bookCounts={bookCounts}
        />

        {/* Container for list + overlay search bar - overflow hidden clips the search bar */}
        <View style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {toggleView === 0 && (
            <BooksHome
              authors={tabFilteredLibrary}
              setActiveGridSection={setActiveGridSection}
              activeGridSection={activeGridSection}
              onScroll={onScroll}
              ListHeaderComponent={ListSpacer}
            />
          )}
          {toggleView === 1 && (
            <BooksList
              authors={tabFilteredLibrary}
              onScroll={onScroll}
              ListHeaderComponent={ListSpacer}
            />
          )}
          {toggleView === 2 && (
            <BooksGrid
              authors={tabFilteredLibrary}
              standAlone={true}
              flowDirection='column'
              onScroll={onScroll}
              ListHeaderComponent={ListSpacer}
            />
          )}

          {/* Absolute positioned search bar overlay */}
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            onClear={handleClearSearch}
            isVisible={isVisible}
          />
        </View>
      </SafeAreaView>
      <FloatingPlayer />
    </View>
  );
};

export default Sentry.wrap(LibraryScreen);
