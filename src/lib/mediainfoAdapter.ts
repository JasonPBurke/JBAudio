import {
  analyzeMediaAsync,
  analyzeMediaNoCoverAsync,
  MediaInfoJSON,
} from '../NativeMediaInfo';
import { Platform } from 'react-native';

export type MediaInfoResult = {
  raw: string;
  json: MediaInfoJSON | null;
};

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
