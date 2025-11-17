import * as RNFS from '@dr.pogodin/react-native-fs';
import { updateCurrentBookArtworkUri } from '@/db/settingsQueries';

export const saveArtwork = async (
  base64Data: string | null,
  bookTitle: string
) => {
  if (!base64Data) {
    await updateCurrentBookArtworkUri(null);
    return null;
  }

  // Strip the data URI prefix if it exists
  const pureBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');

  const path = `${RNFS.TemporaryDirectoryPath}/${bookTitle}.jpg`;

  try {
    await RNFS.writeFile(path, pureBase64, 'base64');
    const uri = `file://${path}`;
    await updateCurrentBookArtworkUri(uri);
    return uri;
  } catch (error) {
    console.error('Error saving artwork:', error);
    return null;
  }
};
