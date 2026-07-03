import TrackPlayer from 'react-native-track-player';
import {
  handleRemotePlayBook,
  isBookSwitchInProgress,
} from '../remotePlayBook';
import { useQueueStore } from '@/store/queue';
import { useLibraryStore } from '@/store/library';
import { handleBookPlay } from '@/helpers/handleBookPlay';
import { ensurePlayerSetup } from '@/helpers/playerSetup';
import {
  getBookWithChaptersForRestoration,
  getBookProgressValue,
} from '@/db/bookQueries';

jest.mock('react-native-track-player', () => ({
  __esModule: true,
  default: { play: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('@/helpers/playerSetup', () => ({
  ensurePlayerSetup: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/helpers/handleBookPlay', () => ({
  handleBookPlay: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/store/library', () => ({
  useLibraryStore: { getState: jest.fn() },
}));

jest.mock('@/db/bookQueries', () => ({
  getBookWithChaptersForRestoration: jest.fn().mockResolvedValue(null),
  getBookProgressValue: jest.fn().mockResolvedValue(0),
}));

const mockBooks = (books: Record<string, unknown>) =>
  (useLibraryStore.getState as jest.Mock).mockReturnValue({ books });

const fakeBook = {
  bookId: 'b1',
  bookTitle: 'Dune',
  author: 'Frank Herbert',
  chapters: [{ url: '/x.m4b' }],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockBooks({});
  (getBookWithChaptersForRestoration as jest.Mock).mockResolvedValue(null);
  useQueueStore.setState({
    activeBookId: null,
    isPlayerReady: true,
    playerSetupPromise: null,
  });
});

describe('handleRemotePlayBook', () => {
  it('ensures the player is set up before doing anything', async () => {
    mockBooks({ b1: fakeBook });

    await handleRemotePlayBook('b1');

    expect(ensurePlayerSetup).toHaveBeenCalled();
    const setupOrder = (ensurePlayerSetup as jest.Mock).mock
      .invocationCallOrder[0];
    const playOrder = (handleBookPlay as jest.Mock).mock
      .invocationCallOrder[0];
    expect(setupOrder).toBeLessThan(playOrder);
  });

  it('just resumes when the requested book is already active', async () => {
    useQueueStore.setState({ activeBookId: 'b1' });

    await handleRemotePlayBook('b1');

    expect(TrackPlayer.play).toHaveBeenCalledTimes(1);
    expect(handleBookPlay).not.toHaveBeenCalled();
  });

  it('plays a book found in the library store', async () => {
    mockBooks({ b1: fakeBook });

    await handleRemotePlayBook('b1');

    expect(handleBookPlay).toHaveBeenCalledWith(
      fakeBook,
      true,
      false,
      null,
      expect.any(Function),
    );
  });

  it('falls back to the DB when the library store is empty (headless runtime)', async () => {
    (getBookWithChaptersForRestoration as jest.Mock).mockResolvedValue({
      bookId: 'b1',
      bookTitle: 'Dune',
      author: 'Frank Herbert',
      artwork: '/art.webp',
      bookDuration: 100,
      chapters: [{ url: '/x.m4b' }],
    });
    (getBookProgressValue as jest.Mock).mockResolvedValue(2);

    await handleRemotePlayBook('b1');

    expect(handleBookPlay).toHaveBeenCalledWith(
      expect.objectContaining({ bookId: 'b1', bookProgressValue: 2 }),
      true,
      false,
      null,
      expect.any(Function),
    );
  });

  it('gives up quietly when the book exists nowhere', async () => {
    await handleRemotePlayBook('missing');

    expect(handleBookPlay).not.toHaveBeenCalled();
    expect(TrackPlayer.play).not.toHaveBeenCalled();
  });

  it('reports a switch in progress while handleBookPlay is pending', async () => {
    mockBooks({ b1: fakeBook });
    let resolvePlay: () => void = () => {};
    (handleBookPlay as jest.Mock).mockImplementationOnce(
      () => new Promise<void>((r) => (resolvePlay = r)),
    );

    const call = handleRemotePlayBook('b1');
    await Promise.resolve();
    await Promise.resolve();
    expect(isBookSwitchInProgress()).toBe(true);

    resolvePlay();
    await call;
    expect(isBookSwitchInProgress()).toBe(false);
  });

  it('clears the switch guard even when handleBookPlay rejects', async () => {
    mockBooks({ b1: fakeBook });
    (handleBookPlay as jest.Mock).mockRejectedValueOnce(new Error('boom'));

    await handleRemotePlayBook('b1');

    expect(isBookSwitchInProgress()).toBe(false);
  });
});
