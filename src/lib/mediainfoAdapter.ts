
import ExpoMediaInfoModule from '../../modules/expo-media-info';
import { Platform } from 'react-native';

export async function ensureMediaInfo(): Promise<void> {
  // No-op, we are using the native module
  return Promise.resolve();
}

export type MediaInfoResult = {
  raw: string;
  json: unknown;
};

export async function getMediaInfo(uri: string): Promise<MediaInfoResult> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    // For now, we only support native platforms
    // you can add web support back here if needed
    throw new Error('getMediaInfo is only supported on native platforms');
  }

  const result = await ExpoMediaInfoModule.getMediaInfo(uri);

  // result is a JSON string when format: "JSON"; keep raw and parsed
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(result);
  } catch {
    // keep null
  }

  return { raw: result, json: parsed };
}
