import TrackPlayer from 'react-native-track-player';
import {
  recordActiveBookFootprint,
  recordActiveBookPlayFootprint,
  recordActiveBookSeekFootprint,
  recordActiveBookChapterChangeFootprint,
  recordPreviousPressFootprint,
} from '../activeBookFootprints';
import {
  recordFootprint,
  recordSeekFootprint,
} from '@/db/footprintQueries';
import { stampLastPlayed } from '@/db/bookQueries';

jest.mock('react-native-track-player', () => ({
  __esModule: true,
  default: {
    getActiveTrack: jest.fn(),
    getProgress: jest.fn(),
  },
}));

jest.mock('@/db/footprintQueries', () => ({
  recordFootprint: jest.fn().mockResolvedValue(undefined),
  recordSeekFootprint: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/db/bookQueries', () => ({
  stampLastPlayed: jest.fn().mockResolvedValue(undefined),
}));

const mockGetActiveTrack = TrackPlayer.getActiveTrack as jest.Mock;
const mockGetProgress = TrackPlayer.getProgress as jest.Mock;
const mockRecordFootprint = recordFootprint as jest.Mock;
const mockRecordSeekFootprint = recordSeekFootprint as jest.Mock;
const mockStampLastPlayed = stampLastPlayed as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetActiveTrack.mockResolvedValue({ bookId: 'book-1' });
  mockGetProgress.mockResolvedValue({ position: 12.345 });
  // Reset behaviour too: clearAllMocks clears calls but keeps any
  // mockRejectedValue a previous test installed.
  mockRecordFootprint.mockResolvedValue(undefined);
  mockRecordSeekFootprint.mockResolvedValue(undefined);
  mockStampLastPlayed.mockResolvedValue(undefined);
});

describe('recordActiveBookFootprint', () => {
  it('records the given trigger for the active Book', async () => {
    await recordActiveBookFootprint('timer_activation');

    expect(mockRecordFootprint).toHaveBeenCalledTimes(1);
    expect(mockRecordFootprint).toHaveBeenCalledWith(
      'book-1',
      'timer_activation',
    );
  });

  it('records nothing when no Book is loaded', async () => {
    mockGetActiveTrack.mockResolvedValue(undefined);

    await recordActiveBookFootprint('timer_activation');

    expect(mockRecordFootprint).not.toHaveBeenCalled();
  });

  it('uses a supplied bookId rather than reading the player', async () => {
    await recordActiveBookFootprint('chapter_change', 'book-7');

    expect(mockRecordFootprint).toHaveBeenCalledWith(
      'book-7',
      'chapter_change',
    );
    expect(mockGetActiveTrack).not.toHaveBeenCalled();
  });

  // The load-bearing behaviour of every call site: a footprint is a
  // breadcrumb, so failing to write one must never block the timer
  // activation or playback command it was recorded alongside.
  it('swallows a recordFootprint rejection instead of propagating it', async () => {
    mockRecordFootprint.mockRejectedValue(new Error('db down'));

    await expect(
      recordActiveBookFootprint('timer_activation'),
    ).resolves.toBeUndefined();
  });

  it('swallows a player read rejection instead of propagating it', async () => {
    mockGetActiveTrack.mockRejectedValue(new Error('no player'));

    await expect(
      recordActiveBookFootprint('timer_activation'),
    ).resolves.toBeUndefined();
    expect(mockRecordFootprint).not.toHaveBeenCalled();
  });
});

describe('recordActiveBookPlayFootprint', () => {
  it('stamps last-played and records a play footprint for the active Book', async () => {
    await recordActiveBookPlayFootprint();

    expect(mockStampLastPlayed).toHaveBeenCalledWith('book-1');
    expect(mockRecordFootprint).toHaveBeenCalledWith('book-1', 'play');
  });

  it('stamps before it records', async () => {
    const order: string[] = [];
    mockStampLastPlayed.mockImplementation(async () => {
      order.push('stamp');
    });
    mockRecordFootprint.mockImplementation(async () => {
      order.push('record');
    });

    await recordActiveBookPlayFootprint();

    expect(order).toEqual(['stamp', 'record']);
  });

  it('does neither when no Book is loaded', async () => {
    mockGetActiveTrack.mockResolvedValue(undefined);

    await recordActiveBookPlayFootprint();

    expect(mockStampLastPlayed).not.toHaveBeenCalled();
    expect(mockRecordFootprint).not.toHaveBeenCalled();
  });

  it('swallows a rejection instead of propagating it', async () => {
    mockRecordFootprint.mockRejectedValue(new Error('db down'));

    await expect(recordActiveBookPlayFootprint()).resolves.toBeUndefined();
  });
});

