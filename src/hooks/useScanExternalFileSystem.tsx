//TODO this is where we are going to build the library from the user's files
//TODO it will be a list of objects with the following properties: title, author, audio_url, thumbnail_url
//TODO will use the code below as a guide

//! loop through the Audiobooks folder and check for files with .m4b/.mp3 extension
//! if a folder is found, go inside and loop through checking for audio files
//! when done, return to parent folder and continue to next folder to repeat process

//* import this where you are using the library.json file: (library) > index.tsx

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
