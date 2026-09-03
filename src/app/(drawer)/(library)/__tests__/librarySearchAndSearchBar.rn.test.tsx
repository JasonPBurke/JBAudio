import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { BookProgressState } from '@/helpers/bookProgressState';

/**
 * The library screen, mounted for real, for the two things that only the
 * SCREEN can answer:
 *
 *  1. An active search survives a view switch. Typing "Bob" and moving
 *     BooksHome -> SeriesHome must keep filtering by "Bob", and must keep the
 *     text in the bar so the user can still see and clear it.
 *  2. The search bar's visibility is actually WIRED to the view. The hook that
 *     owns that decision is covered exhaustively in
 *     `src/hooks/__tests__/useScrollDirection.rn.test.tsx`; what cannot be
 *     asserted there is that this screen hands it a value that CHANGES rather
 *     than something that never does. A perfect hook that is not wired up is
 *     still a broken search bar.
 *  3. The Books shelf's LAYOUT (ADR 0006). Which of the two lists is mounted,
 *     what the incoming one is handed, and whether the control is offered at
 *     all are all properties of this screen and of nothing smaller.
 *
 * ── Why the mock list is this long ──
 *
 * Trap 7 in docs/testing/jest-projects-and-rn-tests.md: every library list in
 * this app sits behind a transform cascade (FlashList, then `pressto`, then
 * the next one), and widening the shared lane's `transformIgnorePatterns` for
 * one suite was already tried and backed out once. Mocking the four lists at
 * their module boundary sidesteps the cascade entirely -- jest replaces them
 * before FlashList is ever resolved -- and costs a stub apiece.
 *
 * What is deliberately NOT mocked is the part under test: `useScrollDirection`
 * and both search filters (`filterSeriesBySearch` and the screen's own author
 * reducer) run for real, so a filter that stopped being applied would fail
 * here rather than pass against a fake.
 */

/*
 * jest.mock factories are hoisted above the imports, so anything they touch
 * must be declared with a `mock` prefix -- jest rejects other out-of-scope
 * references outright.
 */
const mockSeen: {
  searchBar: any;
  booksHome: any;
  seriesHome: any;
  booksGrid: any;
  booksList: any;
} = {
  searchBar: null,
  booksHome: null,
  seriesHome: null,
  booksGrid: null,
  booksList: null,
};

const mockAuthors = [
  {
    name: 'Bob Author',
    books: [
      { bookTitle: 'Bobs Adventure', bookProgressValue: BookProgressState.NotStarted },
      { bookTitle: 'Another Bob Tale', bookProgressValue: BookProgressState.NotStarted },
    ],
  },
  {
    name: 'Zoe Writer',
    books: [
      { bookTitle: 'Unrelated Story', bookProgressValue: BookProgressState.NotStarted },
    ],
  },
  /*
   * ADDITIVE, for the layout suite's recency-mode case, which needs the Started
   * tab to hold something. A third author rather than flipping one of the two
   * above to `Started`: those two are the input to six pre-existing tests, and
   * changing what one of THEIR books is would make this suite's older
   * assertions depend on a fixture edit made for a newer one.
   *
   * Invisible to every one of those tests, which all run on the default
   * `Unplayed` tab: this author's only book is `Started`, so the tab filter
   * drops the author entirely and the counts they assert do not move. It
   * matches the "Bob" search by NAME, which is what puts it on the Started tab
   * with a query applied.
   */
  {
    name: 'Bob Reader',
    books: [
      { bookTitle: 'Bob In Progress', bookProgressValue: BookProgressState.Started },
    ],
  },
];

const mockSeries = [
  {
    id: 's1',
    name: 'The Bob Chronicles',
    artwork: null,
    books: [{ bookTitle: 'Bobs Adventure' }],
    progressState: 'unplayed',
  },
  {
    id: 's2',
    name: 'Unrelated Saga',
    artwork: null,
    books: [{ bookTitle: 'Unrelated Story' }],
    progressState: 'unplayed',
  },
];

const mockLibraryState = { books: {}, authors: mockAuthors };

