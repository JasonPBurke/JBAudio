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
import { analyzeFileWithMediaInfo } from './mediainfo';
import { BookImageColors, extractImageColors } from './imageColorExtractor';
import { useScanProgressStore } from '@/helpers/useScanProgressStore';

/**
 * Groups chapter metadata into book structures.
 * Returns array of { authorName, book } for immediate processing.
 */
const groupChaptersIntoBooks = (chapters: any[]): { authorName: string; book: Book }[] => {
  const bookMap = new Map<string, { authorName: string; book: Book }>();

  for (const chapter of chapters) {
    // Use author + bookTitle as unique key for grouping
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
          artworkColors: {
            average: null,
            dominant: null,
            vibrant: null,
            darkVibrant: null,
            lightVibrant: null,
            muted: null,
            darkMuted: null,
            lightMuted: null,
          },
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

  // Sort chapters within each book
  for (const entry of bookMap.values()) {
    if (entry.book.chapters.length > 1) {
      entry.book.chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
    }
  }

  return Array.from(bookMap.values());
};

/**
 * Processes a single book: extracts artwork and writes to database.
 */
const processAndPersistBook = async (authorName: string, book: Book) => {
  try {
    const bookWithArtwork = await extractArtworkForBook(book);
    await populateSingleBook(authorName, bookWithArtwork);
    useScanProgressStore.getState().incrementProcessedBooks();
  } catch (error) {
    console.error(
      `Error processing book "${book.bookTitle}" by ${authorName}:`,
      error
    );
    // Still increment progress so UI reflects attempted processing
    useScanProgressStore.getState().incrementProcessedBooks();
  }
};

// Track which books already have cover art extracted (author::title -> true)
const booksWithCoverExtracted = new Set<string>();

/**
 * Scans a directory and processes books as they are discovered.
 * For each directory:
 * 1. Scan all audio files in this directory
 * 2. Group new files into books
 * 3. Process each book immediately (artwork + DB write)
 * 4. Recurse into subdirectories
 */
const handleReadDirectory = async (
  path: string,
  allFiles: string[] = []
) => {
  try {
    const result = await RNFS.readDir(path);
    const newChaptersInDir: any[] = [];
    const subdirectories: string[] = [];

    // First pass: collect files and subdirectories
    for (const item of result) {
      if (item.isDirectory()) {
        subdirectories.push(item.path);
      } else if (
        (item.isFile() && item.name.endsWith('.m4b')) ||
        item.name.endsWith('.mp3')
      ) {
        allFiles.push(item.path);
        const fileExists = await checkIfFileExists(item.path);
        if (!fileExists) {
          const metadata = await extractMetadata(item.path);

          // Memory optimization: Only keep cover data for first file of each book
          for (const chapter of metadata) {
            const bookTitle = (chapter as any).bookTitle;
            if (!bookTitle) continue; // Skip error case entries

            const bookKey = `${chapter.author}::${bookTitle}`;
            if (booksWithCoverExtracted.has(bookKey)) {
              // Clear cover data for subsequent chapters to reduce memory
              (chapter as any).coverBase64 = null;
              (chapter as any).coverWidth = null;
              (chapter as any).coverHeight = null;
            } else if ((chapter as any).coverBase64) {
              // Mark this book as having cover extracted
              booksWithCoverExtracted.add(bookKey);
            }
          }

          newChaptersInDir.push(...metadata);
        }
      }
    }

    // Process any new books found in this directory immediately
    if (newChaptersInDir.length > 0) {
      const booksInDir = groupChaptersIntoBooks(newChaptersInDir);

      // Update total count for progress tracking
      useScanProgressStore.getState().setTotalBooks(
        useScanProgressStore.getState().totalBooks + booksInDir.length
      );

      // Process each book immediately
      for (const { authorName, book } of booksInDir) {
        await processAndPersistBook(authorName, book);
      }
    }

    // Then recurse into subdirectories
    for (const subdir of subdirectories) {
      await handleReadDirectory(subdir, allFiles);
    }

    return { allFiles };
  } catch (err) {
    console.error('Error reading directory', err);
    return { allFiles };
  }
};

const checkIfFileExists = async (path: string) => {
  //* should never be greater than 1
  const matchingChapterUriCount = await database
    .get('chapters')
    .query(Q.where('url', path))
    .fetchCount();

  return matchingChapterUriCount > 0; // allows for boolean check
};

const parseCueFile = async (
  cueFilePath: string,
  totalDurationMs: number
) => {
  try {
    const cueSheetContent = await RNFS.readFile(cueFilePath, 'utf8');
    const lines = cueSheetContent.split('\n');

    const chapters: { title: string; startMs: number }[] = [];
    let currentChapter: { title: string; startMs: number } | null = null;

    const titleRegex = /^\s*TITLE\s*"(.*)"\s*$/;
    const indexRegex = /^\s*INDEX\s*01\s*(\d+):(\d+):(\d+)\s*$/;

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith('TRACK')) {
        // When we see a new TRACK, push the previous one and start a new one.
        if (currentChapter) {
          chapters.push(currentChapter);
        }
        currentChapter = { title: '', startMs: 0 };
      }

      const titleMatch = trimmedLine.match(titleRegex);
      if (titleMatch && currentChapter) {
        currentChapter.title = titleMatch[1];
      }

      const indexMatch = trimmedLine.match(indexRegex);
      if (indexMatch && currentChapter) {
        const minutes = parseInt(indexMatch[1], 10);
        const seconds = parseInt(indexMatch[2], 10);
        const frames = parseInt(indexMatch[3], 10);
        const startTimeMs =
          minutes * 60 * 1000 +
          seconds * 1000 +
          Math.round((frames / 75) * 1000);
        currentChapter.startMs = startTimeMs;
      }
    }

    // Add the last chapter
    if (currentChapter) {
      chapters.push(currentChapter);
    }

    return chapters.length > 0 ? chapters : null;
  } catch (error) {
    console.error(`Failed to parse CUE file ${cueFilePath}:`, error);
    return null;
  }
};

