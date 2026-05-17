import { pickDirectory } from '@react-native-documents/picker';
import { getLibraryPaths, updateLibraryPaths } from '../db/settingsQueries';
import { scanLibrary } from './scanLibrary';

export async function directoryPicker() {
  try {
    const result = await pickDirectory({
      requestLongTermAccess: true,
    });

    if (!result) return;

    const { uri } = result;

    if (result.bookmarkStatus === 'error') {
      console.warn(
        'SAF long-term access failed; tree access may not persist across reboots:',
        result.bookmarkError,
      );
    }

    const currentUris = (await getLibraryPaths()) || [];
    if (!currentUris.includes(uri)) {
      await updateLibraryPaths([...currentUris, uri]);
    }

    await scanLibrary();
  } catch (err) {
    console.error(err);
  }
}
