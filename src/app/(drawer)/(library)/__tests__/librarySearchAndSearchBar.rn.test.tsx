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
 *     asserted there is that this screen hands it `toggleView` rather than
 *     something that never changes. A perfect hook that is not wired up is
 *     still a broken search bar.
 *
 * ── Why the mock list is this long ──
 *
 * Trap 7 in docs/testing/jest-projects-and-rn-tests.md: every library list in
 * this app sits behind a transform cascade (FlashList, then `pressto`, then
 * the next one), and widening the shared lane's `transformIgnorePatterns` for
 * one suite was already tried and backed out once. Mocking the three lists at
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
} = { searchBar: null, booksHome: null, seriesHome: null, booksGrid: null };

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
    const { Text } = require('react-native');
    return React.createElement(Text, { testID: 'search-bar' }, props.value);
  },
}));

/** Stands in for the header's view toggle, which is all this suite drives. */
jest.mock('@/components/Header', () => ({
  __esModule: true,
  default: ({ setToggleView }: any) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text } = require('react-native');
    return React.createElement(
      Text,
      {
        testID: 'cycle-view',
        // The real header cycles the same way -- Header.tsx:92.
        onPress: () => setToggleView((v: number) => (v + 1) % 3),
      },
      'Header',
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

/** Scroll the mounted list down far enough to hide the bar. */
async function scrollListDown(list: any) {
  await act(async () => {
    list.onScroll(scrollTo(100));
  });
}

beforeEach(() => {
  mockSeen.searchBar = null;
  mockSeen.booksHome = null;
  mockSeen.seriesHome = null;
  mockSeen.booksGrid = null;
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
     * because this screen passes `toggleView` as its `surface`. A correct hook
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
