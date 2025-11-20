import { Author, Chapter } from '@/types/Book';
import AuthorModel from '@/db/models/Author';
import BookModel from '@/db/models/Book';
import ChapterModel from '@/db/models/Chapter';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {
  getMetadata,
  getArtwork,
  MediaMetadataPublicFields,
} from '@missingcore/react-native-metadata-retriever';
import TrackPlayer from 'react-native-track-player';
import database from '@/db';
import { Q } from '@nozbe/watermelondb';
import { Image as RNImage } from 'react-native';
import { populateDatabase } from '@/hooks/usePopulateDatabase';

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
          newFiles.push({
            ...metadata,
            url: item.path,
          });
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

const extractMetadata = async (filePath: string) => {
  // const decodedPath = decodeURIComponent(filePath);
  try {
    const {
      year,
      trackNumber,
      totalTrackCount,
      artist,
      albumArtist,
      writer,
      albumTitle,
      title,
      displayTitle,
      composer, // Read by
      // artworkData,
      artworkUri,
      description,
      genre,
      sampleRate,
    } = await getMetadata(
      filePath,
      MediaMetadataPublicFields
      // MetadataPresets.standard
    );

    const chapterDuration = await getTrackDuration(filePath);
    // console.log('chapterDuration', chapterDuration);

    const bookTitleBackup = filePath
      .substring(0, filePath.lastIndexOf('/'))
      .split('/')
      .pop();

    return {
      //? bookTitle: metadata.albumTitle  chapterTitle: metadata.title
      author: artist || albumArtist || writer || 'Unknown Author',
      narrator: composer || 'Unknown Voice Artist',
      bookTitle: albumTitle || displayTitle || bookTitleBackup,
      chapterTitle:
        title ||
        displayTitle ||
        albumTitle ||
        filePath.split('/').pop()?.split('.')[0],
      chapterNumber: trackNumber || 0,
      year: year,
      description: description,
      genre: genre,
      sampleRate: sampleRate,
      artworkUri: artworkUri,
      totalTrackCount: totalTrackCount,
      ctime: new Date(),
      chapterDuration: chapterDuration,
    };
  } catch (error) {
    console.error(`Error extracting metadata for ${filePath}`, error);
    return {
      title: filePath.split('/').pop(),
      author: 'Unknown Author',
      trackNumber: 0,
      chapterDuration: 0, // Default value for now
    };
  }
};

const getTrackDuration = async (filePath: string): Promise<number> => {
  try {
    await TrackPlayer.load({ url: filePath });
    let duration = 0;
    const startTime = Date.now();
    const timeout = 500; // 500ms timeout

    while (Date.now() - startTime < timeout) {
      const progress = await TrackPlayer.getProgress();
      if (progress.duration > 0) {
        duration = progress.duration;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50)); // Wait 50ms before re-checking
    }

    await TrackPlayer.reset(); // Clean up
    return duration;
  } catch (error) {
    console.error(`Error getting duration for ${filePath}`, error);
    return 0;
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
  const path = `${RNFS.ExternalStorageDirectoryPath}/Audiobooks/testing`;
  const singleBookPath = `${RNFS.ExternalStorageDirectoryPath}/Audiobooks/testing/The Fall of Hyperion`;
  const { newFiles, allFiles } = await handleReadDirectory(singleBookPath);
  await removeMissingFiles(allFiles);
  const sortedLibrary = handleBookSort(newFiles);
  const sortedLibraryWithArtwork = await extractArtwork(sortedLibrary);
  await populateDatabase(sortedLibraryWithArtwork);
};
