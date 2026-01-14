import { Book, Chapter } from '@/types/Book';
import AuthorModel from '@/db/models/Author';
import BookModel from '@/db/models/Book';
import ChapterModel from '@/db/models/Chapter';
import * as RNFS from '@dr.pogodin/react-native-fs';
import database from '@/db';
import { Q } from '@nozbe/watermelondb';
import ImageResizer from '@bam.tech/react-native-image-resizer';
import { populateSingleBook } from '@/hooks/usePopulateDatabase';
import { getLibraryPaths } from '@/db/settingsQueries';
import {
  analyzeFileWithMediaInfo,
  analyzeFileWithMediaInfoNoCover,
} from './mediainfo';
import { BookImageColors, extractImageColors } from './imageColorExtractor';
import { useScanProgressStore } from '@/helpers/useScanProgressStore';
import { ArtworkColors } from './gradientColorSorter';

const DEFAULT_BOOK_ARTWORK_COLORS: ArtworkColors = {
  // average: null, // DEPRECATED: Removed from color extraction
  dominantAndroid: null,
  vibrant: null,
  darkVibrant: null,
  lightVibrant: null,
  muted: null,
  darkMuted: null,
  lightMuted: null,
};

/**
 * Groups chapter metadata into book structures.
 * Returns array of { authorName, book } for immediate processing.
 */
function groupChaptersIntoBooks(
  chapters: any[]
): { authorName: string; book: Book }[] {
  const bookMap = new Map<string, { authorName: string; book: Book }>();

  for (const chapter of chapters) {
    const bookKey = `${chapter.author}::${chapter.bookTitle}`;

    if (!bookMap.has(bookKey)) {
      bookMap.set(bookKey, {
        authorName: chapter.author,
        book: {
          bookId: chapter.url,
          author: chapter.author,
          bookTitle: chapter.bookTitle,
          chapters: [],
          bookDuration: 0,
          artwork: chapter.coverBase64 || null,
          artworkHeight: chapter.coverHeight || null,
          artworkWidth: chapter.coverWidth || null,
          artworkColors: DEFAULT_BOOK_ARTWORK_COLORS,
          bookProgress: {
            currentChapterIndex: 0,
            currentChapterProgress: 0,
          },
          bookProgressValue: 0,
          metadata: {
            year: chapter.year,
            description: chapter.description,
            narrator: chapter.narrator,
            genre: chapter.genre,
            sampleRate: chapter.sampleRate,
            bitrate: chapter.bitrate,
            copyright: chapter.copyright,
            codec: chapter.codec,
            totalTrackCount: chapter.totalTrackCount,
            ctime: chapter.ctime,
            mtime: chapter.mtime || null,
          },
        },
      });
    }

    const entry = bookMap.get(bookKey)!;
    const chapterData: Chapter = {
      author: chapter.author,
      bookTitle: chapter.bookTitle,
      chapterTitle: chapter.chapterTitle,
      chapterNumber: chapter.chapterNumber,
      chapterDuration: chapter.chapterDuration,
      startMs: chapter.startMs,
      url: chapter.url,
    };

    entry.book.chapters.push(chapterData);
    entry.book.bookDuration += chapterData.chapterDuration;
  }

  // Sort chapters within each book by chapter number
  for (const entry of bookMap.values()) {
    if (entry.book.chapters.length > 1) {
      entry.book.chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
    }
  }

  return Array.from(bookMap.values());
}

/**
 * Processes a single book: extracts artwork and writes to database.
 */
async function processAndPersistBook(
  authorName: string,
  book: Book
): Promise<void> {
  try {
    const bookWithArtwork = await extractArtworkForBook(book);
    await populateSingleBook(authorName, bookWithArtwork);
  } catch (error) {
    console.error(
      `Error processing book "${book.bookTitle}" by ${authorName}:`,
      error
    );
  } finally {
    // Always increment progress so UI reflects attempted processing
    useScanProgressStore.getState().incrementProcessedBooks();
  }
}

// Track which books already have cover art extracted (author::title -> true)
const booksWithCoverExtracted = new Set<string>();

/**
 * Checks if a chapter for this file needs cover extraction.
 * Returns true if any chapter belongs to a book we haven't seen yet.
 */
