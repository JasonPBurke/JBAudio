import TrackPlayer from 'react-native-track-player';
import {
  recordFootprint,
  recordActiveBookFootprint,
  recordActiveBookPlayFootprint,
  recordActiveBookSeekFootprint,
  recordActiveBookChapterChangeFootprint,
  recordPreviousPressFootprint,
} from '../activeBookFootprints';
import { addFootprint } from '@/db/footprintQueries';
import { stampLastPlayed } from '@/db/bookQueries';
import {
  oneItemChapters,
  multiItemChapters,
} from './support/queueShapeFixtures';

/*
 * ⚠ THIS FILE DOES NOT MOCK `activeBookFootprints`. Every other suite that
 * touches footprints does — it is the established boundary — but the
 * derivation that turns a Player reading into the Chapter Position a
 * breadcrumb is filed at now lives INSIDE this module, so the usual mock
 * would swallow exactly what is under test here. The mock goes one layer
 * lower, at `addFootprint`, which is all `db/footprintQueries` still does.
 *
 * The real `locateInBook` runs, which is the point: half of what is pinned
 * below is that the two modules compose on both Queue shapes.
 */

jest.mock('react-native-track-player', () => ({
  __esModule: true,
  default: {
    getActiveTrack: jest.fn(),
    getActiveTrackIndex: jest.fn(),
    getProgress: jest.fn(),
  },
}));

jest.mock('@/db/footprintQueries', () => ({
  addFootprint: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/db/bookQueries', () => ({
  stampLastPlayed: jest.fn().mockResolvedValue(undefined),
}));

// The store reaches WatermelonDB's SQLite adapter, unresolvable in the node
// lane. It is where the chapters come from now — the same array the queue
// builders map — so every test sets the Book it is about.
let mockBooks: Record<string, { chapters: unknown[] }>;
jest.mock('@/store/library', () => ({
  useLibraryStore: { getState: () => ({ books: mockBooks }) },
}));

const mockGetActiveTrack = TrackPlayer.getActiveTrack as jest.Mock;
const mockGetActiveTrackIndex = TrackPlayer.getActiveTrackIndex as jest.Mock;
const mockGetProgress = TrackPlayer.getProgress as jest.Mock;
const mockAddFootprint = addFootprint as jest.Mock;
const mockStampLastPlayed = stampLastPlayed as jest.Mock;

/** Four files, one chapter each → a MULTI-ITEM Queue. */
const multiItem = multiItemChapters(4);
/** One file, chapters at 0:00, 10:00, 20:00 → a ONE-ITEM Queue. */
const oneItem = oneItemChapters([0, 600_000, 1_200_000]);

/** Every id these tests use, holding the same chapters. */
const everyBookHas = (chapters: unknown[]) =>
  Object.fromEntries(
    ['book-1', 'book-2', 'book-7', 'book-9'].map((id) => [id, { chapters }]),
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockBooks = everyBookHas(multiItem);
  mockGetActiveTrack.mockResolvedValue({ bookId: 'book-1' });
  mockGetActiveTrackIndex.mockResolvedValue(1);
  mockGetProgress.mockResolvedValue({ position: 12.345 });
  // Reset behaviour too: clearAllMocks clears calls but keeps any
  // mockRejectedValue a previous test installed.
  mockAddFootprint.mockResolvedValue(undefined);
  mockStampLastPlayed.mockResolvedValue(undefined);
});

/** The Chapter Position the default multi-item reading resolves to. */
const defaultChapter = { index: 1, positionSeconds: 12.345 };

/*
 * The derivation itself — where the breadcrumb is filed, given what the
 * Player says. Two opposite bugs lived here before this module owned it, and
 * each was the guard its sibling needed.
 */
