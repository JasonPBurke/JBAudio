import * as RNFS from '@dr.pogodin/react-native-fs';
import { updateCurrentBookArtworkUri } from '@/db/settingsQueries';

export const saveArtwork = async (
  artworkData: string | null,
  bookTitle?: string
) => {
  if (!artworkData) {
    await updateCurrentBookArtworkUri(null);
    return null;
  }

  // handle base64 data
  if (artworkData.startsWith('data:image')) {
    const pureBase64 = artworkData.replace(/^data:image\/\w+;base64,/, '');
    const sanitizedBookTitle = bookTitle
      ? bookTitle.replace(/[^\w.]/g, '_')
      : 'current_artwork';
    const path = `${RNFS.TemporaryDirectoryPath}/${sanitizedBookTitle}.jpg`;

    try {
      await RNFS.writeFile(path, pureBase64, 'base64');
      const uri = `file://${path}`;
      await updateCurrentBookArtworkUri(uri);
      return uri;
    } catch (error) {
      console.error('Error saving artwork from base64:', error);
      return null;
    }
  } else {
    // handle no artwork and use the default
    try {
      await updateCurrentBookArtworkUri(artworkData);
      return artworkData;
    } catch (error) {
      console.error('Error saving artwork URI:', error);
      return null;
    }
  }
};
