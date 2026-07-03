import TrackPlayer from 'react-native-track-player';
import { ensurePlayerSetup } from '../playerSetup';
import { useQueueStore } from '@/store/queue';

jest.mock('react-native-track-player', () => ({
  __esModule: true,
  default: {
    setupPlayer: jest.fn().mockResolvedValue(undefined),
    updateOptions: jest.fn().mockResolvedValue(undefined),
    setRepeatMode: jest.fn().mockResolvedValue(undefined),
  },
  AndroidAudioContentType: { Speech: 'speech' },
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
  RepeatMode: { Off: 0 },
}));

jest.mock('@/db/settingsQueries', () => ({
  getSkipBackDuration: jest.fn().mockResolvedValue(15),
  getSkipForwardDuration: jest.fn().mockResolvedValue(30),
}));

beforeEach(() => {
  jest.clearAllMocks();
  useQueueStore.setState({
    isPlayerReady: false,
    playerSetupPromise: null,
    activeBookId: null,
  });
});

describe('ensurePlayerSetup', () => {
  it('sets up the player and marks ready in a headless runtime', async () => {
    await ensurePlayerSetup();

    expect(TrackPlayer.setupPlayer).toHaveBeenCalledTimes(1);
    expect(useQueueStore.getState().isPlayerReady).toBe(true);
  });

  it('does nothing when the player is already ready', async () => {
    useQueueStore.setState({ isPlayerReady: true });

    await ensurePlayerSetup();

    expect(TrackPlayer.setupPlayer).not.toHaveBeenCalled();
  });

  it('awaits an in-flight UI setup instead of double-initializing', async () => {
    let resolveSetup: () => void = () => {};
    const pending = new Promise<void>((r) => {
      resolveSetup = r;
    });
    useQueueStore.setState({ playerSetupPromise: pending });

    const done = jest.fn();
    const call = ensurePlayerSetup().then(done);
    await Promise.resolve();
    expect(done).not.toHaveBeenCalled();

    resolveSetup();
    await call;

    expect(done).toHaveBeenCalled();
    expect(TrackPlayer.setupPlayer).not.toHaveBeenCalled();
  });

  it('publishes its setup promise so concurrent callers coalesce', async () => {
    let resolveNative: () => void = () => {};
    (TrackPlayer.setupPlayer as jest.Mock).mockImplementationOnce(
      () => new Promise<void>((r) => (resolveNative = r)),
    );

    const first = ensurePlayerSetup();
    // Flush microtasks until setupPlayerCore reaches the native setup call
    // (it awaits the skip-duration reads first)
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(TrackPlayer.setupPlayer).toHaveBeenCalledTimes(1);
    const second = ensurePlayerSetup();
    resolveNative();
    await Promise.all([first, second]);

    expect(TrackPlayer.setupPlayer).toHaveBeenCalledTimes(1);
  });

  it('marks ready even if native setup throws (already initialized by UI)', async () => {
    (TrackPlayer.setupPlayer as jest.Mock).mockRejectedValueOnce(
      new Error('player already initialized'),
    );

    await ensurePlayerSetup();

    expect(useQueueStore.getState().isPlayerReady).toBe(true);
  });
});
