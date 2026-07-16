'use no memo'; // Uses Reanimated scroll handler

import BooksList from '@/components/BooksList';
import BooksHome from '@/components/BooksHome';
import BooksGrid from '@/components/BooksGrid';
import SearchBar, { SEARCH_BAR_HEIGHT } from '@/components/SearchBar';
import { defaultStyles } from '@/styles';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Header from '@/components/Header';
import { useScanExternalFileSystem } from '@/hooks/useScanExternalFileSystem';
import { useLibraryStore } from '@/store/library';
import { useUIReadyStore } from '@/store/uiReadyStore';
import { FloatingPlayer } from '@/components/FloatingPlayer';
import { CustomTabs } from '@/components/TabScreen';
import { BookProgressState } from '@/helpers/handleBookPlay';
import { LibraryRecencyMode } from '@/helpers/bookRecency';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useScrollDirection } from '@/hooks/useScrollDirection';
import * as Sentry from '@sentry/react-native';

// Normalize text for search matching (move outside component to avoid recreation)
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/gi, '');

const storeHasStartedBook = () =>
  Object.values(useLibraryStore.getState().books).some(
    (book) => book.bookProgressValue === BookProgressState.Started,
  );

const LibraryScreen = ({ navigation }: any) => {
  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();
  const [toggleView, setToggleView] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
  const { onScroll, isVisible } = useScrollDirection();
  // Default tab: land on Started when a book is in progress so a returning
  // listener sees their current book without a tab tap. Decided once per app
  // launch — never auto-switched after the user picks a tab themselves.
  const [selectedTab, setSelectedTabState] = useState<CustomTabs>(() =>
    storeHasStartedBook() ? CustomTabs.Started : CustomTabs.Unplayed,
  );
  // The library store hydrates asynchronously on cold start; if it was still
  // empty when the initializer above ran, apply the default once data arrives
  // (unless the user has already tapped a tab).
  const defaultTabAppliedRef = useRef(
    Object.keys(useLibraryStore.getState().books).length > 0,
  );
  const userChangedTabRef = useRef(false);

  const setSelectedTab = useCallback((tab: CustomTabs) => {
    userChangedTabRef.current = true;
    setSelectedTabState(tab);
  }, []);

  const [activeGridSection, setActiveGridSection] = useState<string | null>(
    null, // null for horizontal on load, 'recentlyAdded' for expanded on load
  );

  useScanExternalFileSystem();

  // Signal that the library screen has rendered so _layout can hide the splash.
  // This fires after the first commit; combined with requestIdleCallback in
  // _layout, RN gets time to paint before the splash dissolves.
  useEffect(() => {
    useUIReadyStore.getState().markLibraryFirstRenderDone();
  }, []);

  // Note: Library store init is handled in _layout.tsx to ensure it runs before useSetupTrackPlayer

  const allAuthors = useLibraryStore((state) => state.authors);

  useEffect(() => {
    if (defaultTabAppliedRef.current || userChangedTabRef.current) return;
    if (allAuthors.length === 0) return;
    defaultTabAppliedRef.current = true;
    if (storeHasStartedBook()) {
      setSelectedTabState(CustomTabs.Started);
    }
  }, [allAuthors]);

  // Started/Finished tabs order books most-recent-first; other tabs keep
  // their existing title/date-added ordering.
  const recencyMode: LibraryRecencyMode =
    selectedTab === CustomTabs.Started
      ? 'played'
      : selectedTab === CustomTabs.Finished
        ? 'finished'
        : null;

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
      {/* JS-driven padding instead of <SafeAreaView>: the native SafeAreaView
          computes padding via onPreDraw and can paint one frame with zero
          insets on cold start, flashing the header behind the status bar. */}
      <View
        style={{
          flex: 1,
          paddingTop: insets.top,
          //* if you want to scroll behind the bottom nav, rm paddingBottom
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        }}
      >
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
              recencyMode={recencyMode}
              setActiveGridSection={setActiveGridSection}
              activeGridSection={activeGridSection}
              onScroll={onScroll}
              ListHeaderComponent={ListSpacer}
            />
          )}
          {toggleView === 1 && (
            <BooksList
              authors={tabFilteredLibrary}
              recencyMode={recencyMode}
              onScroll={onScroll}
              ListHeaderComponent={ListSpacer}
            />
          )}
          {toggleView === 2 && (
            <BooksGrid
              authors={tabFilteredLibrary}
              recencyMode={recencyMode}
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
      </View>
      <FloatingPlayer />
    </View>
  );
};

export default Sentry.wrap(LibraryScreen);
