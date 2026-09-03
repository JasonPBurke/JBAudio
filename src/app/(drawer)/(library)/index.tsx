import BooksHome from '@/components/BooksHome';
import BooksGrid from '@/components/BooksGrid';
import BooksList from '@/components/BooksList';
import BooksLayoutToggle from '@/components/BooksLayoutToggle';
import SearchBar, { SEARCH_BAR_HEIGHT } from '@/components/SearchBar';
import { defaultStyles } from '@/styles';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Header from '@/components/Header';
import { useScanExternalFileSystem } from '@/hooks/useScanExternalFileSystem';
import { useLibraryStore } from '@/store/library';
import SeriesHome from '@/components/SeriesHome';
import { useDerivedSeries } from '@/store/seriesStore';
import {
  countSeriesByState,
  filterSeriesBySearch,
} from '@/helpers/seriesAssembly';
import { seriesEmptyMessage } from '@/helpers/seriesEmptyMessage';
import { useRouter } from 'expo-router';
import { useUIReadyStore } from '@/store/uiReadyStore';
import { FloatingPlayer } from '@/components/FloatingPlayer';
import CreateSeriesFab from '@/components/CreateSeriesFab';
import { CustomTabs } from '@/types/CustomTabs';
import { BookProgressState } from '@/helpers/bookProgressState';
import { LibraryRecencyMode } from '@/helpers/bookRecency';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useScrollDirection } from '@/hooks/useScrollDirection';
import type { LadderList } from '@/types/ladderList';
import type { SectionRange } from '@/helpers/ladderDecisions';
import { ladderViewFor } from '@/helpers/ladderView';
import type { BooksLayout } from '@/types/booksLayout';
import { useBackToTopLadder } from '@/hooks/useBackToTopLadder';
import * as Sentry from '@sentry/react-native';

// Normalize text for search matching (move outside component to avoid recreation)
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/gi, '');

const storeHasStartedBook = () =>
  Object.values(useLibraryStore.getState().books).some(
    (book) => book.bookProgressValue === BookProgressState.Started,
  );

const storeHasBooks = () =>
  Object.keys(useLibraryStore.getState().books).length > 0;

/**
 * The ranges the ladder reads before the sectioned view has published any --
 * the Series and grid views, and `booksHome`'s first commit. Module scope so
 * the ref's initial value is not a fresh array per mount, and `readonly`
 * because a shared module-level array handed to every mount must not be
 * writable through any of them.
 */
const NO_RANGES: readonly SectionRange[] = [];