const extractMetadata = async (filePath: string) => {
  try {
    const metadata = await analyzeFileWithMediaInfo(filePath);
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
        // console.log(`Found CUE file for ${filePath}, parsing...`);
        const cueChapters = await parseCueFile(
          cueFilePath,
          metadata.durationMs || 0
        );
        if (cueChapters) {
          chapters = cueChapters;
        }
      }
    }

    if (chapters.length > 0) {
      // This is a multi-chapter file (e.g. m4b)
      return chapters.map((chapter, index) => {
        const nextChapter = chapters[index + 1];
        const chapterEndMs = nextChapter
          ? nextChapter.startMs
          : metadata.durationMs || 0;
        const chapterDuration = (chapterEndMs - chapter.startMs) / 1000;

        return {
          author: metadata.author || 'Unknown Author',
          narrator: metadata.narrator || 'Unknown Voice Artist',
          bookTitle: metadata.album || bookTitleBackup,
          chapterTitle: chapter.title || `Chapter ${index + 1}`,
          chapterNumber: index + 1,
          year: Number(metadata.releaseDate),
          description: metadata.description,
          genre: metadata.genre,
          sampleRate: metadata.sampleRate,
          codec: metadata.codec,
          bitrate: metadata.bitrate,
          copyright: metadata.copyright,
          artworkUri: null, // Will be extracted later
          totalTrackCount: chapters.length,
          coverBase64: metadata.cover || null,
          coverWidth: metadata.imgWidth || null,
          coverHeight: metadata.imgHeight || null,

          ctime: new Date(),
          chapterDuration: chapterDuration,
          startMs: chapter.startMs,
          url: filePath,
        };
      });
    } else {
      // This is a single-chapter file (e.g. mp3)
      const chapterDuration = metadata.durationMs
        ? metadata.durationMs / 1000
        : 0;
      return [
        {
          author: metadata.author || 'Unknown Author',
          narrator: metadata.narrator || 'Unknown Voice Artist',
          bookTitle: metadata.album || bookTitleBackup,
          chapterTitle:
            filePath.split('/').pop()?.split('.')[0] || metadata.title,
          chapterNumber: metadata.trackPosition || 1,
          year: Number(metadata.releaseDate),
          description: metadata.description,
          genre: metadata.genre,
          sampleRate: metadata.sampleRate,
          codec: metadata.codec,
          bitrate: metadata.bitrate,
          copyright: metadata.copyright,
          artworkUri: null,
          totalTrackCount: 1,
          coverBase64: metadata.cover || null,
          coverWidth: metadata.imgWidth || null,
          coverHeight: metadata.imgHeight || null,
          ctime: new Date(),
          chapterDuration: chapterDuration,
          startMs: 0,
          url: filePath,
        },
      ];
    }
  } catch (error) {
    console.error(`Error extracting metadata for ${filePath}`, error);
    return [
      {
        title: filePath.split('/').pop(),
        author: 'Unknown Author',
        trackNumber: 0,
        chapterDuration: 0, // Default value for now
        url: filePath,
      },
    ];
  }
};

