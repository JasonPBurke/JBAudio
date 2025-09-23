// import { BookListProps } from '@/components/BooksList';
import * as RNFS from '@dr.pogodin/react-native-fs';
// import { parseFile } from 'music-metadata';
// import { inspect } from 'node:util';
import {
  getMetadata,
  MetadataPresets,
} from '@missingcore/react-native-metadata-retriever';
import { useEffect, useState } from 'react';
// import { Track } from 'react-native-track-player';

//* if we implement the user being able to choose their own folder, we remove the
//*  '/Audiobooks' from the path and replace it with the user's chosen folder as passed in
//* to useScanExternalFileSystem

export const useScanExternalFileSystem = () => {
  const path = `${RNFS.ExternalStorageDirectoryPath}/Audiobooks/Jonathan Stroud`;
  const [library, setLibrary]: any = useState([]);

  useEffect(() => {
    const extractMetadata = async (filePath: string) => {
      try {
        // console.log('Extracting metadata for:', filePath);
        // Ensure the file path is decoded before extracting metadata
        const decodedPath = decodeURIComponent(filePath);
        // // console.log('Using decoded path:', decodedPath);
        const metadata = await getMetadata(
          decodedPath,
          MetadataPresets.standardArtwork
          // MetadataPresets.standard
        );
        // const artwork = await getArtwork(filePath); // Use getArtwork to retrieve artwork URI

        // console.log('Metadata:', {
        //   albumArtist: metadata.albumArtist,
        //   artist: metadata.artist,
        //   albumTitle: metadata.albumTitle,
        //   title: metadata.title,
        //   trackNumber: metadata.trackNumber,
        //   year: metadata.year,
        // });

        return {
          //! bookTitle: metadata.albumTitle  chapterTitle: metadata.title
          title:
            metadata.title ||
            metadata.albumTitle ||
            filePath.split('/').pop(),
          author:
            metadata.artist || metadata.albumArtist || 'Unknown Author',
          trackNumber: metadata.trackNumber || 0,
          artwork: metadata.artworkData || null,
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
              // title: item.name,
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

    const handleFileSort = (files: any) => {
      const sortedFiles = files
        .sort((a: any, b: any) => {
          a.author.localCompare(b.author);
        })
        .reduce((acc: any, file: any) => {
          const author = file.author;
          if (!acc[author]) {
            acc[author] = [];
          }
          acc[author].push(file);
          return acc;
        });
      return sortedFiles;
    };

    const scanDirectory = async () => {
      //! remove const files = if using .then
      const files = await handleReadDirectory(path).then((result) => {
        // console.log('result', result);
        // const sortedFiles = handleFileSort(result);
        // console.log(
        //   'sorted books',
        //   sortedFiles
        //   // sortedFiles.title,
        //   // sortedFiles.author,
        //   // sortedFiles.trackNumber
        // );
        setLibrary(result); //! send in sortedFiles
      });
    };

    scanDirectory();
  }, [path]);

  // console.log('library---', JSON.stringify(library, null, 2));
  return library;
};
