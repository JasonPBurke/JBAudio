/**
 * Device Java-heap limit, used to budget memory-hungry playback structures
 * (see shouldUseClippedChapters). Runtime.maxMemory() is constant for the
 * life of the process, so it is read from native once and cached.
 *
 * The fallback matches the most common non-largeHeap limit (256 MiB); it is
 * deliberately conservative so a failed native read can only make the app
 * fall back to the safer legacy playback path, never OOM.
 */
const FALLBACK_HEAP_LIMIT_BYTES = 256 * 1024 * 1024;

let cachedHeapLimitBytes: number | null = null;

export function getHeapLimitBytes(): number {
  if (cachedHeapLimitBytes !== null) return cachedHeapLimitBytes;
  let limit = FALLBACK_HEAP_LIMIT_BYTES;
  try {
    // Lazy require: keeps this module loadable in environments without the
    // native module (jest), where the spec file would throw on import.
    const NativeMediaInfo =
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('../../specs/NativeMediaInfo').default;
    const reported = NativeMediaInfo.getMaxHeapBytes();
    if (Number.isFinite(reported) && reported > 0) {
      limit = reported;
    }
  } catch {
    // Native module unavailable — keep the conservative fallback.
  }
  cachedHeapLimitBytes = limit;
  return limit;
}
