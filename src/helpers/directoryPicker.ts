import { pickDirectory } from '@react-native-documents/picker';
import { getLibraryPaths, updateLibraryPaths } from '../db/settingsQueries';
import { scanLibrary } from './scanLibrary';

export async function directoryPicker() {
  try {
    const result = await pickDirectory({
      requestLongTermAccess: true,
    });

    if (result) {
      const { uri } = result;
      const pathAfterDelimiter = uri.split('%3A')[1];

      const decodedPath = decodeURIComponent(pathAfterDelimiter);
      const currentPaths = (await getLibraryPaths()) || [];
      const isSubpath = currentPaths.some((path) =>
        decodedPath.startsWith(path + '/')
      );
      console.log('isSubpath', isSubpath);

      if (!currentPaths.includes(decodedPath) && !isSubpath) {
        // Filter out any existing paths that are subpaths of the new path
        const updatedPaths = currentPaths.filter(
          (path) => !path.startsWith(decodedPath + '/')
        );

        const newPaths = [...updatedPaths, decodedPath];
        await updateLibraryPaths(newPaths);
        console.log('newPaths', newPaths);
      }
      await scanLibrary();
    }
  } catch (err) {
    // see error handling section
    console.error(err);
  }
}