/*
 * Reanimated: the shipped `/mock` re-enters the real index and dies inside
 * react-native-worklets' native half (trap 3), so this suite carries its own.
 * Only what `useScrollDirection` touches -- the SearchBar is stubbed below, so
 * nothing here needs an animated component.
 *
 * `useSharedValue` must return a STABLE object, as the real one does: a fresh
 * object per render would quietly reset the hidden state on every re-render,
 * and re-renders are exactly what these cases provoke.
 */
jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useRef } = require('react');
  return {
    __esModule: true,
    useSharedValue: (initial: number) => {
      // No type argument -- `require('react')` is untyped (TS2347).
      const ref = useRef(null);
      if (ref.current === null) {
        ref.current = {
          value: initial,
          get() {
            return this.value;
          },
          set(v: number) {
            this.value = v;
          },
        };
      }
      return ref.current;
    },
    // These tests pin WHICH target the hook asks for, not the 200 ms ramp.
    withTiming: (toValue: number) => toValue,
  };
});

/** Record what a list was handed, and render something cheap. */
function mockListComponent(key: keyof typeof mockSeen, label: string) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require('react-native');
  const Stub = (props: any) => {
    mockSeen[key] = props;
    return React.createElement(Text, null, label);
  };
  Stub.displayName = `Mock${label}`;
  return Stub;
}

jest.mock('@/components/BooksHome', () => ({
  __esModule: true,
  default: mockListComponent('booksHome', 'BooksHome'),
}));
jest.mock('@/components/SeriesHome', () => ({
  __esModule: true,
  default: mockListComponent('seriesHome', 'SeriesHome'),
}));
jest.mock('@/components/BooksGrid', () => ({
  __esModule: true,
  default: mockListComponent('booksGrid', 'BooksGrid'),
}));
// The Books shelf's OTHER layout. Same treatment as the grid: it is a
// FlashList behind the same transform cascade (trap 7), and what this suite
// asserts is which of the two the screen mounted and what it handed it.
jest.mock('@/components/BooksList', () => ({
  __esModule: true,
  default: mockListComponent('booksList', 'BooksList'),
}));

/*
 * The real SearchBar is a reanimated overlay whose position is only readable
 * on the UI thread. Its props are the honest seam instead: `value` is the text
 * the user sees, and `isVisible` is the shared value the overlay translates
 * itself by. Asserting on those asserts on the bar.
 */
jest.mock('@/components/SearchBar', () => ({
  __esModule: true,
  SEARCH_BAR_HEIGHT: 38,
  default: (props: any) => {
    mockSeen.searchBar = props;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text, View } = require('react-native');
    /*
     * ⚠ The stub MUST render `props.trailing`. The layout control is passed
     * into the bar as a node, so a stub that only records its props would
     * never MOUNT it -- there would be nothing to find and nothing to press,
     * and every assertion below would fail for a reason that has nothing to
     * do with the screen.
     */
    return React.createElement(
      View,
      null,
      React.createElement(Text, { testID: 'search-bar' }, props.value),
      props.trailing,
    );
  },
}));

/** Stands in for the header's view toggle, which is all this suite drives. */
jest.mock('@/components/Header', () => ({
  __esModule: true,
  default: ({ setShelf, setSelectedTab }: any) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text } = require('react-native');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { CustomTabs } = require('@/types/CustomTabs');
    return React.createElement(
      Text,
      null,
      React.createElement(
        Text,
        {
          testID: 'cycle-view',
          // The real header cycles the same way -- Header.tsx:92.
          onPress: () => setShelf((v: number) => (v + 1) % 3),
        },
        'Header',
      ),
      // The real header's progress tabs live in `TabScreen`; only the Started
      // one is driven here, because it is the tab that turns the recency mode
      // into a value worth comparing between the two Books layouts.
      React.createElement(
        Text,
        {
          testID: 'select-started-tab',
          onPress: () => setSelectedTab(CustomTabs.Started),
        },
        'Started',
      ),
    );
  },
}));

