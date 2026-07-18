import ImageResizer from '@bam.tech/react-native-image-resizer';
import * as RNFS from '@dr.pogodin/react-native-fs';

import { updateBookArtwork } from '@/db/bookQueries';

import { artworkFilename } from './artworkIdentity';
import { extractImageColors } from './imageColorExtractor';

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
  // Keyed by DB record id so two books sharing author+title (e.g. different
  // narrators) never overwrite each other's cover.
  const filename = artworkFilename(author, bookTitle, bookId);
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

    const artworkUri = `file://${finalPath}?t=${Date.now()}`;
    const colors = await extractImageColors(artworkUri);

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
