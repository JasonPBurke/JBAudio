import * as RNFS from '@dr.pogodin/react-native-fs';
import { writeAndroidAutoCache } from '../androidAutoCache';
import type { Author } from '@/types/Book';

jest.mock('@dr.pogodin/react-native-fs', () => ({
  DocumentDirectoryPath: '/data/user/0/com.fuzzylogic42.JBAudio/files',
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

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
        bookDuration: 3600,
        chapters: [],
        bookProgress: { currentChapterIndex: 0, currentChapterProgress: 0 },
        bookProgressValue: 0,
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
        bookDuration: 7200,
        chapters: [],
        bookProgress: { currentChapterIndex: 0, currentChapterProgress: 0 },
        bookProgressValue: 0,
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

  it('writes valid JSON to the correct path', async () => {
    await writeAndroidAutoCache(mockAuthors);
    expect(RNFS.writeFile).toHaveBeenCalledWith(
      '/data/user/0/com.fuzzylogic42.JBAudio/files/android_auto_cache.json',
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

  it('does not throw when writeFile fails', async () => {
    (RNFS.writeFile as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
    await expect(writeAndroidAutoCache(mockAuthors)).resolves.not.toThrow();
  });
});