const saveArtworkToFile = async (
  base64Artwork: string,
  bookTitle: string,
  author: string
): Promise<{
  artworkUri: string | null;
  width: number;
  height: number;
}> => {
  // Create a unique, filesystem-friendly filename
  const safeBookTitle = bookTitle.replace(/[^a-zA-Z0-9]/g, '_');
  const safeAuthor = author.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `${safeAuthor}_${safeBookTitle}.webp`;

  const artworkDir = `${RNFS.DocumentDirectoryPath}/artwork`;
  const finalImagePath = `${artworkDir}/${filename}`;

  try {
    // Ensure the artwork directory exists
    await RNFS.mkdir(artworkDir);

    // Detect image type from base64 signature
    const isPng = base64Artwork.startsWith('iVBOR');
    const mimeType = isPng ? 'image/png' : 'image/jpeg';

    // For large images (>500KB base64), write to temp file first to avoid
    // Android Base64 memory limits in ImageResizer
    const BASE64_SIZE_THRESHOLD = 500000;
    let imageSource: string;
    let tempFilePath: string | null = null;

    if (base64Artwork.length > BASE64_SIZE_THRESHOLD) {
      const ext = isPng ? 'png' : 'jpg';
      tempFilePath = `${RNFS.CachesDirectoryPath}/temp_artwork_${Date.now()}.${ext}`;

      // Write in chunks to avoid Android Base64 memory limits
      // Each chunk must be a multiple of 4 characters for valid base64 decoding
      const CHUNK_SIZE = 16384; // 16KB chunks (multiple of 4)

      const firstChunk = base64Artwork.substring(0, CHUNK_SIZE);
      await RNFS.writeFile(tempFilePath, firstChunk, 'base64');

      for (let i = CHUNK_SIZE; i < base64Artwork.length; i += CHUNK_SIZE) {
        const chunk = base64Artwork.substring(i, i + CHUNK_SIZE);
        await RNFS.appendFile(tempFilePath, chunk, 'base64');
      }

      imageSource = `file://${tempFilePath}`;
    } else {
      // For smaller images, use data URI format
      imageSource = `data:${mimeType};base64,${base64Artwork}`;
    }

    // Resize and convert the image to WebP format
    const tempImage = await ImageResizer.createResizedImage(
      imageSource,
      800, // max width
      800, // max height
      'WEBP', // convert to WEBP
      80, // quality
      0, // rotation
      undefined, // use default cache directory for output
      false, // don't keep original
      { mode: 'contain', onlyScaleDown: true }
    );

    // Clean up temp file if we created one
    if (tempFilePath) {
      await RNFS.unlink(tempFilePath).catch(() => {});
    }

    // Move the resized image to its final destination with the correct filename
    await RNFS.moveFile(tempImage.path, finalImagePath);

    const resizedImage = { ...tempImage, uri: `file://${finalImagePath}` };

    return {
      artworkUri: resizedImage.uri,
      width: resizedImage.width,
      height: resizedImage.height,
    };
  } catch (error) {
    console.error(`Failed to save artwork for ${bookTitle}:`, error);
    return { artworkUri: null, width: 0, height: 0 };
  }
};

/**
 * Extracts and processes artwork for a single book.
 * Returns the book with processed artwork data.
 */