function needsCoverForFile(chapters: any[]): boolean {
  for (const chapter of chapters) {
    const bookTitle = chapter.bookTitle;
    if (!bookTitle) continue;

    const bookKey = `${chapter.author}::${bookTitle}`;
    if (!booksWithCoverExtracted.has(bookKey)) {
      booksWithCoverExtracted.add(bookKey);
      return true;
    }
  }
  return false;
}

/**
 * Scans a directory and processes books as they are discovered.
 * Recursively processes subdirectories after handling current directory files.
 */
async function handleReadDirectory(
  dirPath: string,
  allFiles: string[] = []
): Promise<{ allFiles: string[] }> {
  try {
    const dirContents = await RNFS.readDir(dirPath);
    const newChaptersInDir: any[] = [];
    const subdirectories: string[] = [];
    const newFilesToProcess: string[] = [];

    // Separate files and directories
    for (const item of dirContents) {
      if (item.isDirectory()) {
        subdirectories.push(item.path);
      } else if (
        item.isFile() &&
        (item.name.endsWith('.m4b') || item.name.endsWith('.mp3'))
      ) {
        allFiles.push(item.path);
        const exists = await checkIfFileExists(item.path);
        if (!exists) {
          newFilesToProcess.push(item.path);
        }
      }
    }

    // Process new files in sorted order (multi-file audiobooks have chapters in same directory)
    newFilesToProcess.sort();

    for (const filePath of newFilesToProcess) {
      // First scan without cover to check if this is the first file of a new book
      let metadata = await extractMetadata(filePath, true);

      // If this is the first file of a new book, re-scan with cover extraction
      if (needsCoverForFile(metadata)) {
        metadata = await extractMetadata(filePath, false);
      }

      newChaptersInDir.push(...metadata);
    }

    // Process discovered books immediately
    if (newChaptersInDir.length > 0) {
      const booksInDir = groupChaptersIntoBooks(newChaptersInDir);
      const progressStore = useScanProgressStore.getState();

      progressStore.setTotalBooks(progressStore.totalBooks + booksInDir.length);

      for (const { authorName, book } of booksInDir) {
        await processAndPersistBook(authorName, book);
      }
    }

    // Recurse into subdirectories
    for (const subdir of subdirectories) {
      await handleReadDirectory(subdir, allFiles);
    }

    return { allFiles };
  } catch (err) {
    console.error('Error reading directory', err);
    return { allFiles };
  }
}

/**
 * Checks if a chapter with this file path already exists in the database.
 */
async function checkIfFileExists(filePath: string): Promise<boolean> {
  const count = await database
    .get('chapters')
    .query(Q.where('url', filePath))
    .fetchCount();

  return count > 0;
}

type CueChapter = { title: string; startMs: number };

const CUE_TITLE_REGEX = /^\s*TITLE\s*"(.*)"\s*$/;
const CUE_INDEX_REGEX = /^\s*INDEX\s*01\s*(\d+):(\d+):(\d+)\s*$/;
const CUE_FRAMES_PER_SECOND = 75;

/**
 * Parses a CUE sheet file and extracts chapter information.
 * Returns null if parsing fails or no chapters are found.
 */
async function parseCueFile(cueFilePath: string): Promise<CueChapter[] | null> {
  try {
    const cueContent = await RNFS.readFile(cueFilePath, 'utf8');
    const lines = cueContent.split('\n');

    const chapters: CueChapter[] = [];
    let currentChapter: CueChapter | null = null;

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith('TRACK')) {
        if (currentChapter) {
          chapters.push(currentChapter);
        }
        currentChapter = { title: '', startMs: 0 };
        continue;
      }

      if (!currentChapter) continue;

      const titleMatch = trimmedLine.match(CUE_TITLE_REGEX);
      if (titleMatch) {
        currentChapter.title = titleMatch[1];
        continue;
      }

      const indexMatch = trimmedLine.match(CUE_INDEX_REGEX);
      if (indexMatch) {
        const minutes = parseInt(indexMatch[1], 10);
        const seconds = parseInt(indexMatch[2], 10);
        const frames = parseInt(indexMatch[3], 10);
        currentChapter.startMs =
          minutes * 60 * 1000 +
          seconds * 1000 +
          Math.round((frames / CUE_FRAMES_PER_SECOND) * 1000);
      }
    }

    if (currentChapter) {
      chapters.push(currentChapter);
    }

    return chapters.length > 0 ? chapters : null;
  } catch (error) {
    console.error(`Failed to parse CUE file ${cueFilePath}:`, error);
    return null;
  }
}