const LibraryScreen = ({ navigation }: any) => {
  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();
  const [shelf, setShelf] = useState(0);
  /*
   * ADR 0006's SECOND AXIS. The header cycles the SHELF; the Books shelf --
   * alone -- also has a LAYOUT, and this is where it lives. Session state for
   * now; persisting it is the next ticket.
   *
   * ⚠ Not a fourth shelf ordinal. `LadderView` has a `booksList` member and
   * three comments in this tree read as an unfinished intention to add one;
   * ADR 0006 records that as the REJECTED design, not the next step.
   */
  const [booksLayout, setBooksLayout] = useState<BooksLayout>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);

  /*
   * §H1 -- the ONLY place the two axes are collapsed into one named view, and
   * both consumers below take this rather than the raw ordinal (ADR 0006).
   *
   * ⚠ `useScrollDirection`'s `surface` looks like an over-reach here and is
   * not: a layout flip replaces the mounted list while `shelf` is UNCHANGED,
   * so an ordinal-keyed surface would perform no reset and the hook's
   * remembered offset -- belonging to the outgoing list -- would make the
   * incoming list's first scroll event compute a delta against a position it
   * was never at.
   */
  const ladderView = ladderViewFor(shelf, booksLayout);
  const { onScroll, isVisible } = useScrollDirection({ surface: ladderView });
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
  const router = useRouter();

  /*
   * §H6/§I1 -- ONE list ref, owned here, threaded into whichever list is
   * mounted. Exactly one of the four views below is mounted at a time and
   * they are mutually exclusive, which is what makes a single shared ref
   * safe: React detaches the outgoing list's ref in the mutation phase and
   * attaches the incoming one in the layout phase, so `current` goes
   * old -> null -> new inside one commit with no JS interleaved.
   *
   * ⚠ A layout that mounts two lists at once (a tablet split, say) INVALIDATES
   * this and is not a drop-in change -- it raises a product question (which
   * pane does back act on?) before it raises a technical one.
   *
   * Two consumers, both installed below: the tab-change scroll reset, and the
   * back-to-top ladder. No list keeps a fallback ref of its own.
   */
  const listRef = useRef<LadderList | null>(null);

  /*
   * §H4/§H5 -- the sectioned view's index ranges, owned here and written by
   * `BooksHome` from a layout effect, before paint.
   *
   * A REF rather than state, deliberately: the trigger for a republication is
   * the library store emitting MID-SCAN, and holding these in state would
   * re-render the whole screen on every emission for data no render reads. The
   * ladder is the only consumer and it reads at press time.
   *
   * ⚠ Do not add a "clear it on toggle" here. It is never emptied, on purpose,
   * and the reason is §R5 -- written out once on `useBackToTopLadder`'s
   * `sectionRangesRef` parameter, which is the contract this ref satisfies.
   * Clearing it here would be a second, weaker copy of the identity gate that
   * already handles the case.
   */
  const sectionRangesRef = useRef<readonly SectionRange[]>(NO_RANGES);
  const handleSectionRangesChange = useCallback((ranges: SectionRange[]) => {
    sectionRangesRef.current = ranges;
  }, []);

  /*
   * §J1 -- the back-to-top ladder. The screen installs it; the lists only ever
   * receive the ref. On the sectioned view back now climbs three rungs -- the
   * header of the section you are inside, then the top of the list, then the
   * app backgrounds -- and two on every other view, where the identity gate
   * closes the first rung off.
   *
   * ⚠ There is deliberately no toast, no haptic and no "press back again to
   * exit". That convention exists for apps where the first press does nothing
   * visible; here the first press is visibly a scroll, and that IS the
   * feedback.
   *
   * It also returns the two settle handlers every list receives (§J1). They
   * carry the collapse sweep: arriving at the top of the sectioned view
   * collapses every expanded section that is not on screen. The handlers go to
   * ALL THREE lists rather than only the sectioned one -- the view-identity
   * gate inside the decision is what makes them inert elsewhere (§F9/§H2), and
   * a per-view `undefined` here would be a second, weaker copy of that gate.
   */
  const { onMomentumScrollEnd, onScrollEndDrag } = useBackToTopLadder({
    listRef,
    view: ladderView,
    sectionRangesRef,
    expanded: activeGridSections,
    setExpanded: setActiveGridSections,
  });

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

  // --- Series view data (shelf === 1) ---
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

  /*
   * §E8 — the library's create action now targets the SAME route as `Edit
   * series`; `id` absent is what makes it a create. The separate create-flow
   * entry (`/series/create/authors`) is one of §J3's two dead call sites and
   * went with the wizard. The draft reset moved onto the editor, which seeds
   * itself on mount and resets on removal, so this is a plain navigation.
   */
  const handleCreateSeries = useCallback(() => {
    router.navigate('/seriesEditor');
  }, [router]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  /*
   * D11 -- a flip is a VIEW SWITCH. It unmounts one list and mounts the other
   * at the top; the outgoing scroll position is discarded and the scroll
   * bookkeeping resets, because `ladderView` above changes with it.
   *
   * Carrying the reading position across a flip is a deliberate follow-up, not
   * an omission: masonry-to-linear has no clean offset correspondence, only an
   * item one, and this repo has been bitten by index-versus-offset differences
   * in this list library before.
   */
  const toggleBooksLayout = useCallback(() => {
    setBooksLayout((current) => (current === 'list' ? 'grid' : 'list'));
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
          setShelf={setShelf}
          shelf={shelf}
          selectedTab={selectedTab}
          setSelectedTab={setSelectedTab}
          bookCounts={shelf === 1 ? seriesCounts : bookCounts}
        />

        {/* Container for list + overlay search bar - overflow hidden clips the search bar */}
        <View style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {shelf === 0 && (
            <BooksHome
              authors={tabFilteredLibrary}
              recencyMode={recencyMode}
              setActiveGridSections={setActiveGridSections}
              activeGridSections={activeGridSections}
              onScroll={onScroll}
              ListHeaderComponent={ListSpacer}
              listRef={listRef}
              selectedTab={selectedTab}
              onMomentumScrollEnd={onMomentumScrollEnd}
              onScrollEndDrag={onScrollEndDrag}
              onSectionRangesChange={handleSectionRangesChange}
            />
          )}
          {shelf === 1 && (
            <SeriesHome
              series={tabFilteredSeries}
              onScroll={onScroll}
              ListHeaderSpacer={ListSpacer}
              emptyMessage={seriesEmptyText}
              listRef={listRef}
              selectedTab={selectedTab}
              onMomentumScrollEnd={onMomentumScrollEnd}
              onScrollEndDrag={onScrollEndDrag}
            />
          )}
          {shelf === 2 && booksLayout === 'grid' && (
            <BooksGrid
              authors={tabFilteredLibrary}
              recencyMode={recencyMode}
              standAlone={true}
              flowDirection='column'
              onScroll={onScroll}
              ListHeaderComponent={ListSpacer}
              listRef={listRef}
              selectedTab={selectedTab}
              onMomentumScrollEnd={onMomentumScrollEnd}
              onScrollEndDrag={onScrollEndDrag}
            />
          )}
          {/* The same shelf drawn the other way: the SAME search-filtered and
              tab-filtered Books, the same recency mode, the same spacer. Only
              the presentation differs, which is the whole of ADR 0006's case
              for Layout being an axis rather than a fourth stop. */}
          {shelf === 2 && booksLayout === 'list' && (
            <BooksList
              authors={tabFilteredLibrary}
              recencyMode={recencyMode}
              onScroll={onScroll}
              ListHeaderComponent={ListSpacer}
              listRef={listRef}
              selectedTab={selectedTab}
              onMomentumScrollEnd={onMomentumScrollEnd}
              onScrollEndDrag={onScrollEndDrag}
            />
          )}

          {/* Absolute positioned search bar overlay */}
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            onClear={handleClearSearch}
            isVisible={isVisible}
            /* D6/D7 -- the control rides the overlay's existing transform, so
               it travels with the bar for free. The bar takes a GENERIC node
               and learns nothing about layouts; the shelf conditional stays
               here, with the other two. */
            trailing={
              shelf === 2 ? (
                <BooksLayoutToggle
                  layout={booksLayout}
                  onPress={toggleBooksLayout}
                />
              ) : undefined
            }
          />
        </View>
      </View>
      {shelf === 1 && (
        <CreateSeriesFab isVisible={isVisible} onPress={handleCreateSeries} />
      )}
      <FloatingPlayer />
    </View>
  );
};

export default Sentry.wrap(LibraryScreen);
