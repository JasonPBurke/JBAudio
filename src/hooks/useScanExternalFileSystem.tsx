import * as RNFS from '@dr.pogodin/react-native-fs';
import {
  getMetadata,
  getArtwork,
  MetadataPresets,
} from '@missingcore/react-native-metadata-retriever';
import { useEffect, useState } from 'react';
// import path from 'path';
import libraryTestData from '@/assets/data/libraryTestData.json';
// import { Track } from 'react-native-track-player';

//* if we implement the user being able to choose their own folder, we remove the
//*  '/Audiobooks' from the path and replace it with the user's chosen folder as passed in
//* to useScanExternalFileSystem

export const useScanExternalFileSystem = () => {
  const path = `${RNFS.ExternalStorageDirectoryPath}/Audiobooks/testing`;
  const [library, setLibrary]: any = useState([]);

  useEffect(() => {
    const extractArtwork = async (filePath: string) => {
      // console.log('extractArtwork', JSON.stringify(filePath, null, 2));
      // try {
      //   const decodedPath = decodeURIComponent(filePath);
      //   const metadata = await getArtwork(decodedPath);
      //   return metadata;
      // } catch (error) {
      //   console.error(`Error extracting metadata for ${filePath}`, error);
      //   return null;
      // }
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
          // artwork: metadata.artworkData || null,
        };
      } catch (error) {
        console.error(`Error extracting metadata for ${filePath}`, error);
        return {
          title: filePath.split('/').pop(),
          author: 'Unknown Author',
          trackNumber: 0,
          // artwork: null,
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
            // Decode the path before passing it to extractMetadata
            const decodedPath = decodeURIComponent(item.path);
            const metadata = await extractMetadata(decodedPath);
            // const coverArt = await extractMetadata(item.path);
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

      //TODO: sort by albumTitle and group all files with the same albumTitle into an album
      const sortedBookTitles = sortedBookAuthors.reduce(
        (acc: any, book: any) => {
          const author = book.author;
          //* if author does not exist
          if (!acc[author]) {
            //* add the author as a key empty object
            acc[author] = {};
            // console.log('current acc: ', JSON.stringify(acc, null, 2));
          }
          //* if bookTitle does not exist
          if (!(book.bookTitle in acc[author])) {
            //* add the bookTitle to the object as key
            acc[author][book.bookTitle] = {};
            acc[author][book.bookTitle]['chapters'] = [];
            // console.log('current acc: ', JSON.stringify(acc, null, 2));
          }
          //* add the chapter to the bookTitle array
          acc[author][book.bookTitle]['chapters'].push(book);
          acc[author][book.bookTitle]['chapters'].sort(
            //* sort chapters by chapterNumber
            (a: { chapterNumber: number }, b: { chapterNumber: number }) =>
              a.chapterNumber - b.chapterNumber
          );
          return acc;
        },
        // {}
        [{ authors: [{ books: [{ artwork: [], chapters: [] }] }] }]
      );
      // console.log(
      //   'sorted books',
      //   JSON.stringify(sortedBookTitles, null, 2)
      // );
      return sortedBookTitles;
      // return books;
    };
    // handleBookSort(libraryTestData);

    const scanDirectory = async () => {
      await handleReadDirectory(path).then((result) => {
        const testSort = handleBookSort(result);
        const sortedLibraryWithArtwork = extractArtwork(testSort);

        console.log('resulting library', JSON.stringify(testSort, null, 2));

        //! GET THE COVER ARTWORK DATA FOR EACH BOOK ONLY ONCE
        setLibrary(result);
      });
    };

    scanDirectory();
  }, [path]);

  return library;
};
