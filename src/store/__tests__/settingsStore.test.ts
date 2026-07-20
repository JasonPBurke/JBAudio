import TrackPlayer, { Capability } from 'react-native-track-player';
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
  updateSkipBackDuration: jest.fn().mockResolvedValue(undefined),
  updateSkipForwardDuration: jest.fn().mockResolvedValue(undefined),
  setNumColumns: jest.fn().mockResolvedValue(undefined),
  setShakeToResetEnabled: jest.fn().mockResolvedValue(undefined),
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
