import { fireEvent, render } from '@testing-library/react-native';
import { SkipToNextButton, SkipToPreviousButton } from '../PlayerControls';
import { pressNext } from '@/helpers/nextPress';
import { skipToPreviousChapter } from '@/helpers/chapterSkip';
import { recordPreviousPressFootprint } from '@/helpers/activeBookFootprints';

/*
 * The two in-app skip buttons, and the only thing they are allowed to be:
 * WIRING.
 *
 * Both used to be exceptions to the rule that a press behaves the same
 * wherever it came from. Next carried its own copy of the whole decision,
 * which had drifted from the extracted one in five ways; previous delegated
 * the decision but silently dropped the footprint the notification press
 * records. Neither has a render site yet, so nothing but a test can catch
 * either regressing — which is exactly why they drifted in the first place.
 *
 * These assert delegation and nothing else. What the shared helpers DO —
 * branch order, the pre-press footprint, the finish triple, the queue-edge
 * no-op — is owned by `helpers/__tests__/nextPress.test.ts` and
 * `chapterSkip.*.test.ts` in the fast lane. Asserting it twice here would
 * pin the same behaviour to the surface it must NOT be specific to.
 *
 * ── Why the mock list is this long ──
 *
 * See trap 7 in docs/testing/jest-projects-and-rn-tests.md: every library
 * list in this app is behind a transform/native cascade, and PlayerControls
 * is one module holding six buttons, so a suite that wants two of them pays
 * for all six. Each mock below is the smallest stand-in that lets the module
 * load, and each names the dependency it stands in for. The alternative —
 * widening the shared lane's `transformIgnorePatterns` — was rejected once
 * already, for the same reason.
 */

let mockActiveBookId: string | null;
const mockBook = { bookId: 'book-1', isSingleFile: true };

jest.mock('@/player/trackPlayer', () => ({
  pause: jest.fn(),
  play: jest.fn(),
  seekBy: jest.fn(),
}));
jest.mock('@/db', () => ({ __esModule: true, default: {} }));

// Reanimated's own `/mock` entry point (installed by jest.rn-setup.js) is
// lazy: it only breaks when a suite actually imports reanimated, and then it
// re-enters the real index and dies inside react-native-worklets' native
// half. This is the first suite to import it, so it carries a hand-rolled
// stub — only the APIs the transport buttons use.
jest.mock('react-native-reanimated', () => {
  // Required, not imported: a jest.mock factory is hoisted above imports.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: (fn: () => unknown) => fn(),
    withTiming: (v: unknown) => v,
    withSequence: (...v: unknown[]) => v[0],
  };
});
jest.mock('@gorhom/bottom-sheet', () => ({
  __esModule: true,
  BottomSheetModal: () => null,
  BottomSheetBackdrop: () => null,
}));
// Ships untranspiled ESM, and `@/db/settingsQueries` reaches it through
// `helpers/artworkFiles`. Mocked at the library rather than at each of the
// app modules that transitively import it.
jest.mock('@dr.pogodin/react-native-fs', () => ({}));
// Sibling buttons' sheets. Their own dependency trees (an awesome-slider on
// gesture-handler) have nothing to do with the two buttons under test.
jest.mock('@/modals/SleepTimerOptions', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/modals/PlaybackSpeedOptions', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ colors: { primary: '#fff', text: '#fff' } }),
}));

// The seams under test.
jest.mock('@/helpers/nextPress', () => ({ pressNext: jest.fn() }));
jest.mock('@/helpers/chapterSkip', () => ({
  skipToPreviousChapter: jest.fn(),
}));
jest.mock('@/helpers/activeBookFootprints', () => ({
  recordActiveBookPlayFootprint: jest.fn(),
  recordPreviousPressFootprint: jest.fn(),
}));

jest.mock('@/store/playerState', () => ({
  useActiveBookId: () => mockActiveBookId,
  useIsPlayerPlaying: () => false,
  usePlayerStateStore: Object.assign(jest.fn(), { getState: () => ({}) }),
}));
jest.mock('@/store/library', () => ({
  useBookById: () => mockBook,
  useLibraryStore: Object.assign(jest.fn(), {
    getState: () => ({ books: {} }),
  }),
}));

const mockPressNext = pressNext as jest.Mock;
const mockSkipToPreviousChapter = skipToPreviousChapter as jest.Mock;
const mockRecordPreviousPressFootprint =
  recordPreviousPressFootprint as jest.Mock;

/**
 * Each button renders exactly one touchable, so the render root IS the press
 * target — RNTL 14 dropped the `UNSAFE_getByType` queries, and these icon
 * buttons carry no accessible label to query by yet.
 *
 * `render` is ASYNC in RNTL 14: a missing await does not throw, it just runs
 * the assertion before the render it meant to observe (trap 2).
 */
const pressOnly = async (element: React.ReactElement) => {
  const { root } = await render(element);
  fireEvent.press(root!);
};

beforeEach(() => {
  jest.clearAllMocks();
  mockActiveBookId = 'book-1';
});

describe('SkipToNextButton', () => {
  it('hands the whole press to the shared next press', async () => {
    await pressOnly(<SkipToNextButton />);

    expect(mockPressNext).toHaveBeenCalledWith('book-1', mockBook);
  });

  it('makes no press at all when no Book is active', async () => {
    mockActiveBookId = null;

    await pressOnly(<SkipToNextButton />);

    expect(mockPressNext).not.toHaveBeenCalled();
  });
});

describe('SkipToPreviousButton', () => {
  it('hands the press to the shared previous decision', async () => {
    await pressOnly(<SkipToPreviousButton />);

    expect(mockSkipToPreviousChapter).toHaveBeenCalledTimes(1);
  });

  it('records the footprint the notification press records, labeled by the RESOLVED kind', async () => {
    // The label cannot be chosen at the press site: >15s into a chapter the
    // same press is a restart, under it a chapter change, and only
    // `skipToPreviousChapter` knows which. So the button hands over a
    // callback and the helper calls it back with its verdict.
    await pressOnly(<SkipToPreviousButton />);

    const onBeforeSkip = mockSkipToPreviousChapter.mock.calls[0][0];
    await onBeforeSkip('restart');

    expect(mockRecordPreviousPressFootprint).toHaveBeenCalledWith(
      'book-1',
      'restart',
    );
  });

  it('still makes the press when no Book is active, and records nothing', async () => {
    // Unlike next, the previous press is useful without a Book id — the
    // decision reads the player, not the store. Only the breadcrumb needs a
    // Book, and an absent one records nothing rather than guessing.
    mockActiveBookId = null;

    await pressOnly(<SkipToPreviousButton />);

    expect(mockSkipToPreviousChapter).toHaveBeenCalledTimes(1);
    await mockSkipToPreviousChapter.mock.calls[0][0]('previous');
    expect(mockRecordPreviousPressFootprint).toHaveBeenCalledWith(
      null,
      'previous',
    );
  });
});
