/**
 * Normalizes a book's stored artwork into something a media consumer can load.
 *
 * Returns `undefined` when the book has no usable cover; the native side then
 * substitutes the bundled default (see `MusicService.applyDefaultArtwork` in the
 * react-native-track-player patch). The fallback deliberately lives in native
 * code — every JS route to the bundled image is unusable in a release build:
 *
 *  - `Image.resolveAssetSource()` (what `@/constants/images` exposes) returns a
 *    bare Android resource identifier with no scheme. React Native's own
 *    <Image> resolves it natively, so in-app placeholders look correct, but
 *    TrackPlayer hands the string to Coil, whose `Uri.parse` yields nothing
 *    loadable.
 *  - `expo-asset` cannot materialize it either: its `localUri` comes from the
 *    embedded updates asset registry, and this app sets
 *    `expo.modules.updates.ENABLED=false`, so that registry is absent.
 *
 * Debug builds hide both problems — Metro serves assets over http://, which
 * Coil fetches happily.
 */
export function resolveTrackArtwork(
  artwork: string | null | undefined,
): string | undefined {
  if (!artwork) return undefined;
  // No scheme → an Android resource identifier from resolveAssetSource.
  // usePopulateDatabase persists that value for coverless books, so the column
  // is truthy but unloadable; treat it as "no cover" so native substitutes.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(artwork)) return undefined;
  return artwork;
}
