import * as RNFS from '@dr.pogodin/react-native-fs';
import {
  getMetadata,
  getArtwork,
  MetadataPresets,
} from '@missingcore/react-native-metadata-retriever';
import { useEffect, useState } from 'react';
// import { Track } from 'react-native-track-player';

//* if we implement the user being able to choose their own folder, we remove the
//*  '/Audiobooks' from the path and replace it with the user's chosen folder as passed in
//* to useScanExternalFileSystem

export const useScanExternalFileSystem = () => {
  const path = `${RNFS.ExternalStorageDirectoryPath}/Audiobooks/testing`;
  const [library, setLibrary]: any = useState([]);

  useEffect(() => {
    const extractArtwork = async (sortedBooks: any[]) => {
      const booksWithArtwork = await Promise.all(
        sortedBooks.map(async (authorEntry) => {
          const updatedBooks = await Promise.all(
            authorEntry.books.map(async (book: any) => {
              if (book.chapters && book.chapters.length > 0) {
                const firstChapter = book.chapters[0];
                try {
                  const decodedPath = decodeURIComponent(firstChapter.url);
                  const artwork = await getArtwork(decodedPath);
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
        const decodedPath = decodeURIComponent(filePath);
        const metadata = await getMetadata(
          decodedPath,
          // MetadataPresets.standardArtwork
          MetadataPresets.standard
        );

        // console.log(
        //   'metadata',
        //   JSON.stringify(
        //     {
        //       title: metadata.title,
        //       albumTitle: metadata.albumTitle,
        //       artist: metadata.artist,
        //       albumArtist: metadata.albumArtist,
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
          //! bookTitle: metadata.albumTitle  chapterTitle: metadata.title
          chapterTitle:
            metadata.title ||
            metadata.albumTitle ||
            filePath.split('/').pop()?.split('.')[0],
          bookTitle: metadata.albumTitle || bookTitleBackup,
          author:
            metadata.artist || metadata.albumArtist || 'Unknown Author',
          chapterNumber: metadata.trackNumber || 0,
          year: metadata.year,
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
            const decodedPath = decodeURIComponent(item.path);
            const metadata = await extractMetadata(decodedPath);
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
        (acc: any[], book: any) => {
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

          if (!bookEntry) {
            bookEntry = {
              bookTitle: book.bookTitle,
              chapters: [],
              artwork: null,
            };
            authorEntry.books.push(bookEntry);
          }

          bookEntry.chapters.push(book);
          bookEntry.chapters.sort(
            (a: { chapterNumber: number }, b: { chapterNumber: number }) =>
              a.chapterNumber - b.chapterNumber
          );

          return acc;
        },
        []
      );
      // console.log(
      //   'sorted books',
      //   JSON.stringify(sortedBookTitles, null, 2)
      // );
      return sortedBookTitles;
    };

    const scanDirectory = async () => {
      const result = await handleReadDirectory(path);
      const testSort = handleBookSort(result);
      console.log('testSort', JSON.stringify(testSort, null, 2));
      //! to get the cover art for each book -->> author.bookTitle.chapters[0].url <<--
      const sortedLibraryWithArtwork = await extractArtwork(testSort);

      //! GET THE COVER ARTWORK DATA FOR EACH BOOK ONLY ONCE
      setLibrary(sortedLibraryWithArtwork);
    };

    scanDirectory();
  }, [path]);

  return library;
};