describe('recordActiveBookSeekFootprint', () => {
  it('records a seek footprint with the pre-seek position in ms', async () => {
    await recordActiveBookSeekFootprint();

    expect(mockRecordSeekFootprint).toHaveBeenCalledTimes(1);
    expect(mockRecordSeekFootprint).toHaveBeenCalledWith('book-1', 12345);
  });

  it('records nothing when there is no active track', async () => {
    mockGetActiveTrack.mockResolvedValue(undefined);

    await recordActiveBookSeekFootprint();

    expect(mockRecordSeekFootprint).not.toHaveBeenCalled();
  });

  it('records nothing when the active track has no bookId', async () => {
    mockGetActiveTrack.mockResolvedValue({ url: 'file://x.mp3' });

    await recordActiveBookSeekFootprint();

    expect(mockRecordSeekFootprint).not.toHaveBeenCalled();
  });

  it('resolves without throwing when recording fails', async () => {
    mockRecordSeekFootprint.mockRejectedValue(new Error('db down'));

    await expect(recordActiveBookSeekFootprint()).resolves.toBeUndefined();
  });

  it('resolves without throwing when TrackPlayer calls fail', async () => {
    mockGetProgress.mockRejectedValue(new Error('no player'));

    await expect(recordActiveBookSeekFootprint()).resolves.toBeUndefined();
    expect(mockRecordSeekFootprint).not.toHaveBeenCalled();
  });
});

describe('recordActiveBookChapterChangeFootprint', () => {
  it('records a chapter_change footprint for the given bookId', async () => {
    await recordActiveBookChapterChangeFootprint('book-2');

    expect(mockRecordFootprint).toHaveBeenCalledTimes(1);
    expect(mockRecordFootprint).toHaveBeenCalledWith(
      'book-2',
      'chapter_change',
    );
    // bookId was supplied — no need for a bridge round-trip
    expect(mockGetActiveTrack).not.toHaveBeenCalled();
  });

  it('records a chapter_restart footprint when that trigger is passed', async () => {
    await recordActiveBookChapterChangeFootprint('book-2', 'chapter_restart');

    expect(mockRecordFootprint).toHaveBeenCalledWith(
      'book-2',
      'chapter_restart',
    );
  });

  it('falls back to the active track when no bookId is given', async () => {
    await recordActiveBookChapterChangeFootprint();

    expect(mockRecordFootprint).toHaveBeenCalledWith(
      'book-1',
      'chapter_change',
    );
  });

  it('records nothing when no bookId can be resolved', async () => {
    mockGetActiveTrack.mockResolvedValue(undefined);

    await recordActiveBookChapterChangeFootprint();

    expect(mockRecordFootprint).not.toHaveBeenCalled();
  });

  it('resolves without throwing when recording fails', async () => {
    mockRecordFootprint.mockRejectedValue(new Error('db down'));

    await expect(
      recordActiveBookChapterChangeFootprint('book-1'),
    ).resolves.toBeUndefined();
  });
});

describe('recordActiveBookSeekFootprint — explicit bookId', () => {
  it('uses the bookId it was given rather than re-reading the active track', async () => {
    await recordActiveBookSeekFootprint('book-9');

    expect(mockRecordSeekFootprint).toHaveBeenCalledWith('book-9', 12345);
    // A Book switch racing the handler must not steal the breadcrumb.
    expect(mockGetActiveTrack).not.toHaveBeenCalled();
  });
});

/*
 * The skip-previous label, which is the part that can drift between the two
 * press sites: a restart and a chapter change are the same press until
 * `skipToPreviousChapter` resolves it, so both surfaces take the resolved
 * kind and neither maps it itself.
 */
describe('recordPreviousPressFootprint', () => {
  it('labels a resolved previous-chapter press `chapter_change`', async () => {
    await recordPreviousPressFootprint('book-1', 'previous');

    expect(mockRecordFootprint).toHaveBeenCalledWith(
      'book-1',
      'chapter_change',
    );
  });

  it('labels a resolved restart press `chapter_restart`', async () => {
    await recordPreviousPressFootprint('book-1', 'restart');

    expect(mockRecordFootprint).toHaveBeenCalledWith(
      'book-1',
      'chapter_restart',
    );
  });

  // The playback service reads `string | null` from the player and the button
  // reads `string | undefined` from the store; neither converts, and an
  // unreadable Active Book records nothing rather than guessing one.
  it.each([null, undefined])('records nothing for %p', async (bookId) => {
    await recordPreviousPressFootprint(bookId, 'previous');

    expect(mockRecordFootprint).not.toHaveBeenCalled();
  });
});
