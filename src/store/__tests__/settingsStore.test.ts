import TrackPlayer, { Capability } from 'react-native-track-player';
import {
  getBooksLayout,
  setBooksLayout,
  getSeriesBackgroundsEnabled,
} from '@/db/settingsQueries';
import { useSettingsStore } from '../settingsStore';

jest.mock('react-native-track-player', () => ({
  __esModule: true,
  default: {
    updateOptions: jest.fn().mockResolvedValue(undefined),
  },
  AndroidAudioContentType: { Speech: 'speech' },
  AppKilledPlaybackBehavior: { ContinuePlayback: 'continue-playback' },
  Capability: {
    Play: 0,
    Pause: 1,
    JumpForward: 2,
    JumpBackward: 3,
    SkipToNext: 4,
    SkipToPrevious: 5,
    SeekTo: 6,
    Stop: 7,
  },
}));

jest.mock('@/db/settingsQueries', () => ({
  getNumColumns: jest.fn().mockResolvedValue(2),
  getSkipBackDuration: jest.fn().mockResolvedValue(30),
  getSkipForwardDuration: jest.fn().mockResolvedValue(30),
  getShakeToResetEnabled: jest.fn().mockResolvedValue(false),
  getPlaybackRate: jest.fn().mockResolvedValue(1.0),
  getLastNonDefaultRate: jest.fn().mockResolvedValue(null),
  getSeriesBackgroundsEnabled: jest.fn().mockResolvedValue(true),
  /*
   * ⚠ NOT OPTIONAL, and not tidying. This mock is an explicit object with no
   * automatic fallback, and `initializeSettings` calls every getter inside ONE
   * `Promise.all` -- so a getter the store reads but this object omits is
   * `undefined()` inside that promise, and every test in this file fails at
   * once with a message that names none of them.
   */
  getBooksLayout: jest.fn().mockResolvedValue('grid'),
  updateSkipBackDuration: jest.fn().mockResolvedValue(undefined),
  updateSkipForwardDuration: jest.fn().mockResolvedValue(undefined),
  setNumColumns: jest.fn().mockResolvedValue(undefined),
  setShakeToResetEnabled: jest.fn().mockResolvedValue(undefined),
  setSeriesBackgroundsEnabled: jest.fn().mockResolvedValue(undefined),
  setBooksLayout: jest.fn().mockResolvedValue(undefined),
}));

const lastUpdateOptionsCall = () => {
  const mock = TrackPlayer.updateOptions as jest.Mock;
  expect(mock).toHaveBeenCalled();
  return mock.mock.calls[mock.mock.calls.length - 1][0];
};

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({
    skipBackDuration: 30,
    skipForwardDuration: 30,
  });
});

describe('Series Backgrounds is default-ON in the store too (K1)', () => {
  // The DB getter is only half the default. Anything reading the store before
  // `initializeSettings` resolves sees this value, so seeding it `false` would
  // render the switch OFF — and pop the backdrop in a frame later — for a user
  // who never turned it off. Same silent failure, one layer up.
  it('reads ON before initializeSettings has resolved', () => {
    expect(useSettingsStore.getInitialState().seriesBackgroundsEnabled).toBe(
      true,
    );
  });

  it('takes the stored value once settings load', async () => {
    (getSeriesBackgroundsEnabled as jest.Mock).mockResolvedValue(false);
    useSettingsStore.setState({ isInitialized: false });

    await useSettingsStore.getState().initializeSettings();

    expect(useSettingsStore.getState().seriesBackgroundsEnabled).toBe(false);
  });
});

describe('the Books shelf layout is default-GRID in the store too (D4)', () => {
  // Same shape as the Series Backgrounds default above, for the same reason:
  // the DB getter is only half of a default. Anything reading the store before
  // `initializeSettings` resolves sees this seed, so seeding it 'list' would
  // draw the compact list for a reader who has never touched the control.
  //
  // The spec is explicit that no hydration GATE is wanted (D4): settings
  // hydrate during launch and the shelf always starts on the sectioned home,
  // so the Books shelf cannot be on screen before this resolves. The seed
  // being right is what makes the gate unnecessary -- not a substitute for it.
  it('reads the grid before initializeSettings has resolved', () => {
    expect(useSettingsStore.getInitialState().booksLayout).toBe('grid');
  });

  it('sets the layout optimistically, then persists it', async () => {
    // The store's existing shape, and the one the control depends on: the
    // shelf redraws off the store on the same commit as the press, and the
    // write follows. A setter that awaited the DB first would leave the icon
    // showing the old layout for as long as the write took.
    await useSettingsStore.getState().setBooksLayout('list');

    expect(useSettingsStore.getState().booksLayout).toBe('list');
    expect(setBooksLayout).toHaveBeenCalledWith('list');
  });

  it('takes the stored layout once settings load', async () => {
    (getBooksLayout as jest.Mock).mockResolvedValue('list');
    useSettingsStore.setState({ isInitialized: false });

    await useSettingsStore.getState().initializeSettings();

    expect(useSettingsStore.getState().booksLayout).toBe('list');
  });
});

describe('skip duration setters keep remote capabilities intact', () => {
  // updateOptions REPLACES capability arrays wholesale — a partial list here
  // strips buttons from the notification and Android Auto players.
  const remoteCriticalCapabilities = [
    Capability.SkipToNext,
    Capability.SkipToPrevious,
    Capability.SeekTo, // without it, AA progress-bar scrubbing is dead
  ];

  it('setSkipBackDuration preserves next/previous/seek in notificationCapabilities', async () => {
    await useSettingsStore.getState().setSkipBackDuration(15);

    const options = lastUpdateOptionsCall();
    expect(options.backwardJumpInterval).toBe(15);
    expect(options.forwardJumpInterval).toBe(30);
    expect(options.notificationCapabilities).toEqual(
      expect.arrayContaining(remoteCriticalCapabilities),
    );
  });

  it('setSkipForwardDuration preserves next/previous/seek in notificationCapabilities', async () => {
    await useSettingsStore.getState().setSkipForwardDuration(60);

    const options = lastUpdateOptionsCall();
    expect(options.forwardJumpInterval).toBe(60);
    expect(options.backwardJumpInterval).toBe(30);
    expect(options.notificationCapabilities).toEqual(
      expect.arrayContaining(remoteCriticalCapabilities),
    );
  });

  it('setters preserve the android foreground-service options', async () => {
    await useSettingsStore.getState().setSkipBackDuration(10);

    const options = lastUpdateOptionsCall();
    expect(options.android).toEqual(
      expect.objectContaining({ stopForegroundGracePeriod: 0 }),
    );
  });
});
