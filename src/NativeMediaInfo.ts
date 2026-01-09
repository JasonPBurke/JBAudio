import NativeMediaInfoModule from '../specs/NativeMediaInfo';

//
// Core JSON structure returned by MediaInfo.Inform() with Output=JSON
//

export interface MediaInfoJSON {
  media: {
    '@ref'?: string;
    track: MediaInfoTrack[];
  };
}

export type MediaInfoTrack =
  | GeneralTrack
  | VideoTrack
  | AudioTrack
  | TextTrack
  | ImageTrack
  | MenuTrack
  | OtherTrack;

interface BaseTrack {
  '@type': string;
  UniqueID?: string;
  ID?: string;
  Title?: string;
  Duration?: string;
  Format?: string;
  Encoded_Application?: string;
  Encoded_Library?: string;
  FileSize?: string;
  [key: string]: unknown;
}

export interface GeneralTrack extends BaseTrack {
  '@type': 'General';
  Album?: string;
  Performer?: string;
  Artist?: string;
  Album_Performer?: string;
  Track?: string;
  Genre?: string;
  Recorded_Date?: string;
  Original_Date?: string;
  Tagged_Date?: string;
  Original_Year?: string;
  rldt?: string;
  OverallBitRate?: string;
  Cover?: 'Yes' | 'No';
  Cover_Mime?: string;
  Cover_Data?: string;
  Title_More?: string;
  Comment?: string;
  Copyright?: string;
  Track_Position?: string;
  Composer?: string;
  nrt?: string;
  CodecID?: string;
  extra?: Record<string, unknown>;
}

export interface VideoTrack extends BaseTrack {
  '@type': 'Video';
  Width?: string;
  Height?: string;
  FrameRate?: string;
  DisplayAspectRatio?: string;
  BitRate?: string;
  CodecID?: string;
  StreamSize?: string;
  Language?: string;
}

export interface AudioTrack extends BaseTrack {
  '@type': 'Audio';
  Channels?: string;
  ChannelPositions?: string;
  SamplingRate?: string;
  BitRate?: string;
  Language?: string;
  StreamSize?: string;
  CodecID?: string;
}

export interface TextTrack extends BaseTrack {
  '@type': 'Text';
  Language?: string;
  Format_Info?: string;
}

export interface ImageTrack extends BaseTrack {
  '@type': 'Image';
  Width?: string;
  Height?: string;
}

export interface MenuTrack extends BaseTrack {
  '@type': 'Menu';
  Chapter?: string;
  Chapters_Pos_Begin?: number[];
  Chapters_Name?: string[];
  extra?: Record<string, unknown>;
}

export interface OtherTrack extends BaseTrack {
  '@type': 'Other';
}

/**
 * Diagnostic information about the MediaInfo native build.
 */
export interface MediaInfoDiagnostics {
  version: string;
  cover_data_option_result: string;
  cover_data_supported: boolean;
  json_output_result: string;
  error?: string;
}

/**
 * Synchronous wrapper that calls the native TurboModule and parses the JSON.
 */
export function analyzeMedia(path: string): MediaInfoJSON {
  const json = NativeMediaInfoModule.analyze(path);
  return JSON.parse(json) as MediaInfoJSON;
}

/**
 * Async wrapper for MediaInfo analysis.
 * Although the underlying native call is synchronous, wrapping it in a
 * promise allows for consistent async/await usage patterns.
 */
export async function analyzeMediaAsync(
  path: string
): Promise<MediaInfoJSON> {
  return new Promise((resolve, reject) => {
    try {
      const parsed = analyzeMedia(path);
      resolve(parsed);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Get diagnostic information about the MediaInfo native build.
 * Useful for troubleshooting Cover_Data support.
 *
 * @returns Diagnostic info including Cover_Data support status
 */
export function getMediaInfoDiagnostics(): MediaInfoDiagnostics {
  const json = NativeMediaInfoModule.getDiagnostics();
  return JSON.parse(json) as MediaInfoDiagnostics;
}
