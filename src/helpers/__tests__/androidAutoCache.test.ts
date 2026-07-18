import * as RNFS from '@dr.pogodin/react-native-fs';
import {
  writeAndroidAutoCache,
  scheduleAndroidAutoCacheWrite,
} from '../androidAutoCache';
import type { Author } from '@/types/Book';

jest.mock('@dr.pogodin/react-native-fs', () => ({
  DocumentDirectoryPath: '/data/user/0/com.fuzzylogic42.JBAudio/files',
  writeFile: jest.fn().mockResolvedValue(undefined),
  moveFile: jest.fn().mockResolvedValue(undefined),
}));

const FINAL_PATH =
  '/data/user/0/com.fuzzylogic42.JBAudio/files/android_auto_cache.json';

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

const mockAuthors: Author[] = [
  {
    name: 'Frank Herbert',
    books: [
      {
        bookId: 'book1',
        bookTitle: 'Dune',
        author: 'Frank Herbert',
        artwork: '/path/to/dune.jpg',
        artworkHeight: null,
        artworkWidth: null,
        artworkColors: null,
        selectedAccentColorType: null,
        bookDuration: 3600,
        chapters: [],
        bookProgress: { currentChapterIndex: 0, currentChapterProgress: 0 },
        bookProgressValue: 0,
        lastPlayedAt: null,
        finishedAt: null,
        isSingleFile: false,
        metadata: {
          ctime: 1700000000000,
          year: '',
          narrator: '',
          genre: '',
          description: '',
          copyright: '',
        },
      },
    ],
  },
  {
    name: 'Isaac Asimov',
    books: [
      {
        bookId: 'book2',
        bookTitle: 'Foundation',
        author: 'Isaac Asimov',
        artwork: '/path/to/foundation.jpg',
        artworkHeight: null,
        artworkWidth: null,
        artworkColors: null,
        selectedAccentColorType: null,
        bookDuration: 7200,
        chapters: [],
        bookProgress: { currentChapterIndex: 0, currentChapterProgress: 0 },
        bookProgressValue: 0,
        lastPlayedAt: null,
        finishedAt: null,
        isSingleFile: false,
        metadata: {
          ctime: 1710000000000,
          year: '',
          narrator: '',
          genre: '',
          description: '',
          copyright: '',
        },
      },
    ],
  },
];

describe('writeAndroidAutoCache', () => {
  beforeEach(() => jest.clearAllMocks());

  it('writes valid JSON with the expected shape', async () => {
    await writeAndroidAutoCache(mockAuthors);
    expect(RNFS.writeFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'utf8',
    );
    const written = JSON.parse(
      (RNFS.writeFile as jest.Mock).mock.calls[0][1],
    );
    expect(written).toHaveProperty('recentlyAdded');
    expect(written).toHaveProperty('allBooks');
    expect(written).toHaveProperty('authors');
  });

  it('writes to a temp file, then atomically renames over the final path', async () => {
    await writeAndroidAutoCache(mockAuthors);
    const [tempPath] = (RNFS.writeFile as jest.Mock).mock.calls[0];
    expect(tempPath).not.toBe(FINAL_PATH);
    expect(RNFS.moveFile).toHaveBeenCalledWith(tempPath, FINAL_PATH);
  });

  it('uses distinct temp paths for successive writes', async () => {
    await writeAndroidAutoCache(mockAuthors);
    await writeAndroidAutoCache(mockAuthors);
    const [firstTemp] = (RNFS.writeFile as jest.Mock).mock.calls[0];
    const [secondTemp] = (RNFS.writeFile as jest.Mock).mock.calls[1];
    expect(firstTemp).not.toBe(secondTemp);
  });

  it('does not rename when the temp write fails', async () => {
    (RNFS.writeFile as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
    await writeAndroidAutoCache(mockAuthors);
    expect(RNFS.moveFile).not.toHaveBeenCalled();
  });

  it('sorts allBooks alphabetically by title', async () => {
    await writeAndroidAutoCache(mockAuthors);
    const written = JSON.parse(
      (RNFS.writeFile as jest.Mock).mock.calls[0][1],
    );
    expect(written.allBooks[0].title).toBe('Dune');
    expect(written.allBooks[1].title).toBe('Foundation');
  });

  it('sorts recentlyAdded by ctime descending', async () => {
    await writeAndroidAutoCache(mockAuthors);
    const written = JSON.parse(
      (RNFS.writeFile as jest.Mock).mock.calls[0][1],
    );
    // Foundation has higher ctime (1710000000000 > 1700000000000)
    expect(written.recentlyAdded[0].bookId).toBe('book2');
    expect(written.recentlyAdded[1].bookId).toBe('book1');
  });

  it('sorts authors alphabetically', async () => {
    await writeAndroidAutoCache(mockAuthors);
    const written = JSON.parse(
      (RNFS.writeFile as jest.Mock).mock.calls[0][1],
    );
    expect(written.authors[0].name).toBe('Frank Herbert');
    expect(written.authors[1].name).toBe('Isaac Asimov');
  });

  it('skips writing on iOS', async () => {
    const { Platform: MockPlatform } = jest.requireMock('react-native');
    MockPlatform.OS = 'ios';
    await writeAndroidAutoCache(mockAuthors);
    expect(RNFS.writeFile).not.toHaveBeenCalled();
    MockPlatform.OS = 'android'; // reset for other tests
  });

  it('includes each book progress state for AA completion badges', async () => {
    const authors: Author[] = [
      {
        ...mockAuthors[0],
        books: [{ ...mockAuthors[0].books[0], bookProgressValue: 2 }],
      },
      mockAuthors[1],
    ];

    await writeAndroidAutoCache(authors);

    const written = JSON.parse(
      (RNFS.writeFile as jest.Mock).mock.calls[0][1],
    );
    expect(written.allBooks[0]).toMatchObject({
      bookId: 'book1',
      progress: 2,
    });
    expect(written.allBooks[1]).toMatchObject({
      bookId: 'book2',
      progress: 0,
    });
  });

  it('does not throw when writeFile fails', async () => {
    (RNFS.writeFile as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
    await expect(writeAndroidAutoCache(mockAuthors)).resolves.not.toThrow();
  });
});

describe('scheduleAndroidAutoCacheWrite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('coalesces rapid calls into a single write of the latest data', async () => {
    const laterAuthors: Author[] = [mockAuthors[0]];

    scheduleAndroidAutoCacheWrite(mockAuthors);
    scheduleAndroidAutoCacheWrite(laterAuthors);
    await jest.runAllTimersAsync();

    expect(RNFS.writeFile).toHaveBeenCalledTimes(1);
    const written = JSON.parse(
      (RNFS.writeFile as jest.Mock).mock.calls[0][1],
    );
    expect(written.authors).toHaveLength(1);
    expect(written.authors[0].name).toBe('Frank Herbert');
  });

  it('writes again for calls after the debounce window', async () => {
    scheduleAndroidAutoCacheWrite(mockAuthors);
    await jest.runAllTimersAsync();
    scheduleAndroidAutoCacheWrite(mockAuthors);
    await jest.runAllTimersAsync();

    expect(RNFS.writeFile).toHaveBeenCalledTimes(2);
  });

  it('does not write before the debounce window elapses', () => {
    scheduleAndroidAutoCacheWrite(mockAuthors);
    jest.advanceTimersByTime(100);

    expect(RNFS.writeFile).not.toHaveBeenCalled();
  });
});
