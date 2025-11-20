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
      if (!currentPaths.includes(decodedPath)) {
        const newPaths = [...currentPaths, decodedPath];
        await updateLibraryPaths(newPaths);
      }
      await scanLibrary();
    }
  } catch (err) {
    // see error handling section
    console.error(err);
  }
}