/**
 * Builds a chapter metadata object with common properties from file metadata.
 */
function buildChapterMetadata(
  metadata: any,
  filePath: string,
  bookTitleBackup: string | undefined,
  chapterInfo: {
    title: string;
    number: number;
    duration: number;
    startMs: number;
    totalTracks: number;
  }
) {
  return {
    author: metadata.author || 'Unknown Author',
    narrator: metadata.narrator || 'Unknown Voice Artist',
    bookTitle: metadata.album || bookTitleBackup,
    chapterTitle: chapterInfo.title,
    chapterNumber: chapterInfo.number,
    year: Number(metadata.releaseDate),
    description: metadata.description,
    genre: metadata.genre,
    sampleRate: metadata.sampleRate,
    codec: metadata.codec,
    bitrate: metadata.bitrate,
    copyright: metadata.copyright,
    artworkUri: null,
    totalTrackCount: chapterInfo.totalTracks,
    coverBase64: metadata.cover || null,
    coverWidth: metadata.imgWidth || null,
    coverHeight: metadata.imgHeight || null,
    ctime: new Date(),
    chapterDuration: chapterInfo.duration,
    startMs: chapterInfo.startMs,
    url: filePath,
  };
}

async function extractMetadata(filePath: string, skipCoverExtraction = false) {
  try {
    const metadata = skipCoverExtraction
      ? await analyzeFileWithMediaInfoNoCover(filePath)
      : await analyzeFileWithMediaInfo(filePath);

    let chapters = metadata.chapters || [];
    const bookTitleBackup = filePath
      .substring(0, filePath.lastIndexOf('/'))
      .split('/')
      .pop();

    // If no embedded chapters, check for a .cue file
    if (chapters.length === 0) {
      const cueFilePath =
        filePath.substring(0, filePath.lastIndexOf('.')) + '.cue';
      const cueFileExists = await RNFS.exists(cueFilePath);

      if (cueFileExists) {
        const cueChapters = await parseCueFile(cueFilePath);
        if (cueChapters) {
          chapters = cueChapters;
        }
      }
    }

    // Multi-chapter file (e.g. m4b)
    if (chapters.length > 0) {
      return chapters.map((chapter, index) => {
        const nextChapter = chapters[index + 1];
        const chapterEndMs = nextChapter
          ? nextChapter.startMs
          : metadata.durationMs || 0;
        const chapterDuration = (chapterEndMs - chapter.startMs) / 1000;

        return buildChapterMetadata(metadata, filePath, bookTitleBackup, {
          title: chapter.title || `Chapter ${index + 1}`,
          number: index + 1,
          duration: chapterDuration,
          startMs: chapter.startMs,
          totalTracks: chapters.length,
        });
      });
    }

    // Single-chapter file (e.g. mp3)
    const chapterDuration = metadata.durationMs ? metadata.durationMs / 1000 : 0;
    const fileName = filePath.split('/').pop() ?? '';
    const chapterTitle = fileName.split('.')[0] || metadata.title || 'Unknown Chapter';

    return [
      buildChapterMetadata(metadata, filePath, bookTitleBackup, {
        title: chapterTitle,
        number: metadata.trackPosition || 1,
        duration: chapterDuration,
        startMs: 0,
        totalTracks: 1,
      }),
    ];
  } catch (error) {
    console.error(`Error extracting metadata for ${filePath}`, error);
    return [
      {
        title: filePath.split('/').pop(),
        author: 'Unknown Author',
        trackNumber: 0,
        chapterDuration: 0,
        url: filePath,
      },
    ];
  }
}

/**
 * Sanitizes a string for use in a filename by replacing non-alphanumeric characters.
 */
function sanitizeForFilename(str: string): string {
  return str.replace(/[^a-zA-Z0-9]/g, '_');
}

/**
 * Detects image format from base64 data.
 * Returns the appropriate file extension and whether the JPEG needs repair.
 */