describe('where the footprint lands', () => {
  it('files a multi-item Queue reading under the Queue index', async () => {
    mockGetActiveTrackIndex.mockResolvedValue(2);

    await recordFootprint('book-1', 'play');

    // Array position is the ordering: index 2 is the third row of the array
    // the queue builder mapped, and no re-sort happens on the way here.
    expect(mockAddFootprint).toHaveBeenCalledWith(
      'book-1',
      { index: 2, positionSeconds: 12.345 },
      'play',
    );
  });

  it('scans a one-item Queue reading down to a Chapter Position', async () => {
    mockBooks = everyBookHas(oneItem);
    mockGetProgress.mockResolvedValue({ position: 700 });

    await recordFootprint('book-1', 'play');

    // 700s is 100s into the chapter that starts at 600s.
    expect(mockAddFootprint).toHaveBeenCalledWith(
      'book-1',
      { index: 1, positionSeconds: 100 },
      'play',
    );
  });

  // Bug one. The Queue index is not read at all on this shape — it can only
  // ever be 0 — but the deleted version guarded on it before it knew the
  // shape, so an unreadable index lost the breadcrumb entirely.
  it('still records on a one-item Queue when the Queue index is unreadable', async () => {
    mockBooks = everyBookHas(oneItem);
    mockGetActiveTrackIndex.mockResolvedValue(undefined);
    mockGetProgress.mockResolvedValue({ position: 700 });

    await recordFootprint('book-1', 'play');

    expect(mockAddFootprint).toHaveBeenCalledWith(
      'book-1',
      { index: 1, positionSeconds: 100 },
      'play',
    );
  });

  // Bug two, and the opposite one: here the index IS the Chapter, so an
  // unreadable one has no honest answer. The deleted version fabricated `0`
  // and filed the breadcrumb under chapter one.
  it('records nothing on a multi-item Queue when the Queue index is unreadable', async () => {
    mockGetActiveTrackIndex.mockResolvedValue(undefined);

    await recordFootprint('book-1', 'play');

    expect(mockAddFootprint).not.toHaveBeenCalled();
  });

  it('records nothing when the seek path cannot read the Queue index', async () => {
    mockGetActiveTrackIndex.mockResolvedValue(undefined);

    await recordActiveBookSeekFootprint();

    expect(mockAddFootprint).not.toHaveBeenCalled();
  });

  /*
   * The two refusals `locateInBook` adds on a one-item Queue, where the
   * Chapter has to be SCANNED out of the Position rather than read off an
   * index. The deleted loop answered row 0 for both — a guess wearing a
   * reading's clothes. Book Position is exact in both cases; it is the
   * Chapter that cannot be told, and a footprint needs the Chapter.
   */
  it('records nothing when the Position precedes every chapter boundary', async () => {
    // A Book whose first chapter starts after a preamble.
    mockBooks = everyBookHas(oneItemChapters([600_000, 1_200_000]));
    mockGetProgress.mockResolvedValue({ position: 100 });

    await recordFootprint('book-1', 'play');

    expect(mockAddFootprint).not.toHaveBeenCalled();
  });

  it('records nothing when the rows carry no boundaries at all', async () => {
    // Every row at 0:00 — the backwards scan would confidently answer the
    // LAST row for every Position, which is the most misleading row available.
    mockBooks = everyBookHas(oneItemChapters([0, 0, 0]));
    mockGetProgress.mockResolvedValue({ position: 700 });

    await recordFootprint('book-1', 'play');

    expect(mockAddFootprint).not.toHaveBeenCalled();
  });

  it('records nothing for an index that points past the last chapter', async () => {
    mockGetActiveTrackIndex.mockResolvedValue(9);

    await recordFootprint('book-1', 'play');

    expect(mockAddFootprint).not.toHaveBeenCalled();
  });

  it('records nothing for a Book the store does not hold', async () => {
    mockBooks = {};

    await recordFootprint('book-1', 'play');

    expect(mockAddFootprint).not.toHaveBeenCalled();
  });
});

describe('recordActiveBookFootprint', () => {
  it('records the given trigger for the active Book', async () => {
    await recordActiveBookFootprint('timer_activation');

    expect(mockAddFootprint).toHaveBeenCalledTimes(1);
    expect(mockAddFootprint).toHaveBeenCalledWith(
      'book-1',
      defaultChapter,
      'timer_activation',
    );
  });

  it('records nothing when no Book is loaded', async () => {
    mockGetActiveTrack.mockResolvedValue(undefined);

    await recordActiveBookFootprint('timer_activation');

    expect(mockAddFootprint).not.toHaveBeenCalled();
  });

  it('uses a supplied bookId rather than reading the player', async () => {
    await recordActiveBookFootprint('chapter_change', 'book-7');

    expect(mockAddFootprint).toHaveBeenCalledWith(
      'book-7',
      defaultChapter,
      'chapter_change',
    );
    expect(mockGetActiveTrack).not.toHaveBeenCalled();
  });

  // The load-bearing behaviour of every call site: a footprint is a
  // breadcrumb, so failing to write one must never block the timer
  // activation or playback command it was recorded alongside.
  it('swallows an addFootprint rejection instead of propagating it', async () => {
    mockAddFootprint.mockRejectedValue(new Error('db down'));

    await expect(
      recordActiveBookFootprint('timer_activation'),
    ).resolves.toBeUndefined();
  });

  it('swallows a player read rejection instead of propagating it', async () => {
    mockGetActiveTrack.mockRejectedValue(new Error('no player'));

    await expect(
      recordActiveBookFootprint('timer_activation'),
    ).resolves.toBeUndefined();
    expect(mockAddFootprint).not.toHaveBeenCalled();
  });
});

