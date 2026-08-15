import { pickDirectory } from '@react-native-documents/picker';
import {
  getLibraryFolderEntries,
  updateLibraryFolderEntries,
} from '../db/settingsQueries';
import { scanLibrary } from './scanLibrary';

export async function directoryPicker() {
  try {
    const result = await pickDirectory({
      requestLongTermAccess: true,
    });

    if (!result) return;

    const { uri } = result;
    const pathAfterDelimiter = uri.split('%3A')[1];
    if (!pathAfterDelimiter) return;
    const decodedPath = decodeURIComponent(pathAfterDelimiter);

    const currentEntries = await getLibraryFolderEntries();
    const isSubpath = currentEntries.some((entry) =>
      decodedPath.startsWith(entry.path + '/'),
    );
    const alreadyExists = currentEntries.some(
      (entry) => entry.path === decodedPath,
    );

    if (!alreadyExists && !isSubpath) {
      // Drop any existing entries that are subpaths of the new path
      const filtered = currentEntries.filter(
        (entry) => !entry.path.startsWith(decodedPath + '/'),
      );
      const next = [...filtered, { path: decodedPath, treeUri: uri }];
      await updateLibraryFolderEntries(next);
    }

    // `afterCurrent`, not a plain call: a scan already running enumerated its
    // library folders before this one was added, so joining it would leave the
    // new folder's books missing until some later scan — for a user action that
    // was explicit. This waits for that scan and then runs one that can see it.
    await scanLibrary.afterCurrent();
  } catch (err) {
    console.error(err);
  }
}
