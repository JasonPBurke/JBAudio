import {
  analyzeMediaAsync,
  analyzeMediaNoCoverAsync,
  analyzeBatchNoCoverStreaming,
  BatchResult,
  MediaInfoJSON,
} from '../NativeMediaInfo';
import { Platform } from 'react-native';

export type MediaInfoResult = {
  raw: string;
  json: MediaInfoJSON | null;
};

function toMediaInfoResult(r: BatchResult): MediaInfoResult {
  if (!r.json) return { raw: '', json: null };
  return { raw: JSON.stringify(r.json), json: r.json };
}

export async function getMediaInfo(uri: string): Promise<MediaInfoResult> {
  if (Platform.OS !== 'android') {
    throw new Error('getMediaInfo is only supported on Android');
  }

  // Strip file:// prefix if present
  const filePath = uri.startsWith('file://') ? uri.slice(7) : uri;

  try {
    const parsed = await analyzeMediaAsync(filePath);
    return {
      raw: JSON.stringify(parsed),
      json: parsed,
    };
  } catch (error) {
    console.error('MediaInfo analysis failed:', error);
    return {
      raw: '',
      json: null,
    };
  }
}

export async function getMediaInfoNoCover(
  uri: string
): Promise<MediaInfoResult> {
  if (Platform.OS !== 'android') {
    throw new Error('getMediaInfoNoCover is only supported on Android');
  }

  // Strip file:// prefix if present
  const filePath = uri.startsWith('file://') ? uri.slice(7) : uri;

  try {
    const parsed = await analyzeMediaNoCoverAsync(filePath);
    return {
      raw: JSON.stringify(parsed),
      json: parsed,
    };
  } catch (error) {
    console.error('MediaInfo analysis (no cover) failed:', error);
    return {
      raw: '',
      json: null,
    };
  }
}

/**
 * Streaming parallel batch — runs N MediaInfo extractions concurrently in the
 * native pool, returns results in the same order as the input paths. `onResult`
 * fires per-file as each result arrives.
 *
 * Android-only. On other platforms returns an array of empty results without
 * touching the native side.
 */
export async function getMediaInfoBatch(
  uris: string[],
  onResult?: (uri: string, result: MediaInfoResult) => void,
): Promise<MediaInfoResult[]> {
  if (Platform.OS !== 'android' || uris.length === 0) {
    return uris.map(() => ({ raw: '', json: null }));
  }

  const paths = uris.map((u) => (u.startsWith('file://') ? u.slice(7) : u));
  const results = await analyzeBatchNoCoverStreaming(paths, (r) => {
    if (onResult) onResult(r.path, toMediaInfoResult(r));
  });
  return results.map(toMediaInfoResult);
}

// /**
//  * Extract cover art from media file.
//  * Cover data is now included in the JSON output from analyze().
//  */
// export async function getCover(uri: string): Promise<string> {
//   if (Platform.OS !== 'android') {
//     throw new Error('getCover is only supported on Android');
//   }

//   const filePath = uri.startsWith('file://') ? uri.slice(7) : uri;

//   try {
//     const parsed = await analyzeMediaAsync(filePath);
//     const generalTrack = parsed.media?.track?.find(
//       (t) => t['@type'] === 'General'
//     ) as GeneralTrack | undefined;
//     return generalTrack?.Cover_Data || '';
//   } catch {
//     return '';
//   }
// }