const extractArtworkForBook = async (book: Book): Promise<Book> => {
  try {
    const base64Artwork = book.artwork;
    let artworkWidth: number | null = book.artworkWidth || null;
    let artworkHeight: number | null = book.artworkHeight || null;
    let finalArtworkUri: string | null = null;
    let artworkColors: BookImageColors = {
      average: null,
      dominantAndroid: null,
      vibrant: null,
      darkVibrant: null,
      lightVibrant: null,
      muted: null,
      darkMuted: null,
      lightMuted: null,
    };

    if (base64Artwork) {
      // MediaInfo may return multiple images separated by " / " - take only the first one
      const imageData = base64Artwork.split(' / ')[0];

      // Clean base64 - remove all non-base64 characters
      let cleanedBase64 = imageData.replace(/[^A-Za-z0-9+/=]/g, '');

      // Check for padding characters in the middle (concatenated images) and truncate
      const paddingInMiddle = cleanedBase64.search(/=+[^=]/);
      if (paddingInMiddle !== -1) {
        const paddingLength = cleanedBase64.match(/=+/)?.[0]?.length ?? 0;
        cleanedBase64 = cleanedBase64.substring(0, paddingInMiddle + paddingLength);
      }

      // Ensure base64 length is a multiple of 4 (required for valid base64)
      const remainder = cleanedBase64.length % 4;
      if (remainder !== 0) {
        cleanedBase64 = cleanedBase64.substring(0, cleanedBase64.length - remainder);
      }

      const { artworkUri, width, height } = await saveArtworkToFile(
        cleanedBase64,
        book.bookTitle,
        book.author
      );
      finalArtworkUri = artworkUri;
      artworkWidth = width;
      artworkHeight = height;

      // Use saved file for color extraction instead of base64 to reduce memory pressure
      if (artworkUri) {
        artworkColors = await extractImageColors(artworkUri);
      }
    } else {
      //! currently hardcoded based on the unknown_track image
      artworkWidth = 500;
      artworkHeight = 500;
    }

    return {
      ...book,
      artwork: finalArtworkUri,
      artworkWidth,
      artworkHeight,
      artworkColors,
    };
  } catch (error) {
    console.error(`Error processing artwork for ${book.bookTitle}`, error);
    return {
      ...book,
      artwork: null,
      artworkWidth: null,
      artworkHeight: null,
      artworkColors: {
        average: null,
        dominant: null,
        vibrant: null,
        darkVibrant: null,
        lightVibrant: null,
        muted: null,
        darkMuted: null,
        lightMuted: null,
      },
    };
  }
};

const removeMissingFiles = async (allFiles: string[]) => {
  const allChapters = await database
    .get<ChapterModel>('chapters')
    .query()
    .fetch();
  const filesToRemove = allChapters.filter(
    (chapter) => !allFiles.includes(chapter.url)
  );

  if (filesToRemove.length > 0) {
    await database.write(async () => {
      for (const chapter of filesToRemove) {
        await chapter.destroyPermanently(); //prepareMarkAsDeleted()
      }
    });
  }

  //? Clean up orphaned books and authors
  const allBooks = await database.get<BookModel>('books').query().fetch();
  for (const book of allBooks) {
    // @ts-expect-error
    const chapterCount = await book.chapters.fetchCount(); //! fetchCount() throws ts error
    // console.log('chapterCount', chapterCount);
    if (chapterCount === 0) {
      await database.write(async () => {
        await book.destroyPermanently();
      });
    }
  }

  const allAuthors = (await database
    .get<AuthorModel>('authors')
    .query()
    .fetch()) as unknown as AuthorModel[];
  for (const author of allAuthors) {
    // @ts-expect-error
    const bookCount = await author.books.fetchCount(); //! fetchCount() throws ts error
    if (bookCount === 0) {
      await database.write(async () => {
        await author.destroyPermanently();
      });
    }
  }
};

export const scanLibrary = async () => {
  console.log('Scanning library');

  // Reset cover tracking for new scan
  booksWithCoverExtracted.clear();

  const libraryPaths = await getLibraryPaths();

  if (!libraryPaths || libraryPaths.length === 0) {
    console.log('No library paths configured. Aborting scan.');
    return;
  }

  useScanProgressStore.getState().startScan();
  let combinedAllFiles: string[] = [];

  // Scan directories - books are processed incrementally as they are discovered
  for (const path of libraryPaths) {
    const { allFiles } = await handleReadDirectory(
      RNFS.ExternalStorageDirectoryPath + '/' + path
    );
    combinedAllFiles = combinedAllFiles.concat(allFiles);
  }

  // Clean up any files that no longer exist
  await removeMissingFiles(combinedAllFiles);

  useScanProgressStore.getState().endScan();
};
