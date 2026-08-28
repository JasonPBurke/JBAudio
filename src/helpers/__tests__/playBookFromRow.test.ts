import TrackPlayer, { State } from 'react-native-track-player';

import { playBookFromRow, PlayBookFromRowArgs } from '../playBookFromRow';
import { handleBookPlay } from '@/helpers/handleBookPlay';
import { recordFootprint } from '@/db/footprintQueries';
import { awaitPlayerReady } from '@/helpers/awaitPlayerReady';
import { Book } from '@/types/Book';

jest.mock('react-native-track-player', () => ({
  __esModule: true,
  default: {
    getPlaybackState: jest.fn(),
    getActiveTrack: jest.fn(),
  },
  State: { Playing: 'playing', Paused: 'paused' },
}));

jest.mock('@/helpers/awaitPlayerReady', () => ({
  awaitPlayerReady: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/helpers/handleBookPlay', () => ({
  handleBookPlay: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/db/footprintQueries', () => ({
  recordFootprint: jest.fn().mockResolvedValue(undefined),
}));

const mockPlaybackState = TrackPlayer.getPlaybackState as jest.Mock;
const mockActiveTrack = TrackPlayer.getActiveTrack as jest.Mock;
const mockHandleBookPlay = handleBookPlay as jest.Mock;
const mockRecordFootprint = recordFootprint as jest.Mock;
const mockAwaitPlayerReady = awaitPlayerReady as jest.Mock;

const book = (bookId = 'b1'): Book =>
  ({ bookId, bookTitle: 'Dune' }) as unknown as Book;

const setRequestedBookId = jest.fn();

/*
 * The arguments every case below shares, so each test names only what it varies.
 * ⚠ Typed as `Partial<PlayBookFromRowArgs>` rather than a loose record: with a
 * loose one a misspelled override compiles clean and the test silently passes
 * on the default — the same unchecked-property failure the parent spec exists
 * to remove.
 */
const args = (
  overrides: Partial<PlayBookFromRowArgs> = {},
): PlayBookFromRowArgs => ({
  book: book(),
  alreadyInPlay: false,
  requestedBookId: null,
  setRequestedBookId,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockAwaitPlayerReady.mockResolvedValue(undefined);
  mockPlaybackState.mockResolvedValue({ state: State.Paused });
  mockActiveTrack.mockResolvedValue({ bookId: 'b1' });
  mockHandleBookPlay.mockResolvedValue(undefined);
  mockRecordFootprint.mockResolvedValue(undefined);
});

describe('playBookFromRow', () => {
  describe('the hand-off to handleBookPlay', () => {
    it('passes the live playback state as `playing`', async () => {
      mockPlaybackState.mockResolvedValue({ state: State.Playing });

      await playBookFromRow(args());

      expect(mockHandleBookPlay).toHaveBeenCalledWith(
        expect.objectContaining({ bookId: 'b1' }),
        true,
        false,
        null,
        setRequestedBookId,
      );
    });

    it('passes `alreadyInPlay` through untouched — the caller owns that question', async () => {
      await playBookFromRow(
        args({ alreadyInPlay: true, requestedBookId: 'b9' }),
      );

      expect(mockHandleBookPlay).toHaveBeenCalledWith(
        expect.anything(),
        false,
        true,
        'b9',
        setRequestedBookId,
      );
    });

    it('waits for the player before reading its state', async () => {
      await playBookFromRow(args());

      expect(mockAwaitPlayerReady).toHaveBeenCalledTimes(1);
      expect(mockAwaitPlayerReady.mock.invocationCallOrder[0]).toBeLessThan(
        mockPlaybackState.mock.invocationCallOrder[0],
      );
    });
  });

  describe('the bail-out', () => {
    it('does nothing at all without a book', async () => {
      await playBookFromRow(args({ book: undefined }));

      expect(mockAwaitPlayerReady).not.toHaveBeenCalled();
      expect(mockHandleBookPlay).not.toHaveBeenCalled();
    });

    it('does nothing at all for a book with no bookId', async () => {
      await playBookFromRow(args({ book: book('') }));

      expect(mockAwaitPlayerReady).not.toHaveBeenCalled();
      expect(mockHandleBookPlay).not.toHaveBeenCalled();
    });
  });

  describe('the footprint, when the caller asks for one', () => {
    const withFootprint = (overrides: Partial<PlayBookFromRowArgs> = {}) =>
      args({ recordPlayFootprint: true, ...overrides });

    it('records a play footprint when paused on this same book', async () => {
      await playBookFromRow(withFootprint());

      expect(mockRecordFootprint).toHaveBeenCalledWith('b1', 'play');
    });

    it('records nothing when the player is already playing', async () => {
      mockPlaybackState.mockResolvedValue({ state: State.Playing });

      await playBookFromRow(withFootprint());

      expect(mockRecordFootprint).not.toHaveBeenCalled();
      expect(mockHandleBookPlay).toHaveBeenCalled();
    });

    it('records nothing when the loaded Book is a different one', async () => {
      mockActiveTrack.mockResolvedValue({ bookId: 'other' });

      await playBookFromRow(withFootprint());

      expect(mockRecordFootprint).not.toHaveBeenCalled();
    });

    it('records before handing off, so the breadcrumb predates the play', async () => {
      await playBookFromRow(withFootprint());

      expect(mockRecordFootprint.mock.invocationCallOrder[0]).toBeLessThan(
        mockHandleBookPlay.mock.invocationCallOrder[0],
      );
    });

    it('still plays when the footprint write throws', async () => {
      mockRecordFootprint.mockRejectedValue(new Error('db is gone'));

      await expect(playBookFromRow(withFootprint())).resolves.toBeUndefined();
      expect(mockHandleBookPlay).toHaveBeenCalled();
    });

    it('still plays when reading the active track throws', async () => {
      mockActiveTrack.mockRejectedValue(new Error('player is gone'));

      await expect(playBookFromRow(withFootprint())).resolves.toBeUndefined();
      expect(mockHandleBookPlay).toHaveBeenCalled();
    });
  });

  describe('the footprint, when the caller does not ask for one', () => {
    it('is skipped entirely — the player is never asked what is loaded', async () => {
      await playBookFromRow(args());

      expect(mockActiveTrack).not.toHaveBeenCalled();
      expect(mockRecordFootprint).not.toHaveBeenCalled();
      expect(mockHandleBookPlay).toHaveBeenCalled();
    });
  });
});
