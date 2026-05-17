import {
  analyzeMediaFromUriAsync,
  analyzeMediaFromUriNoCoverAsync,
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

  try {
    const parsed = await analyzeMediaFromUriAsync(uri);
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

  try {
    const parsed = await analyzeMediaFromUriNoCoverAsync(uri);
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