function detectImageFormat(base64Data: string): {
  extension: 'png' | 'jpg';
  needsJpegRepair: boolean;
} {
  // Base64 signatures for common image formats
  const PNG_SIGNATURE = 'iVBOR';
  const TRUNCATED_JPEG_SIGNATURE = '/+'; // Missing FFD8 SOI header (normal JPEG starts with /9j/)

  const isPng = base64Data.startsWith(PNG_SIGNATURE);
  const needsJpegRepair = base64Data.startsWith(TRUNCATED_JPEG_SIGNATURE);

  return {
    extension: isPng ? 'png' : 'jpg',
    needsJpegRepair,
  };
}

/**
 * Writes image data to a temp file, repairing truncated JPEGs if needed.
 * Some MediaInfo extractions return JPEGs missing the SOI (FFD8) header.
 */
async function writeTempImageFile(
  tempFilePath: string,
  base64Data: string,
  needsJpegRepair: boolean
): Promise<void> {
  if (needsJpegRepair) {
    // Prepend SOI marker (FFD8) before the data (which starts at FFE0/APP0)
    const soiMarker = new Uint8Array([0xff, 0xd8]);
    const soiString = String.fromCharCode(...soiMarker);
    await RNFS.writeFile(tempFilePath, soiString, 'ascii');
    await RNFS.appendFile(tempFilePath, base64Data, 'base64');
  } else {
    await RNFS.writeFile(tempFilePath, base64Data, 'base64');
  }
}

type ArtworkResult = {
  artworkUri: string | null;
  width: number;
  height: number;
};

/**
 * Saves base64 artwork to a WebP file after resizing.
 * Handles truncated JPEG detection and repair.
 */
async function saveArtworkToFile(
  base64Artwork: string,
  bookTitle: string,
  author: string
): Promise<ArtworkResult> {
  const safeBookTitle = sanitizeForFilename(bookTitle);
  const safeAuthor = sanitizeForFilename(author);
  const filename = `${safeAuthor}_${safeBookTitle}.webp`;

  const artworkDir = `${RNFS.DocumentDirectoryPath}/artwork`;
  const finalImagePath = `${artworkDir}/${filename}`;

  try {
    await RNFS.mkdir(artworkDir);

    const { extension, needsJpegRepair } = detectImageFormat(base64Artwork);
    const tempFilePath = `${RNFS.CachesDirectoryPath}/temp_artwork_${Date.now()}.${extension}`;

    await writeTempImageFile(tempFilePath, base64Artwork, needsJpegRepair);

    const resizedImage = await ImageResizer.createResizedImage(
      `file://${tempFilePath}`,
      800,
      800,
      'WEBP',
      80,
      0,
      undefined,
      false,
      { mode: 'contain', onlyScaleDown: true }
    );

    await RNFS.unlink(tempFilePath).catch(() => {});
    await RNFS.moveFile(resizedImage.path, finalImagePath);

    return {
      artworkUri: `file://${finalImagePath}`,
      width: resizedImage.width,
      height: resizedImage.height,
    };
  } catch (error) {
    console.error(`Failed to save artwork for ${bookTitle}:`, error);
    return { artworkUri: null, width: 0, height: 0 };
  }
}

const DEFAULT_ARTWORK_COLORS: BookImageColors = {
  // average: null, // DEPRECATED: Removed from extraction
  dominantAndroid: null,
  vibrant: null,
  darkVibrant: null,
  lightVibrant: null,
  muted: null,
  darkMuted: null,
  lightMuted: null,
};

// Default dimensions for placeholder artwork
const PLACEHOLDER_ARTWORK_SIZE = 500;

/**
 * Cleans and normalizes base64 image data from MediaInfo.
 * Handles multiple concatenated images and ensures valid base64 format.
 */
function cleanBase64ImageData(rawBase64: string): string {
  // MediaInfo may return multiple images separated by " / " - take only the first
  const firstImage = rawBase64.split(' / ')[0];

  // Remove all non-base64 characters
  let cleaned = firstImage.replace(/[^A-Za-z0-9+/=]/g, '');

  // Truncate at padding characters in the middle (indicates concatenated images)
  const paddingInMiddle = cleaned.search(/=+[^=]/);
  if (paddingInMiddle !== -1) {
    const paddingLength = cleaned.match(/=+/)?.[0]?.length ?? 0;
    cleaned = cleaned.substring(0, paddingInMiddle + paddingLength);
  }

  // Ensure length is a multiple of 4 (required for valid base64)
  const remainder = cleaned.length % 4;
  if (remainder !== 0) {
    cleaned = cleaned.substring(0, cleaned.length - remainder);
  }

  return cleaned;
}

