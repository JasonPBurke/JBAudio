import { enumerateAudioViaMediaStore } from '../enumerateAudioViaMediaStore';
import * as MediaLibrary from 'expo-media-library';
import type { LibraryFolderEntry } from '@/db/models/Settings';

jest.mock('expo-media-library', () => ({
  MediaType: { audio: 'audio' },
  getAssetsAsync: jest.fn(),
}));

jest.mock('@dr.pogodin/react-native-fs', () => ({
  ExternalStorageDirectoryPath: '/storage/emulated/0',
}));

const mockGetAssets = MediaLibrary.getAssetsAsync as jest.Mock;

const asset = (uri: string, filename: string, id = uri) => ({
  id,
  uri,
  filename,
  mediaType: 'audio',
  width: 0,
  height: 0,
  creationTime: 0,
  modificationTime: 0,
  duration: 0,
});

const ENTRIES: LibraryFolderEntry[] = [
  { path: 'Audiobooks/Christopher Moore', treeUri: 'content://tree/cm' },
  { path: 'Audiobooks/Terry Pratchett', treeUri: 'content://tree/tp' },
];

describe('enumerateAudioViaMediaStore', () => {
  beforeEach(() => {
    mockGetAssets.mockReset();
  });

  test('returns empty results when no library entries are configured', async () => {
    const r = await enumerateAudioViaMediaStore([]);
    expect(r.allFiles).toEqual([]);
    expect(r.filesByDir.size).toBe(0);
    expect(r.contexts.size).toBe(0);
    expect(mockGetAssets).not.toHaveBeenCalled();
  });

  test('keeps only .m4b and .mp3 files under a configured root', async () => {
    mockGetAssets.mockResolvedValue({
      assets: [
        asset(
          'file:///storage/emulated/0/Audiobooks/Christopher Moore/Lamb/01.m4b',
          '01.m4b',
        ),
        asset(
          'file:///storage/emulated/0/Audiobooks/Christopher Moore/Lamb/cover.jpg',
          'cover.jpg',
        ),
        asset(
          'file:///storage/emulated/0/Music/some_song.mp3',
          'some_song.mp3',
        ),
      ],
      totalCount: 3,
      hasNextPage: false,
      endCursor: '',
    });

    const r = await enumerateAudioViaMediaStore(ENTRIES);

    expect(r.allFiles).toEqual([
      '/storage/emulated/0/Audiobooks/Christopher Moore/Lamb/01.m4b',
    ]);
  });

  test('skips assets whose URI is not file://', async () => {
    mockGetAssets.mockResolvedValue({
      assets: [
        asset(
          'content://media/external/audio/media/42',
          'something.mp3',
          '42',
        ),
        asset(
          'file:///storage/emulated/0/Audiobooks/Christopher Moore/Lamb/01.m4b',
          '01.m4b',
        ),
      ],
      totalCount: 2,
      hasNextPage: false,
      endCursor: '',
    });

    const r = await enumerateAudioViaMediaStore(ENTRIES);

    expect(r.allFiles).toHaveLength(1);
    expect(r.nonFileUriSkipped).toBe(1);
  });

  test('respects trailing-slash boundary on root matching', async () => {
    // Confirms /Audiobooks/Christopher Moore root does NOT match
    // /Audiobooks/Christopher Moore Two/...
    mockGetAssets.mockResolvedValue({
      assets: [
        asset(
          'file:///storage/emulated/0/Audiobooks/Christopher Moore Two/Foo/01.m4b',
          '01.m4b',
        ),
      ],
      totalCount: 1,
      hasNextPage: false,
      endCursor: '',
    });

    const r = await enumerateAudioViaMediaStore(ENTRIES);

    expect(r.allFiles).toEqual([]);
  });

  test('decodes URI-encoded characters in paths', async () => {
    mockGetAssets.mockResolvedValue({
      assets: [
        asset(
          'file:///storage/emulated/0/Audiobooks/Terry%20Pratchett/Discworld%20(2022)/(1)%20The%20Colour%20of%20Magic.m4b',
          '(1) The Colour of Magic.m4b',
        ),
      ],
      totalCount: 1,
      hasNextPage: false,
      endCursor: '',
    });

    const r = await enumerateAudioViaMediaStore(ENTRIES);

    expect(r.allFiles).toEqual([
      '/storage/emulated/0/Audiobooks/Terry Pratchett/Discworld (2022)/(1) The Colour of Magic.m4b',
    ]);
  });

  test('groups files by directory and attaches matching tree URI per directory', async () => {
    mockGetAssets.mockResolvedValue({
      assets: [
        asset(
          'file:///storage/emulated/0/Audiobooks/Christopher Moore/Lamb/01.m4b',
          '01.m4b',
        ),
        asset(
          'file:///storage/emulated/0/Audiobooks/Christopher Moore/Lamb/02.m4b',
          '02.m4b',
        ),
        asset(
          'file:///storage/emulated/0/Audiobooks/Terry Pratchett/Discworld/01.m4b',
          '01.m4b',
        ),
      ],
      totalCount: 3,
      hasNextPage: false,
      endCursor: '',
    });

    const r = await enumerateAudioViaMediaStore(ENTRIES);

    const lambDir =
      '/storage/emulated/0/Audiobooks/Christopher Moore/Lamb';
    const discDir =
      '/storage/emulated/0/Audiobooks/Terry Pratchett/Discworld';

    expect(r.filesByDir.get(lambDir)).toEqual([
      `${lambDir}/01.m4b`,
      `${lambDir}/02.m4b`,
    ]);
    expect(r.filesByDir.get(discDir)).toEqual([`${discDir}/01.m4b`]);

    expect(r.contexts.get(lambDir)).toEqual({
      rootAbsPath: '/storage/emulated/0/Audiobooks/Christopher Moore',
      treeUri: 'content://tree/cm',
    });
    expect(r.contexts.get(discDir)).toEqual({
      rootAbsPath: '/storage/emulated/0/Audiobooks/Terry Pratchett',
      treeUri: 'content://tree/tp',
    });
  });

  test('sorts files within each directory (matches old filename-derived order)', async () => {
    // Old code sorted newFilesToProcess; we preserve that.
    mockGetAssets.mockResolvedValue({
      assets: [
        asset(
          'file:///storage/emulated/0/Audiobooks/Christopher Moore/Lamb/03.m4b',
          '03.m4b',
        ),
        asset(
          'file:///storage/emulated/0/Audiobooks/Christopher Moore/Lamb/01.m4b',
          '01.m4b',
        ),
        asset(
          'file:///storage/emulated/0/Audiobooks/Christopher Moore/Lamb/02.m4b',
          '02.m4b',
        ),
      ],
      totalCount: 3,
      hasNextPage: false,
      endCursor: '',
    });

    const r = await enumerateAudioViaMediaStore(ENTRIES);
    const lambDir =
      '/storage/emulated/0/Audiobooks/Christopher Moore/Lamb';

    expect(r.filesByDir.get(lambDir)).toEqual([
      `${lambDir}/01.m4b`,
      `${lambDir}/02.m4b`,
      `${lambDir}/03.m4b`,
    ]);
  });

  test('sorts unpadded chapter numbers naturally, not lexicographically', async () => {
    const dir = '/storage/emulated/0/Audiobooks/Terry Pratchett/Mort';
    const names = [
      'Chapter 10.mp3',
      'Chapter 2.mp3',
      'Chapter 1.mp3',
      'Chapter 11.mp3',
      'Chapter 3.mp3',
    ];
    mockGetAssets.mockResolvedValue({
      assets: names.map((n) => asset(`file://${dir}/${n}`, n)),
      totalCount: names.length,
      hasNextPage: false,
      endCursor: '',
    });

    const r = await enumerateAudioViaMediaStore(ENTRIES);

    expect(r.filesByDir.get(dir)).toEqual([
      `${dir}/Chapter 1.mp3`,
      `${dir}/Chapter 2.mp3`,
      `${dir}/Chapter 3.mp3`,
      `${dir}/Chapter 10.mp3`,
      `${dir}/Chapter 11.mp3`,
    ]);
  });
});
