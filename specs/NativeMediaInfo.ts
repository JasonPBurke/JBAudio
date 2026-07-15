import { TurboModuleRegistry, NativeModules } from 'react-native';
import type { TurboModule } from 'react-native';

export interface Spec extends TurboModule {
  /**
   * Analyze a media file at the given path and return the JSON string
   * produced by MediaInfoLib with Output=JSON.
   *
   * @param path - Absolute filesystem path to the media file
   * @returns JSON string with media metadata
   */
  analyze(path: string): string;

  /**
   * Analyze a media file without extracting cover art.
   * Faster than analyze() for multi-file books where only the first file needs cover extraction.
   *
   * @param path - Absolute filesystem path to the media file
   * @returns JSON string with media metadata (without Cover_Data)
   */
  analyzeNoCover(path: string): string;

  /**
   * Get diagnostic information about the MediaInfo native build.
   * Useful for troubleshooting Cover_Data support.
   *
   * @returns JSON string with diagnostic info including:
   *   - version: MediaInfo library version
   *   - cover_data_option_result: Result of setting Cover_Data option
   *   - cover_data_supported: Whether Cover_Data extraction is available
   */
  getDiagnostics(): string;

  /**
   * Parallel batch extraction (no cover). Dispatches across a shared 4-thread
   * native pool and emits one `MediaInfoBatchResult` event per file via
   * DeviceEventEmitter as it completes. Event shape:
   *   { batchId: string, path: string, json?: string, error?: string }
   * Promise resolves with the input count when the last file finishes.
   */
  analyzeBatchNoCover(batchId: string, paths: string[]): Promise<number>;

  /**
   * The process's Java-heap limit (Runtime.maxMemory()) in bytes. Constant
   * for the life of the process. Used to budget memory-hungry playback
   * structures (clipped-chapter queues) against the device's actual limit,
   * including the largeHeap manifest setting.
   */
  getMaxHeapBytes(): number;

  /** RN-required stubs for any module that emits DeviceEventEmitter events. */
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

// Try TurboModuleRegistry first, fall back to NativeModules
const NativeMediaInfo: Spec =
  TurboModuleRegistry.get<Spec>('NativeMediaInfo') ??
  (NativeModules.NativeMediaInfo as Spec);

if (!NativeMediaInfo) {
  throw new Error(
    'NativeMediaInfo module not found. Make sure the native module is properly linked.'
  );
}

export default NativeMediaInfo;