jest.mock('@/components/FloatingPlayer', () => ({
  __esModule: true,
  FloatingPlayer: () => null,
}));
jest.mock('@/components/CreateSeriesFab', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/store/library', () => ({
  useLibraryStore: Object.assign(
    (selector: any) => selector(mockLibraryState),
    { getState: () => mockLibraryState },
  ),
}));
/*
 * The layout is a PERSISTED setting, so the screen reads it from the settings
 * store rather than from its own state. A real zustand store stands in for it:
 * the store's own suite owns the DB half (the seed, the getter, the write), and
 * what this suite needs is the half the screen can observe -- a value that
 * outlives a mount, and a setter that re-renders.
 */
jest.mock('@/store/settingsStore', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { create } = require('zustand');
  return {
    useSettingsStore: create((set: any) => ({
      booksLayout: 'grid',
      setBooksLayout: async (layout: string) => set({ booksLayout: layout }),
    })),
  };
});
jest.mock('@/store/seriesStore', () => ({
  useDerivedSeries: () => mockSeries,
}));
jest.mock('@/store/uiReadyStore', () => ({
  useUIReadyStore: { getState: () => ({ markLibraryFirstRenderDone: () => {} }) },
}));
jest.mock('@/hooks/useScanExternalFileSystem', () => ({
  useScanExternalFileSystem: () => {},
}));
jest.mock('@/hooks/useBackToTopLadder', () => ({
  useBackToTopLadder: () => ({
    onMomentumScrollEnd: () => {},
    onScrollEndDrag: () => {},
  }),
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#000',
      modalBackground: '#111',
      text: '#fff',
      textMuted: '#888',
      primary: '#0af',
      // The layout control renders for real in this suite and reads this one.
      icon: '#fff',
    },
  }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: () => {} }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Imported after the mocks so the screen resolves the stubs above.
// eslint-disable-next-line import/first
import LibraryScreen from '@/app/(drawer)/(library)/index';
// eslint-disable-next-line import/first
import { useSettingsStore } from '@/store/settingsStore';

/** Let React commit and effects run. Real timers -- fake ones break RNTL 14. */
function settle() {
  return act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/**
 * Wait out `useDebouncedValue(searchQuery, 300)`, which is what the filters
 * actually read. Real time, for the same reason: fake timers break the async
 * render, and a "the filter applied" assertion would then pass or fail for
 * reasons unrelated to the filter.
 */
function settleDebounce() {
  return act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 350));
  });
}

const scrollTo = (y: number) => ({ nativeEvent: { contentOffset: { y } } });

/*
 * ⚠ In RNTL 14 `render` and `fireEvent` return PROMISES, exactly as
 * `renderHook`/`rerender`/`unmount` do. A missing `await` does not throw --
 * it interleaves act scopes, and React reports it as "You seem to have
 * overlapping act() calls" from deep inside react.development.js, naming no
 * line in the test. The visible symptom is captured props reading `null`,
 * which looks like a broken mock rather than a missing await. Every helper
 * below awaits both.
 */
async function mountLibrary() {
  await render(<LibraryScreen />);
  await settle();
}

/** Type into the bar and let the 300 ms debounce reach the filters. */
async function typeSearch(text: string) {
  await act(async () => {
    mockSeen.searchBar.onChangeText(text);
  });
  await settleDebounce();
}

/** Press the header's view toggle: BooksHome -> SeriesHome -> BooksGrid. */
async function cycleView() {
  await fireEvent.press(screen.getByTestId('cycle-view'));
  await settle();
}

/** Drive a mounted list's `onScroll` to a given offset. */
async function scrollList(list: any, y: number) {
  await act(async () => {
    list.onScroll(scrollTo(y));
  });
}

/** Scroll the mounted list down far enough to hide the bar. */
const scrollListDown = (list: any) => scrollList(list, 100);

/** Press the header's Started tab, the one tab that turns recency mode on. */
async function selectStartedTab() {
  await fireEvent.press(screen.getByTestId('select-started-tab'));
  await settle();
}

