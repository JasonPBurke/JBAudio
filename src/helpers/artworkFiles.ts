/**
 * The artwork directory and the lifecycle of the files in it — spec §K8.
 *
 * ── Why this is not inside `replaceArtwork.ts` ────────────────────────────
 *
 * A CYCLE. `replaceArtwork` writes through the DB layer (`bookQueries`,
 * `seriesQueries`), and the DB layer is where K8's delete has to live —
 * `deleteSeries` must release a pinned file, and it is not the only path that
 * destroys a series row (`deleteEmptySeries` does too, and the editor is not
 * its caller). Putting the unlink at one call site would leave the other
 * leaking, so the invariant sits with the row deletion and the two modules
 * would import each other.
 *
 * Splitting the file primitives out is the fix and is better layering anyway:
 * nothing here knows what a book or a series is, so both sides can depend on
 * it and neither depends on the other.
 *
 * ⚠ Deliberately NOT in `artworkIdentity.ts`, which is pure and unit-tested.
 * This project's jest has no React Native preset, so a module that imports
 * RNFS cannot be required from a test — which is exactly why the URI-to-path
 * DECISION lives in `artworkIdentity` (tested) and only the IO lives here.
 */
import * as RNFS from '@dr.pogodin/react-native-fs';

import { artworkFilePath } from './artworkIdentity';

/** Where every cover this app owns lives. */
export function artworkDirectory(): string {
  return `${RNFS.DocumentDirectoryPath}/artwork`;
}

/**
 * Unlink an artwork file this app owns — §K8.
 *
 * Silent on every failure mode, including a URI that is not ours (see
 * `artworkFilePath`, which refuses anything outside the artwork directory).
 * Every caller is a cleanup path running AFTER the row that referenced the
 * file is gone, so there is nothing left to stay consistent with: a file that
 * fails to delete is a leaked file, which is the state the app was already in
 * before this existed, and it must never turn a successful delete or revert
 * into a visible error.
 *
 * ⚠ It also must never delete `_default_cover.png`. It cannot: that file is
 * materialised by native code, is referenced by no row, and so is never passed
 * here. The ref-counted sweep sketched in the orphaned-artwork note has no
 * such protection by construction and must exclude it explicitly.
 */
export async function deleteArtworkFile(
  uri: string | null | undefined,
): Promise<void> {
  const path = artworkFilePath(uri, artworkDirectory());
  if (!path) return;
  await RNFS.unlink(path).catch(() => {});
}
