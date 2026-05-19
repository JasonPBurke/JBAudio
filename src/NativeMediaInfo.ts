import { DeviceEventEmitter } from 'react-native';
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
 * Synchronous wrapper that analyzes media without extracting cover art.
 * Faster than analyzeMedia() for multi-file books where only the first file needs cover extraction.
 */
export function analyzeMediaNoCover(path: string): MediaInfoJSON {
  const json = NativeMediaInfoModule.analyzeNoCover(path);
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
 * Async wrapper for MediaInfo analysis without cover extraction.
 * Although the underlying native call is synchronous, wrapping it in a
 * promise allows for consistent async/await usage patterns.
 */
export async function analyzeMediaNoCoverAsync(
  path: string
): Promise<MediaInfoJSON> {
  return new Promise((resolve, reject) => {
    try {
      const parsed = analyzeMediaNoCover(path);
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

export type BatchResult =
  | { path: string; json: MediaInfoJSON; error?: never }
  | { path: string; json?: never; error: string };

let _batchCounter = 0;

/**
 * Streaming parallel batch extraction (no cover). The native side dispatches
 * across a 4-thread pool and emits one event per file as it finishes; this
 * wrapper subscribes, collects, and returns results in input path order.
 *
 * `onResult` fires per-file as each event arrives — useful for incremental
 * progress UI or future per-book streaming persist. It runs on the JS thread.
 */
export async function analyzeBatchNoCoverStreaming(
  paths: string[],
  onResult?: (result: BatchResult) => void,
): Promise<BatchResult[]> {
  if (paths.length === 0) return [];

  const batchId = `b${++_batchCounter}`;
  const byPath = new Map<string, BatchResult>();

  const subscription = DeviceEventEmitter.addListener(
    'MediaInfoBatchResult',
    (event: {
      batchId: string;
      path: string;
      json?: string;
      error?: string;
    }) => {
      if (event.batchId !== batchId) return;
      const result: BatchResult = event.error
        ? { path: event.path, error: event.error }
        : { path: event.path, json: JSON.parse(event.json!) as MediaInfoJSON };
      byPath.set(event.path, result);
      onResult?.(result);
    },
  );

  try {
    await NativeMediaInfoModule.analyzeBatchNoCover(batchId, paths);
    // Subscription callbacks run on the JS thread, so by the time await returns
    // every emitted event has been processed (events are queued on the same
    // thread that resolves the Promise).
    return paths.map(
      (p) => byPath.get(p) ?? { path: p, error: 'no result' },
    );
  } finally {
    subscription.remove();
  }
}