/**
 * Extracts and processes artwork for a single book.
 * Returns the book with processed artwork data.
 */
async function extractArtworkForBook(book: Book): Promise<Book> {
  const rawBase64Artwork = book.artwork;

  if (!rawBase64Artwork) {
    return {
      ...book,
      artwork: null,
      artworkWidth: PLACEHOLDER_ARTWORK_SIZE,
      artworkHeight: PLACEHOLDER_ARTWORK_SIZE,
      artworkColors: DEFAULT_ARTWORK_COLORS,
    };
  }

  try {
    const cleanedBase64 = cleanBase64ImageData(rawBase64Artwork);

    const { artworkUri, width, height } = await saveArtworkToFile(
      cleanedBase64,
      book.bookTitle,
      book.author
    );

    // Extract colors from saved file to reduce memory pressure
    const artworkColors = artworkUri
      ? await extractImageColors(artworkUri)
      : DEFAULT_ARTWORK_COLORS;

    return {
      ...book,
      artwork: artworkUri,
      artworkWidth: width,
      artworkHeight: height,
      artworkColors,
    };
  } catch (error) {
    console.error(`Error processing artwork for ${book.bookTitle}`, error);
    return {
      ...book,
      artwork: null,
      artworkWidth: null,
      artworkHeight: null,
      artworkColors: DEFAULT_ARTWORK_COLORS,
    };
  }
}

/**
 * Removes chapters from the database that no longer exist on disk,
 * then cleans up any orphaned books and authors.
 */
async function removeMissingFiles(allFiles: string[]): Promise<void> {
  const fileSet = new Set(allFiles);

  const allChapters = await database
    .get<ChapterModel>('chapters')
    .query()
    .fetch();
  const chaptersToRemove = allChapters.filter(
    (chapter) => !fileSet.has(chapter.url)
  );

  if (chaptersToRemove.length > 0) {
    await database.write(async () => {
      for (const chapter of chaptersToRemove) {
        await chapter.destroyPermanently();
      }
    });
  }

  // Clean up orphaned books
  const allBooks = await database.get<BookModel>('books').query().fetch();
  const orphanedBooks: BookModel[] = [];

  for (const book of allBooks) {
    // @ts-expect-error - fetchCount() not in type definitions
    const chapterCount = await book.chapters.fetchCount();
    if (chapterCount === 0) {
      orphanedBooks.push(book);
    }
  }

  if (orphanedBooks.length > 0) {
    await database.write(async () => {
      for (const book of orphanedBooks) {
        await book.destroyPermanently();
      }
    });
  }

  // Clean up orphaned authors
  const allAuthors = await database.get<AuthorModel>('authors').query().fetch();
  const orphanedAuthors: AuthorModel[] = [];

  for (const author of allAuthors) {
    // @ts-expect-error - fetchCount() not in type definitions
    const bookCount = await author.books.fetchCount();
    if (bookCount === 0) {
      orphanedAuthors.push(author);
    }
  }

  if (orphanedAuthors.length > 0) {
    await database.write(async () => {
      for (const author of orphanedAuthors) {
        await author.destroyPermanently();
      }
    });
  }
}

export async function scanLibrary(): Promise<void> {
  console.log('Scanning library');

  // Reset cover tracking for new scan
  booksWithCoverExtracted.clear();

  const libraryPaths = await getLibraryPaths();

  if (!libraryPaths || libraryPaths.length === 0) {
    console.log('No library paths configured. Aborting scan.');
    return;
  }

  useScanProgressStore.getState().startScan();
  const combinedAllFiles: string[] = [];

  // Scan directories - books are processed incrementally as they are discovered
  for (const libraryPath of libraryPaths) {
    const { allFiles } = await handleReadDirectory(
      RNFS.ExternalStorageDirectoryPath + '/' + libraryPath
    );
    combinedAllFiles.push(...allFiles);
  }

  // Clean up any files that no longer exist
  await removeMissingFiles(combinedAllFiles);

  useScanProgressStore.getState().endScan();
}
