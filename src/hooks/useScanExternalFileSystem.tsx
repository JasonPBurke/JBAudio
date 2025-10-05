import { Author, Book, Chapter } from '@/types/Book';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {
  getMetadata,
  getArtwork,
  // MetadataPresets,
  MediaMetadataPublicFields,
} from '@missingcore/react-native-metadata-retriever';
import { useEffect } from 'react';
import { useLibraryStore } from '@/store/library';
// import MediaInfoFactory from 'mediainfo.js';
// import RNFetchBlob from 'react-native-blob-util';

//* if we implement the user being able to choose their own folder, we remove the
//*  '/Audiobooks' from the path and replace it with the user's chosen folder

export const useScanExternalFileSystem = () => {
  const path = `${RNFS.ExternalStorageDirectoryPath}/Audiobooks/testing`;
  // const singlePath = `${RNFS.ExternalStorageDirectoryPath}/Audiobooks/testing/2010 - Kraken/Kraken-Part01.mp3`;
  const { setAuthors } = useLibraryStore();

  useEffect(() => {
    const extractArtwork = async (sortedBooks: any[]) => {
      const booksWithArtwork = await Promise.all(
        sortedBooks.map(async (authorEntry) => {
          const updatedBooks = await Promise.all(
            authorEntry.books.map(async (book: any) => {
              if (book.chapters && book.chapters.length > 0) {
                const firstChapter = book.chapters[0];
                try {
                  const artwork = await getArtwork(firstChapter.url);
                  return { ...book, artwork: artwork };
                } catch (error) {
                  console.error(
                    `Error extracting artwork for ${firstChapter.url}`,
                    error
                  );
                  return { ...book, artwork: null };
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
    const extractMetadata = async (filePath: string) => {
      try {
        // const decodedPath = decodeURIComponent(filePath);
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

        // console.log(
        //   'metadata',
        //   JSON.stringify(
        //     {
        //       year,
        //       trackNumber,
        //       totalTrackCount,
        //       artist,
        //       albumArtist,
        //       writer,
        //       albumTitle,
        //       title,
        //       displayTitle,
        //       composer,
        //       artworkUri,
        //       description,
        //       genre,
        //       sampleRate,
        //     },
        //     null,
        //     2
        //   )
        // );

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
        };
      } catch (error) {
        console.error(`Error extracting metadata for ${filePath}`, error);
        return {
          title: filePath.split('/').pop(),
          author: 'Unknown Author',
          trackNumber: 0,
        };
      }
    };

    const handleReadDirectory = async (path: string, files: any[] = []) => {
      try {
        const result = await RNFS.readDir(path);

        for (const item of result) {
          if (item.isDirectory()) {
            await handleReadDirectory(item.path, files);
          } else if (
            (item.isFile() && item.name.endsWith('.m4b')) ||
            item.name.endsWith('.mp3')
          ) {
            const metadata = await extractMetadata(item.path);
            files.push({
              ...metadata,
              url: item.path,
            });
          }
        }

        return files;
      } catch (err) {
        console.error('Error reading directory', err);
        return files;
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
          let authorEntry = acc.find(
            (entry) => entry.authorName === book.author
          );

          if (!authorEntry) {
            authorEntry = { authorName: book.author, books: [] };
            acc.push(authorEntry);
          }

          let bookEntry = authorEntry.books.find(
            (entry: any) => entry.bookTitle === book.bookTitle
          );

          // console.log('narrator', book.composer);

          if (!bookEntry) {
            bookEntry = {
              author: book.author,
              bookTitle: book.bookTitle,
              chapters: [],
              artwork: null,
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
              },
            };
            authorEntry.books.push(bookEntry);
          }

          const chapter: Chapter = {
            author: book.author,
            bookTitle: book.bookTitle,
            chapterTitle: book.chapterTitle,
            chapterNumber: book.chapterNumber,
            url: book.url,
          };

          bookEntry.chapters.push(chapter);
          if (bookEntry.chapters.length > 1) {
            bookEntry.chapters.sort(
              (
                a: { chapterNumber: number },
                b: { chapterNumber: number }
              ) => a.chapterNumber - b.chapterNumber
            );
          }

          return acc;
        },
        []
      );
      return sortedBookTitles;
    };

    const scanDirectory = async (path: string) => {
      const result = await handleReadDirectory(path);
      const sortedLibrary = handleBookSort(result);
      const sortedLibraryWithArtwork = await extractArtwork(sortedLibrary);
      setAuthors(sortedLibraryWithArtwork);
    };
    scanDirectory(path);
  }, [path, setAuthors]);

  // return library;
};
