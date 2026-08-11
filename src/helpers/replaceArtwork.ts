/**
 * Downloading a chosen image and installing it as artwork — spec §D6, §K6, §K8.
 *
 * ── Why this module is no longer book-shaped (§D6) ────────────────────────
 *
 * Series artwork is the second thing in the app that can own a cover, and §D6
 * ruled that **the book artwork replacement helper generalises to serve books
 * and series** rather than being copied. What is genuinely shared is the whole
 * file pipeline — download, resize, install at a stable path, cache-bust — and
 * what differs is exactly two things: the destination FILENAME and what gets
 * WRITTEN once the bytes are on disk. So those two are the parameters, and
 * `replaceBookArtwork` / `replaceSeriesArtwork` are the two call shapes over
 * one implementation.
 *
 * Note what moved OUT of the shared core: palette extraction. A book stores
 * seven cover colours; a series stores one nullable URI and nothing else. Left
 * in the core, every series pin would pay for a native image decode whose
 * result has nowhere to go.
 *
 * ── ⚠ K6: THE OLD FILE IS UNLINKED BEFORE THE DB WRITE ────────────────────
 *
 * `unlink(finalPath)` runs before `moveFile`, which runs before the caller's
 * `save`. That ordering is forced — the replacement takes the old file's exact
 * path, so installing the new bytes destroys the old ones — and it has one
 * consequence the callers must respect: **this cannot be deferred into a form's
 * transaction.** By the time a `Save` button could commit it, the previous
 * cover no longer exists and `Cancel` has nothing to restore. Immediate-write
 * is kept, and the confirmation is asked BEFORE this runs, not as a notice
 * afterwards. See `coverArtSearch.tsx`.
 */
import ImageResizer from '@bam.tech/react-native-image-resizer';
import * as RNFS from '@dr.pogodin/react-native-fs';

import { updateBookArtwork } from '@/db/bookQueries';
import { setSeriesArtwork } from '@/db/seriesQueries';

import { artworkDirectory } from './artworkFiles';
import { artworkFilename, seriesArtworkFilename } from './artworkIdentity';
import { extractImageColors } from './imageColorExtractor';

/** What one installed cover is, once the bytes are on disk. */
export type InstalledArtwork = {
  /** `file://…?t=…` — carry this into the DB, cache-buster included. */
  uri: string;
  width: number;
  height: number;
};

/**
 * Download `imageUrl`, resize it, install it at `filename` inside the artwork
 * directory, then hand the result to `save` to persist.
 *
 * `save` is called LAST and only on success, so a failed download leaves both
 * the filesystem and the database exactly as they were — except for the old
 * file, which K6 has already destroyed. That asymmetry is why the caller
 * confirms first.
 */
export async function replaceArtwork(
  imageUrl: string,
  filename: string,
  save: (installed: InstalledArtwork) => Promise<void>,
): Promise<void> {
  const artworkDir = artworkDirectory();
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
    // ⚠ K6 — this is the point of no return. See the module header.
    await RNFS.unlink(finalPath).catch(() => {});
    await RNFS.moveFile(resized.path, finalPath);

    await save({
      uri: `file://${finalPath}?t=${Date.now()}`,
      width: resized.width,
      height: resized.height,
    });
  } finally {
    await RNFS.unlink(tempPath).catch(() => {});
  }
}

/**
 * Replace a book's cover with the image at `imageUrl`.
 *
 * Keyed by DB record id so two books sharing author+title (e.g. different
 * narrators) never overwrite each other's cover.
 */
export async function replaceBookArtwork(
  bookId: string,
  imageUrl: string,
  bookTitle: string,
  author: string,
): Promise<void> {
  await replaceArtwork(
    imageUrl,
    artworkFilename(author, bookTitle, bookId),
    async ({ uri, width, height }) => {
      const colors = await extractImageColors(uri);
      await updateBookArtwork(bookId, uri, width, height, colors);
    },
  );
}

/**
 * Pin a cover onto a series — §D6.
 *
 * No palette extraction and no dimensions: `series.artwork` is a single
 * nullable column, so the URI is the entire record. The detail sheet's hero
 * draws a pinned cover square (§C8's `PINNED_ARTWORK_ASPECT`) precisely
 * because there is nothing here to measure it with.
 */
export async function replaceSeriesArtwork(
  seriesId: string,
  imageUrl: string,
): Promise<void> {
  await replaceArtwork(
    imageUrl,
    seriesArtworkFilename(seriesId),
    async ({ uri }) => {
      await setSeriesArtwork(seriesId, uri);
    },
  );
}
