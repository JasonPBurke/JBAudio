//TODO this is where we are going to build the library from the user's files
//TODO it will be a list of objects with the following properties: title, author, audio_url, thumbnail_url
//TODO will use the code below as a guide

//! loop through the Audiobooks folder and check for files with .m4b/.mp3 extension
//! if a folder is found, go inside and loop through checking for audio files
//! when done, return to parent folder and continue to next folder to repeat process

//* import this where you are using the library.json file: (library) > index.tsx
// import { BookListProps } from '@/components/BooksList';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {
  getMetadata,
  getArtwork,
  MetadataPresets,
  MediaMetadata,
} from '@missingcore/react-native-metadata-retriever';
import { useEffect, useState } from 'react';
// import { Track } from 'react-native-track-player';

//* if we implement the user being able to choose their own folder, we remove the
//*  '/Audiobooks' from the path and replace it with the user's chosen folder as passed in
//* to useScanExternalFileSystem

export const useScanExternalFileSystem = () => {
  const path = `${RNFS.ExternalStorageDirectoryPath}/Audiobooks`;
  const [library, setLibrary]: any = useState([]);

  useEffect(() => {
    // const extractMetadata = async (filePath: string) => {
    //   try {
    //     // console.log('Extracting metadata for:', filePath);
    //     // Ensure the file path is decoded before extracting metadata
    //     // const decodedPath = decodeURIComponent(filePath);
    //     // // console.log('Using decoded path:', decodedPath);
    //     const metadata = await getMetadata(
    //       filePath,
    //       // MetadataPresets.standardArtwork
    //       MetadataPresets.standard
    //     );
    //     // const artwork = await getArtwork(filePath); // Use getArtwork to retrieve artwork URI

    //     return {
    //       title: metadata.title || filePath.split('/').pop(),
    //       author:
    //         metadata.artist || metadata.albumArtist || 'Unknown Author',
    //       trackNumber: metadata.trackNumber || 0,
    //       // artwork: metadata.artworkData || null, // Include artworkUri in the returned object
    //     };
    //   } catch (error) {
    //     console.error(`Error extracting metadata for ${filePath}`, error);
    //     return {
    //       title: filePath.split('/').pop(),
    //       author: 'Unknown Author',
    //       trackNumber: 0,
    //       // artwork: null,
    //     };
    //   }
    // };

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
            // const decodedPath = decodeURIComponent(item.path);
            // const metadata = await extractMetadata(item.path);
            // const coverArt = await extractMetadata(item.path);
            files.push({
              // ...metadata,
              title: item.name,
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

    const scanDirectory = async () => {
      const files = await handleReadDirectory(path);
      setLibrary(files);
      console.log('library', JSON.stringify(library, null, 2));
    };

    scanDirectory();
  }, [path]);

  return library;
};