/** BooksHome -> SeriesHome -> BooksGrid, the reader's route to the Books shelf. */
async function goToBooksShelf() {
  await cycleView();
  await cycleView();
}

/**
 * How TalkBack finds the layout control, and therefore how this suite does.
 * One spelling, because a test that looks it up by a DIFFERENT string than the
 * component publishes would fail for a reason that is not the screen's.
 */
const LAYOUT_CONTROL = 'Book layout';

/** The layout control, or null when the shelf does not offer one. */
const layoutControl = () =>
  screen.queryByRole('button', { name: LAYOUT_CONTROL });

/** Press it. Only reachable on the Books shelf, and only while the bar shows. */
async function flipLayout() {
  await fireEvent.press(screen.getByRole('button', { name: LAYOUT_CONTROL }));
  await settle();
}

/** Scroll back to the top of the mounted list, which brings the bar back. */
const scrollListUp = (list: any) => scrollList(list, 0);

beforeEach(() => {
  // Module state, so it survives between tests exactly as the real store does.
  useSettingsStore.setState({ booksLayout: 'grid' });
  mockSeen.searchBar = null;
  mockSeen.booksHome = null;
  mockSeen.seriesHome = null;
  mockSeen.booksGrid = null;
  mockSeen.booksList = null;
});

describe('library screen: search and the search bar across a view switch', () => {
  it('starts on BooksHome with every author', async () => {
    await mountLibrary();

    expect(screen.getByText('BooksHome')).toBeTruthy();
    expect(mockSeen.booksHome.authors).toHaveLength(2);
  });

  it('keeps the query FILTERING after a view switch', async () => {
    await mountLibrary();
    await typeSearch('Bob');

    // Filtered on the books view: Zoe Writer is gone.
    expect(mockSeen.booksHome.authors).toHaveLength(1);
    expect(mockSeen.booksHome.authors[0].name).toBe('Bob Author');

    await cycleView();

    /*
     * The user's ask: the filter carries over. `searchQuery` lives on this
     * screen, which does not unmount when the lists swap, so the SAME query
     * now filters series -- by series name or by a contained book title.
     */
    expect(screen.getByText('SeriesHome')).toBeTruthy();
    expect(mockSeen.seriesHome.series).toHaveLength(1);
    expect(mockSeen.seriesHome.series[0].name).toBe('The Bob Chronicles');
  });

  it('keeps the query TEXT in the bar after a view switch, so it can be seen and cleared', async () => {
    await mountLibrary();
    await typeSearch('Bob');
    await cycleView();

    // A filter with no visible cause is worse than no filter: the bar has to
    // still show what it is filtering by, and still offer the clear button.
    expect(mockSeen.searchBar.value).toBe('Bob');
    expect(screen.getByTestId('search-bar')).toHaveTextContent('Bob');
  });

  it('carries the query through ALL THREE views', async () => {
    await mountLibrary();
    await typeSearch('Bob');

    await cycleView(); // -> SeriesHome
    await cycleView(); // -> BooksGrid

    expect(screen.getByText('BooksGrid')).toBeTruthy();
    expect(mockSeen.searchBar.value).toBe('Bob');
    expect(mockSeen.booksGrid.authors).toHaveLength(1);
    expect(mockSeen.booksGrid.authors[0].name).toBe('Bob Author');
  });

  it('brings the search bar back when the view switches while it is hidden', async () => {
    await mountLibrary();
    const { isVisible } = mockSeen.searchBar;

    await scrollListDown(mockSeen.booksHome);
    expect(isVisible.get()).toBe(0);

    await cycleView();

    /*
     * THE BUG, at the call site. The lists swap but this screen does not
     * unmount, so `isVisible` survives -- and before the fix nothing told it
     * to come back, leaving a blank spacer where the bar should be and no way
     * to reach it on a list too short to scroll.
     *
     * This is also the assertion that pins the WIRING: the hook only resets
     * because this screen passes `shelf` as its `surface`. A correct hook
     * that nothing hands a changing value to is still a broken search bar.
     */
    expect(isVisible.get()).toBe(1);
  });

  it('reveals on EVERY view switch, not just the first', async () => {
    await mountLibrary();
    const { isVisible } = mockSeen.searchBar;

    await scrollListDown(mockSeen.booksHome);
    await cycleView(); // -> SeriesHome
    expect(isVisible.get()).toBe(1);

    // Hide it again on the new list, then switch on. A reset that fired once
    // and latched would pass the case above and fail here.
    await scrollListDown(mockSeen.seriesHome);
    expect(isVisible.get()).toBe(0);

    await cycleView(); // -> BooksGrid
    expect(isVisible.get()).toBe(1);
  });

  it('keeps the bar visible with the query intact -- a filtered list always shows its filter', async () => {
    await mountLibrary();
    const { isVisible } = mockSeen.searchBar;

    await typeSearch('Bob');
    await scrollListDown(mockSeen.booksHome);
    expect(isVisible.get()).toBe(0);

    await cycleView();

    // Both halves together: still filtering, and the user can see why. Before
    // the fix this was the worst version of the bug -- a list filtered down to
    // one series, with the reason scrolled off the top of the screen.
    expect(mockSeen.seriesHome.series).toHaveLength(1);
    expect(mockSeen.searchBar.value).toBe('Bob');
    expect(isVisible.get()).toBe(1);
  });
});

