import TrackPlayer from 'react-native-track-player';
import {
  recordRemoteSeekFootprint,
  recordRemoteChapterChangeFootprint,
} from '../remoteFootprints';
import {
  recordFootprint,
  recordSeekFootprint,
} from '@/db/footprintQueries';

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

const mockGetActiveTrack = TrackPlayer.getActiveTrack as jest.Mock;
const mockGetProgress = TrackPlayer.getProgress as jest.Mock;
const mockRecordFootprint = recordFootprint as jest.Mock;
const mockRecordSeekFootprint = recordSeekFootprint as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetActiveTrack.mockResolvedValue({ bookId: 'book-1' });
  mockGetProgress.mockResolvedValue({ position: 12.345 });
});

describe('recordRemoteSeekFootprint', () => {
  it('records a seek footprint with the pre-seek position in ms', async () => {
    await recordRemoteSeekFootprint();

    expect(mockRecordSeekFootprint).toHaveBeenCalledTimes(1);
    expect(mockRecordSeekFootprint).toHaveBeenCalledWith('book-1', 12345);
  });

  it('records nothing when there is no active track', async () => {
    mockGetActiveTrack.mockResolvedValue(undefined);

    await recordRemoteSeekFootprint();

    expect(mockRecordSeekFootprint).not.toHaveBeenCalled();
  });

  it('records nothing when the active track has no bookId', async () => {
    mockGetActiveTrack.mockResolvedValue({ url: 'file://x.mp3' });

    await recordRemoteSeekFootprint();

    expect(mockRecordSeekFootprint).not.toHaveBeenCalled();
  });

  it('resolves without throwing when recording fails', async () => {
    mockRecordSeekFootprint.mockRejectedValue(new Error('db down'));

    await expect(recordRemoteSeekFootprint()).resolves.toBeUndefined();
  });

  it('resolves without throwing when TrackPlayer calls fail', async () => {
    mockGetProgress.mockRejectedValue(new Error('no player'));

    await expect(recordRemoteSeekFootprint()).resolves.toBeUndefined();
    expect(mockRecordSeekFootprint).not.toHaveBeenCalled();
  });
});

describe('recordRemoteChapterChangeFootprint', () => {
  it('records a chapter_change footprint for the given bookId', async () => {
    await recordRemoteChapterChangeFootprint('book-2');

    expect(mockRecordFootprint).toHaveBeenCalledTimes(1);
    expect(mockRecordFootprint).toHaveBeenCalledWith(
      'book-2',
      'chapter_change',
    );
    // bookId was supplied — no need for a bridge round-trip
    expect(mockGetActiveTrack).not.toHaveBeenCalled();
  });

  it('records a chapter_restart footprint when that trigger is passed', async () => {
    await recordRemoteChapterChangeFootprint('book-2', 'chapter_restart');

    expect(mockRecordFootprint).toHaveBeenCalledWith(
      'book-2',
      'chapter_restart',
    );
  });

  it('falls back to the active track when no bookId is given', async () => {
    await recordRemoteChapterChangeFootprint();

    expect(mockRecordFootprint).toHaveBeenCalledWith(
      'book-1',
      'chapter_change',
    );
  });

  it('records nothing when no bookId can be resolved', async () => {
    mockGetActiveTrack.mockResolvedValue(undefined);

    await recordRemoteChapterChangeFootprint();

    expect(mockRecordFootprint).not.toHaveBeenCalled();
  });

  it('resolves without throwing when recording fails', async () => {
    mockRecordFootprint.mockRejectedValue(new Error('db down'));

    await expect(
      recordRemoteChapterChangeFootprint('book-1'),
    ).resolves.toBeUndefined();
  });
});

describe('recordRemoteSeekFootprint — explicit bookId', () => {
  it('uses the bookId it was given rather than re-reading the active track', async () => {
    await recordRemoteSeekFootprint('book-9');

    expect(mockRecordSeekFootprint).toHaveBeenCalledWith('book-9', 12345);
    // A Book switch racing the handler must not steal the breadcrumb.
    expect(mockGetActiveTrack).not.toHaveBeenCalled();
  });
});
