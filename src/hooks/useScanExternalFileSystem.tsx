//TODO this is where we are going to build the library from the user's files
//TODO it will be a list of objects with the following properties: title, author, audio_url, thumbnail_url
//TODO will use the code below as a guide

//! loop through the Audiobooks folder and check for files with .m4b/.mp3 extension
//! if a folder is found, go inside and loop through checking for audio files
//! when done, return to parent folder and continue to next folder to repeat process

//* import this where you are using the library.json file: (library) > index.tsx
import { BookListProps } from '@/components/BooksList';
import * as RNFS from '@dr.pogodin/react-native-fs';
import { useEffect, useState } from 'react';
import { Track } from 'react-native-track-player';

//* if we implement the user being able to choose their own folder, we remove the
//*  '/Audiobooks' from the path and replace it with the user's chosen folder as passed in
//* to useScanExternalFileSystem

export const useScanExternalFileSystem = () => {
  const path = `${RNFS.ExternalStorageDirectoryPath}/Audiobooks`;
  const [library, setLibrary]: any = useState([]);

  useEffect(() => {
    const handleReadDirectory = async (path: string) => {
      try {
        const result = await RNFS.readDir(path);
        for (const item of result) {
          if (item.isDirectory()) {
            await handleReadDirectory(item.path);
          } else if (
            (item.isFile() && item.name.endsWith('.m4b')) ||
            item.name.endsWith('.mp3')
          ) {
            setLibrary((prevLibrary: any) => [
              ...prevLibrary,
              {
                title: item.name,
                url: item.path,
              },
            ]);
          }
        }
      } catch (err) {
        console.error('Error reading directory', err);
      }
    };

    handleReadDirectory(path);
  }, [path]);

  return library;
};

// const fileName = 'Audiobooks/Mort.m4b';
// const localBook = `${RNFS.ExternalStorageDirectoryPath}/${fileName}`;
// console.log('localBook', localBook);

// const mort: any = [
//   {
//     url: localBook,
//     title: 'Mort',
//     author: 'Terry Pratchett',
//     artwork: 'https://m.media-amazon.com/images/I/519CzoTby1L._SL1000_.jpg',
//   },
// ];

// const fileName = 'Audiobooks/';

// RNFS.readDir(`RNFS.ExternalStorageDirectoryPath/${fileName}`)
//   .then((result) => {
//     console.log('GOT RESULT', JSON.stringify(result, null, 2));

//     // stat the first file
//     return Promise.all([RNFS.stat(result[0].path), result[0].path]);
//   })
//   .then((statResult) => {
//     if (statResult[0].isFile()) {
//       // if we have a file, read it
//       console.log('true');
//       return RNFS.readFile(statResult[1], 'utf8');
//     }

//     return 'no file';
//   })
//   .then((contents) => {
//     // log the file contents
//     console.log('contents', contents);
//   })
//   .catch((err) => {
//     console.log(err.message, err.code);
//   });
