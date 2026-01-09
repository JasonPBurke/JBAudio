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
   * Get diagnostic information about the MediaInfo native build.
   * Useful for troubleshooting Cover_Data support.
   *
   * @returns JSON string with diagnostic info including:
   *   - version: MediaInfo library version
   *   - cover_data_option_result: Result of setting Cover_Data option
   *   - cover_data_supported: Whether Cover_Data extraction is available
   */
  getDiagnostics(): string;
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
