import { Author, Chapter } from '@/types/Book';
import AuthorModel from '@/db/models/Author';
import BookModel from '@/db/models/Book';
import ChapterModel from '@/db/models/Chapter';
import * as RNFS from '@dr.pogodin/react-native-fs';
import { getArtwork } from '@missingcore/react-native-metadata-retriever';
import database from '@/db';
import { Q } from '@nozbe/watermelondb';
import { Image as RNImage } from 'react-native';
import { populateDatabase } from '@/hooks/usePopulateDatabase';
import { getLibraryPaths } from '@/db/settingsQueries';
import { analyzeFileWithMediaInfo } from './mediainfo';

const handleReadDirectory = async (
  path: string,
  newFiles: any[] = [],
  allFiles: string[] = []
) => {
  try {
    const result = await RNFS.readDir(path);

    for (const item of result) {
      if (item.isDirectory()) {
        await handleReadDirectory(item.path, newFiles, allFiles);
      } else if (
        (item.isFile() && item.name.endsWith('.m4b')) ||
        item.name.endsWith('.mp3')
      ) {
        allFiles.push(item.path);
        //* query the database to see if the file already exists
        const fileExists = await checkIfFileExists(item.path);
        if (!fileExists) {
          const metadata = await extractMetadata(item.path);
          newFiles.push(...metadata);
        }
      }
    }

    return { newFiles, allFiles };
  } catch (err) {
    console.error('Error reading directory', err);
    return { newFiles, allFiles };
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
          year: metadata.releaseDate,
          description: metadata.description,
          genre: undefined, // Not available in mediainfo
          sampleRate: undefined, // Not available in mediainfo
          artworkUri: null, // Will be extracted later
          totalTrackCount: chapters.length,

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
            metadata.title || filePath.split('/').pop()?.split('.')[0],
          chapterNumber: metadata.trackPosition || 1,
          year: metadata.releaseDate,
          description: metadata.description,
          genre: undefined,
          sampleRate: undefined,
          artworkUri: null,
          totalTrackCount: 1,
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

const handleBookSort = (books: any) => {
  const sortedBookAuthors = books.sort(
    (a: { author: string }, b: { author: string }) => {
      let nameA =
        a.author === null || a.author === undefined ? '' : a.author;
      let nameB =
        b.author === null || b.author === undefined ? '' : b.author;
      nameA.localeCompare(nameB);
    }
  );

  const sortedBookTitles = sortedBookAuthors.reduce(
    (acc: Author[], book: any) => {
      let authorEntry = acc.find((entry) => entry.name === book.author);

      if (!authorEntry) {
        authorEntry = { name: book.author, books: [] };
        acc.push(authorEntry);
      }

      let bookEntry = authorEntry.books.find(
        (entry: any) => entry.bookTitle === book.bookTitle
      );

      if (!bookEntry) {
        bookEntry = {
          bookId: book.url, // Assign the URL of the first chapter as bookId
          author: book.author,
          bookTitle: book.bookTitle,
          chapters: [],
          bookDuration: 0, // Initialize bookDuration
          artwork: null,
          artworkHeight: null,
          artworkWidth: null,
          bookProgress: {
            currentChapterIndex: 0,
            currentChapterProgress: 0,
          },
          metadata: {
            year: book.year,
            description: book.description,
            narrator: book.narrator,
            genre: book.genre,
            sampleRate: book.sampleRate,
            totalTrackCount: book.totalTrackCount,
            ctime: book.ctime,
            mtime: book.mtime || null,
          },
        };
        authorEntry.books.push(bookEntry);
      }

      if (bookEntry) {
        const chapter: Chapter = {
          author: book.author,
          bookTitle: book.bookTitle,
          chapterTitle: book.chapterTitle,
          chapterNumber: book.chapterNumber,
          chapterDuration: book.chapterDuration,
          startMs: book.startMs,
          url: book.url,
        };

        bookEntry.chapters.push(chapter);
        // Add chapter duration to book duration
        bookEntry.bookDuration += chapter.chapterDuration;

        if (bookEntry.chapters.length > 1) {
          bookEntry.chapters.sort(
            (a: { chapterNumber: number }, b: { chapterNumber: number }) =>
              a.chapterNumber - b.chapterNumber
          );
        }
      }

      return acc;
    },
    []
  );
  return sortedBookTitles;
};

const extractArtwork = async (sortedBooks: any[]) => {
  const booksWithArtwork = await Promise.all(
    sortedBooks.map(async (authorEntry) => {
      const updatedBooks = await Promise.all(
        authorEntry.books.map(async (book: any) => {
          if (book.chapters && book.chapters.length > 0) {
            const firstChapter = book.chapters[0];
            try {
              const artwork = await getArtwork(firstChapter.url);
              let artworkWidth: number | null = null;
              let artworkHeight: number | null = null;

              if (artwork) {
                await new Promise<void>((resolve) => {
                  RNImage.getSize(
                    artwork,
                    (w, h) => {
                      artworkWidth = w;
                      artworkHeight = h;
                      resolve();
                    },
                    (error) => {
                      console.error(
                        `Error getting image size for ${artwork}`,
                        error
                      );
                      resolve();
                    }
                  );
                });
              } else {
                //! currently hardcoded based on the unknown_track image
                artworkWidth = 500;
                artworkHeight = 500;
              }
              return {
                ...book,
                artwork: artwork,
                artworkWidth,
                artworkHeight,
              };
            } catch (error) {
              console.error(
                `Error extracting artwork for ${firstChapter.url}`,
                error
              );
              return {
                ...book,
                artwork: null,
                artworkWidth: null,
                artworkHeight: null,
              };
            }
          }
          return { ...book, artwork: null };
        })
      );
      return { ...authorEntry, books: updatedBooks };
    })
  );
  return booksWithArtwork;
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
  const libraryPaths = await getLibraryPaths();

  if (!libraryPaths || libraryPaths.length === 0) {
    console.log('No library paths configured. Aborting scan.');
    return;
  }

  let combinedNewFiles: any[] = [];
  let combinedAllFiles: string[] = [];

  for (const path of libraryPaths) {
    const { newFiles, allFiles } = await handleReadDirectory(
      RNFS.ExternalStorageDirectoryPath + '/' + path
    );
    combinedNewFiles = combinedNewFiles.concat(newFiles);
    combinedAllFiles = combinedAllFiles.concat(allFiles);
  }

  await removeMissingFiles(combinedAllFiles);
  const sortedLibrary = handleBookSort(combinedNewFiles);
  const sortedLibraryWithArtwork = await extractArtwork(sortedLibrary);
  await populateDatabase(sortedLibraryWithArtwork);
};