describe('recordActiveBookPlayFootprint', () => {
  it('stamps last-played and records a play footprint for the active Book', async () => {
    await recordActiveBookPlayFootprint();

    expect(mockStampLastPlayed).toHaveBeenCalledWith('book-1');
    expect(mockAddFootprint).toHaveBeenCalledWith(
      'book-1',
      defaultChapter,
      'play',
    );
  });

  it('stamps before it records', async () => {
    const order: string[] = [];
    mockStampLastPlayed.mockImplementation(async () => {
      order.push('stamp');
    });
    mockAddFootprint.mockImplementation(async () => {
      order.push('record');
    });

    await recordActiveBookPlayFootprint();

    expect(order).toEqual(['stamp', 'record']);
  });

  it('does neither when no Book is loaded', async () => {
    mockGetActiveTrack.mockResolvedValue(undefined);

    await recordActiveBookPlayFootprint();

    expect(mockStampLastPlayed).not.toHaveBeenCalled();
    expect(mockAddFootprint).not.toHaveBeenCalled();
  });

  it('swallows a rejection instead of propagating it', async () => {
    mockAddFootprint.mockRejectedValue(new Error('db down'));

    await expect(recordActiveBookPlayFootprint()).resolves.toBeUndefined();
  });
});

describe('recordActiveBookSeekFootprint', () => {
  it('records a seek footprint at the pre-seek position', async () => {
    await recordActiveBookSeekFootprint();

    expect(mockAddFootprint).toHaveBeenCalledTimes(1);
    expect(mockAddFootprint).toHaveBeenCalledWith(
      'book-1',
      defaultChapter,
      'seek',
    );
  });

  it('records nothing when there is no active track', async () => {
    mockGetActiveTrack.mockResolvedValue(undefined);

    await recordActiveBookSeekFootprint();

    expect(mockAddFootprint).not.toHaveBeenCalled();
  });

  it('records nothing when the active track has no bookId', async () => {
    mockGetActiveTrack.mockResolvedValue({ url: 'file://x.mp3' });

    await recordActiveBookSeekFootprint();

    expect(mockAddFootprint).not.toHaveBeenCalled();
  });

  it('resolves without throwing when recording fails', async () => {
    mockAddFootprint.mockRejectedValue(new Error('db down'));

    await expect(recordActiveBookSeekFootprint()).resolves.toBeUndefined();
  });

  it('resolves without throwing when TrackPlayer calls fail', async () => {
    mockGetProgress.mockRejectedValue(new Error('no player'));

    await expect(recordActiveBookSeekFootprint()).resolves.toBeUndefined();
    expect(mockAddFootprint).not.toHaveBeenCalled();
  });
});

describe('recordActiveBookChapterChangeFootprint', () => {
  it('records a chapter_change footprint for the given bookId', async () => {
    await recordActiveBookChapterChangeFootprint('book-2');

    expect(mockAddFootprint).toHaveBeenCalledTimes(1);
    expect(mockAddFootprint).toHaveBeenCalledWith(
      'book-2',
      defaultChapter,
      'chapter_change',
    );
    // bookId was supplied — no need for a bridge round-trip
    expect(mockGetActiveTrack).not.toHaveBeenCalled();
  });

  it('records a chapter_restart footprint when that trigger is passed', async () => {
    await recordActiveBookChapterChangeFootprint('book-2', 'chapter_restart');

    expect(mockAddFootprint).toHaveBeenCalledWith(
      'book-2',
      defaultChapter,
      'chapter_restart',
    );
  });

  it('falls back to the active track when no bookId is given', async () => {
    await recordActiveBookChapterChangeFootprint();

    expect(mockAddFootprint).toHaveBeenCalledWith(
      'book-1',
      defaultChapter,
      'chapter_change',
    );
  });

  it('records nothing when no bookId can be resolved', async () => {
    mockGetActiveTrack.mockResolvedValue(undefined);

    await recordActiveBookChapterChangeFootprint();

    expect(mockAddFootprint).not.toHaveBeenCalled();
  });

  it('resolves without throwing when recording fails', async () => {
    mockAddFootprint.mockRejectedValue(new Error('db down'));

    await expect(
      recordActiveBookChapterChangeFootprint('book-1'),
    ).resolves.toBeUndefined();
  });
});

describe('recordActiveBookSeekFootprint — explicit bookId', () => {
  it('uses the bookId it was given rather than re-reading the active track', async () => {
    await recordActiveBookSeekFootprint('book-9');

    expect(mockAddFootprint).toHaveBeenCalledWith(
      'book-9',
      defaultChapter,
      'seek',
    );
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

    expect(mockAddFootprint).toHaveBeenCalledWith(
      'book-1',
      defaultChapter,
      'chapter_change',
    );
  });

  it('labels a resolved restart press `chapter_restart`', async () => {
    await recordPreviousPressFootprint('book-1', 'restart');

    expect(mockAddFootprint).toHaveBeenCalledWith(
      'book-1',
      defaultChapter,
      'chapter_restart',
    );
  });

  // The playback service reads `string | null` from the player and the button
  // reads `string | undefined` from the store; neither converts, and an
  // unreadable Active Book records nothing rather than guessing one.
  it.each([null, undefined])('records nothing for %p', async (bookId) => {
    await recordPreviousPressFootprint(bookId, 'previous');

    expect(mockAddFootprint).not.toHaveBeenCalled();
  });
});
