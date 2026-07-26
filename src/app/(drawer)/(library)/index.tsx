import BooksHome from '@/components/BooksHome';
import BooksGrid from '@/components/BooksGrid';
import SeriesHome from '@/components/SeriesHome';
import SearchBar, { SEARCH_BAR_HEIGHT } from '@/components/SearchBar';
import { defaultStyles } from '@/styles';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Header from '@/components/Header';
import { useScanExternalFileSystem } from '@/hooks/useScanExternalFileSystem';
import { useLibraryStore } from '@/store/library';
import { useDerivedSeries } from '@/store/seriesStore';
import { useSeriesDraftStore } from '@/store/seriesDraftStore';
import {
  countSeriesByState,
  filterSeriesBySearch,
} from '@/helpers/seriesAssembly';
import { seriesEmptyMessage } from '@/helpers/seriesEmptyMessage';
import { useRouter } from 'expo-router';
import { useUIReadyStore } from '@/store/uiReadyStore';
import { FloatingPlayer } from '@/components/FloatingPlayer';
import { CustomTabs } from '@/types/CustomTabs';
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

const storeHasBooks = () =>
  Object.keys(useLibraryStore.getState().books).length > 0;

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
  const defaultTabAppliedRef = useRef(storeHasBooks());
  const userChangedTabRef = useRef(false);

  const setSelectedTab = useCallback((tab: CustomTabs) => {
    userChangedTabRef.current = true;
    setSelectedTabState(tab);
  }, []);

  // Set of expanded section ids — any number of sections may be open at once.
  // Empty on load = every section starts as a horizontal row. Session-only.
  //
  // NOTE (future): the IDEAL UX is a single open section at a time (auto-collapse
  // the previous one). We deliberately allow unlimited-open instead because
  // single-open triggers the FlashList v2 "case 3" jump/flash — collapsing a
  // still-visible section above the pressed header lets it drift up off-screen, and
  // every workaround (scrollToIndex pin, disabling MVCP, capping at 2 with
  // oldest/highest eviction) reintroduced a flash or flicker. Unlimited-open sidesteps
  // it entirely (expanding never collapses anything). If a clean fix for the case-3
  // jump is ever found, revert this to single-open. See memory
  // flashlist-2.3.2-mvcp-header-anchor.
  const [activeGridSections, setActiveGridSections] = useState<Set<string>>(
    () => new Set(),
  );
  // Separate expanded-set for the Series view (keyed by series id, not author
  // name) so the two views' expansion state never collide.
  const [activeSeriesSections, setActiveSeriesSections] = useState<
    Set<string>
  >(() => new Set());

  const router = useRouter();

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

  // --- Series view data (toggleView === 1) ---
  const allSeries = useDerivedSeries();

  // Search filters series by name OR contained book title.
  const seriesSearchFiltered = useMemo(
    () => filterSeriesBySearch(allSeries, debouncedSearchQuery),
    [allSeries, debouncedSearchQuery],
  );

  // Tab counts in Series view are SERIES counts (Completion model), not books.
  const seriesCounts = useMemo(
    () => countSeriesByState(seriesSearchFiltered),
    [seriesSearchFiltered],
  );

  // Map the shared progress tabs onto series aggregate state.
  const tabFilteredSeries = useMemo(() => {
    if (selectedTab === CustomTabs.All) return seriesSearchFiltered;
    const target =
      selectedTab === CustomTabs.Unplayed
        ? 'unplayed'
        : selectedTab === CustomTabs.Started
          ? 'playing'
          : 'finished';
    return seriesSearchFiltered.filter((s) => s.progressState === target);
  }, [selectedTab, seriesSearchFiltered]);

  const seriesEmptyText = useMemo(
    () =>
      seriesEmptyMessage({
        totalSeriesCount: allSeries.length,
        searchMatchCount: seriesSearchFiltered.length,
        hasSearchQuery: debouncedSearchQuery.trim().length > 0,
        selectedTab,
      }),
    [allSeries, seriesSearchFiltered, debouncedSearchQuery, selectedTab],
  );

  // Not wired to any button yet — the Create Series bar was removed from
  // SeriesHome's list header; a floating action button takes over calling
  // this (see Task 11).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleCreateSeries = useCallback(() => {
    useSeriesDraftStore.getState().resetForCreate();
    // Cast: expo-router typed routes regenerate once the series/ screens exist
    // (see player.tsx footprintList precedent).
    router.navigate('/series/create/authors' as any);
  }, [router]);

  const handleEditSeries = useCallback(
    (seriesId: string) => {
      router.navigate(`/series/edit/${seriesId}` as any);
    },
    [router],
  );

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
          bookCounts={toggleView === 1 ? seriesCounts : bookCounts}
        />

        {/* Container for list + overlay search bar - overflow hidden clips the search bar */}
        <View style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {toggleView === 0 && (
            <BooksHome
              authors={tabFilteredLibrary}
              recencyMode={recencyMode}
              setActiveGridSections={setActiveGridSections}
              activeGridSections={activeGridSections}
              onScroll={onScroll}
              ListHeaderComponent={ListSpacer}
            />
          )}
          {toggleView === 1 && (
            <SeriesHome
              series={tabFilteredSeries}
              activeGridSections={activeSeriesSections}
              setActiveGridSections={setActiveSeriesSections}
              onScroll={onScroll}
              ListHeaderSpacer={ListSpacer}
              emptyMessage={seriesEmptyText}
              onEditPress={handleEditSeries}
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
