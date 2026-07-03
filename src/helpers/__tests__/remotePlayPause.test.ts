import TrackPlayer, { State } from 'react-native-track-player';
import { handleRemotePlayPause } from '../remotePlayPause';

jest.mock('react-native-track-player', () => ({
  __esModule: true,
  default: {
    getPlaybackState: jest.fn(),
    play: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn().mockResolvedValue(undefined),
  },
  State: {
    None: 'none',
    Ready: 'ready',
    Playing: 'playing',
    Paused: 'paused',
    Stopped: 'stopped',
    Loading: 'loading',
    Buffering: 'buffering',
    Error: 'error',
    Ended: 'ended',
  },
}));

const mockGetPlaybackState = TrackPlayer.getPlaybackState as jest.Mock;
const mockPlay = TrackPlayer.play as jest.Mock;
const mockPause = TrackPlayer.pause as jest.Mock;

const setState = (state: State) =>
  mockGetPlaybackState.mockResolvedValue({ state });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('handleRemotePlayPause', () => {
  it('pauses when currently playing', async () => {
    setState(State.Playing);

    await handleRemotePlayPause();

    expect(mockPause).toHaveBeenCalledTimes(1);
    expect(mockPlay).not.toHaveBeenCalled();
  });

  it('pauses when buffering (playback intent is active)', async () => {
    setState(State.Buffering);

    await handleRemotePlayPause();

    expect(mockPause).toHaveBeenCalledTimes(1);
    expect(mockPlay).not.toHaveBeenCalled();
  });

  it('plays when currently paused', async () => {
    setState(State.Paused);

    await handleRemotePlayPause();

    expect(mockPlay).toHaveBeenCalledTimes(1);
    expect(mockPause).not.toHaveBeenCalled();
  });

  it('plays when stopped', async () => {
    setState(State.Stopped);

    await handleRemotePlayPause();

    expect(mockPlay).toHaveBeenCalledTimes(1);
    expect(mockPause).not.toHaveBeenCalled();
  });

  it('invokes onPlay callback before starting playback', async () => {
    setState(State.Paused);
    const calls: string[] = [];
    mockPlay.mockImplementation(async () => {
      calls.push('play');
    });
    const onPlay = jest.fn(async () => {
      calls.push('onPlay');
    });

    await handleRemotePlayPause(onPlay);

    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['onPlay', 'play']);
  });

  it('does not invoke onPlay when pausing', async () => {
    setState(State.Playing);
    const onPlay = jest.fn();

    await handleRemotePlayPause(onPlay);

    expect(onPlay).not.toHaveBeenCalled();
  });

  it('still plays if onPlay callback rejects', async () => {
    setState(State.Paused);
    const onPlay = jest.fn().mockRejectedValue(new Error('db down'));

    await handleRemotePlayPause(onPlay);

    expect(mockPlay).toHaveBeenCalledTimes(1);
  });
});