describe('library screen: the Books shelf layout toggle', () => {
  it('offers the layout control on the Books shelf and NOWHERE else', async () => {
    await mountLibrary();
    // The sectioned home has sections and horizontal rows; there is no second
    // way to draw it, so there is nothing to offer.
    expect(layoutControl()).toBeNull();

    await cycleView();
    expect(screen.getByText('SeriesHome')).toBeTruthy();
    expect(layoutControl()).toBeNull();

    await cycleView();
    expect(screen.getByText('BooksGrid')).toBeTruthy();
    expect(layoutControl()).not.toBeNull();
  });

  it('swaps WHICH LIST is mounted, and swaps back', async () => {
    await mountLibrary();
    await goToBooksShelf();

    expect(screen.getByText('BooksGrid')).toBeTruthy();
    expect(screen.queryByText('BooksList')).toBeNull();

    await flipLayout();

    // Exactly one list at a time -- the property the screen's shared `listRef`
    // docblock is built on, asserted rather than assumed.
    expect(screen.getByText('BooksList')).toBeTruthy();
    expect(screen.queryByText('BooksGrid')).toBeNull();

    await flipLayout();

    expect(screen.getByText('BooksGrid')).toBeTruthy();
    expect(screen.queryByText('BooksList')).toBeNull();
  });

  it('names the layout the reader is IN, not the one a press would give', async () => {
    await mountLibrary();
    await goToBooksShelf();

    /*
     * D8. The header's control shows the shelf you are ON, and these two sit a
     * hundred points apart -- a control that named its destination instead
     * would have the two obeying opposite rules. The ambiguity a single icon
     * carries is paid off here, in what TalkBack reads out: a role, a label
     * naming the control, a value naming where you are, and a hint naming what
     * a press does.
     */
    const grid = screen.getByRole('button', { name: LAYOUT_CONTROL });
    expect(grid.props.accessibilityValue).toEqual({ text: 'Cover grid' });
    expect(grid.props.accessibilityHint).toBe('Switches to the compact list');

    await flipLayout();

    const list = screen.getByRole('button', { name: LAYOUT_CONTROL });
    expect(list.props.accessibilityValue).toEqual({ text: 'Compact list' });
    expect(list.props.accessibilityHint).toBe('Switches to the cover grid');
  });

  it('hands the incoming layout the SAME books, recency mode and spacer', async () => {
    await mountLibrary();
    await selectStartedTab();
    await typeSearch('Bob');
    await goToBooksShelf();

    const grid = mockSeen.booksGrid;
    // Search then tab: "Bob" keeps both Bob authors, Started then keeps only
    // Bob Reader. A layout that filtered differently would show a different
    // shelf, which is the whole of user story 12.
    expect(grid.authors).toHaveLength(1);
    expect(grid.authors[0].books).toHaveLength(1);
    expect(grid.authors[0].books[0].bookTitle).toBe('Bob In Progress');
    expect(grid.recencyMode).toBe('played');

    await flipLayout();

    const list = mockSeen.booksList;
    expect(list.authors).toEqual(grid.authors);
    expect(list.recencyMode).toBe('played');
    // The same spacer ELEMENT, not merely an equal one: the overlay's height is
    // reserved once and both layouts re-reserve exactly it.
    expect(list.ListHeaderComponent).toBe(grid.ListHeaderComponent);
  });

  it('keeps the bar on screen across a flip -- the REACHABLE sequence', async () => {
    await mountLibrary();
    await goToBooksShelf();
    const { isVisible } = mockSeen.searchBar;

    await scrollListDown(mockSeen.booksGrid);
    expect(isVisible.get()).toBe(0);

    /*
     * ⚠ THE TEMPTING SEQUENCE IS FICTION. The obvious test is "hide the bar,
     * then flip, then assert the bar came back" -- but the control lives INSIDE
     * the bar, and the bar translates out of an `overflow: 'hidden'` parent
     * when hidden, so a reader cannot press it from there. The stub renders
     * regardless of visibility, so that test would pass while guarding a state
     * that does not exist.
     *
     * The reachable path is this one: scroll back up to reach the control, then
     * flip. What matters afterwards is that the control the reader just pressed
     * has not vanished from under their finger.
     */
    await scrollListUp(mockSeen.booksGrid);
    expect(isVisible.get()).toBe(1);

    await flipLayout();

    expect(screen.getByText('BooksList')).toBeTruthy();
    expect(isVisible.get()).toBe(1);
    expect(layoutControl()).not.toBeNull();
  });

  it('mounts the layout the reader already chose', async () => {
    // A returning reader, mid-launch: settings have hydrated and the store
    // already holds `list` before the screen mounts. Reaching the Books shelf
    // must land them on the list, with no flip.
    useSettingsStore.setState({ booksLayout: 'list' });

    await mountLibrary();
    await goToBooksShelf();

    expect(screen.getByText('BooksList')).toBeTruthy();
    expect(screen.queryByText('BooksGrid')).toBeNull();
  });

  it('remembers the flip after the screen unmounts and mounts again', async () => {
    await mountLibrary();
    await goToBooksShelf();
    await flipLayout();
    expect(screen.getByText('BooksList')).toBeTruthy();

    // Navigating away and back. The choice belongs to the reader, not to this
    // mount -- which is the whole of user stories 3 and 29, and is exactly what
    // screen-local state cannot do.
    // ⚠ AWAITED. `unmount` returns a promise in RNTL 14 just as `render` does,
    // and dropping this await does not fail here -- it interleaves act scopes
    // and the NEXT test in the file reads its captured props as null.
    await screen.unmount();
    await mountLibrary();
    await goToBooksShelf();

    expect(screen.getByText('BooksList')).toBeTruthy();
    expect(screen.queryByText('BooksGrid')).toBeNull();
  });

  it('leaves the sectioned home\'s expanded sections alone', async () => {
    await mountLibrary();

    // Expand a section on the sectioned home, as a reader would.
    await act(async () => {
      mockSeen.booksHome.setActiveGridSections(new Set(['Recently added']));
    });

    await goToBooksShelf();
    await flipLayout();
    await cycleView(); // BooksGrid/BooksList -> back round to the sectioned home

    /*
     * A change on one shelf must never silently alter another. The collapse
     * sweep is armed only on the sectioned view (`SECTIONED_VIEWS` is a
     * CAPABILITY test, not a change-of-view one), which is what makes
     * `booksList` safe to add as a live view without touching the ladder.
     */
    expect(screen.getByText('BooksHome')).toBeTruthy();
    expect([...mockSeen.booksHome.activeGridSections]).toEqual([
      'Recently added',
    ]);
  });
});
