import ImageResizer from '@bam.tech/react-native-image-resizer';
import * as RNFS from '@dr.pogodin/react-native-fs';
import { Image } from 'expo-image';

import { updateBookArtwork } from '@/db/bookQueries';

import { extractImageColors } from './imageColorExtractor';
import { sanitizeForFilename } from './scanLibrary';

/**
 * Downloads an image from a URL, resizes it, saves it as the book's artwork,
 * extracts color palette, and updates the database.
 */
export async function replaceBookArtwork(
  bookId: string,
  imageUrl: string,
  bookTitle: string,
  author: string,
): Promise<void> {
  const artworkDir = `${RNFS.DocumentDirectoryPath}/artwork`;
  const safeAuthor = sanitizeForFilename(author);
  const safeTitle = sanitizeForFilename(bookTitle);
  const filename = `${safeAuthor}_${safeTitle}.webp`;
  const finalPath = `${artworkDir}/${filename}`;
  const tempPath = `${RNFS.CachesDirectoryPath}/cover_download_${Date.now()}.tmp`;

  try {
    const downloadResult = await RNFS.downloadFile({
      fromUrl: imageUrl,
      toFile: tempPath,
    }).promise;

    if (downloadResult.statusCode !== 200) {
      throw new Error(
        `Download failed with status ${downloadResult.statusCode}`,
      );
    }

    const resized = await ImageResizer.createResizedImage(
      `file://${tempPath}`,
      800,
      800,
      'WEBP',
      80,
      0,
      undefined,
      false,
      { mode: 'contain', onlyScaleDown: true },
    );

    await RNFS.mkdir(artworkDir);
    await RNFS.unlink(finalPath).catch(() => {});
    await RNFS.moveFile(resized.path, finalPath);

    const artworkUri = `file://${finalPath}`;
    const colors = await extractImageColors(artworkUri);

    // Clear expo-image cache so the new artwork is picked up without a cache-buster query param
    await Image.clearDiskCache();
    await Image.clearMemoryCache();

    await updateBookArtwork(
      bookId,
      artworkUri,
      resized.width,
      resized.height,
      colors,
    );
  } finally {
    await RNFS.unlink(tempPath).catch(() => {});
  }
}
