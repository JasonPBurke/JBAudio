// Higher-level helper that wraps getMediaInfo and extracts common fields
import {
  getMediaInfo,
  getMediaInfoNoCover,
  MediaInfoResult,
} from '../lib/mediainfoAdapter';
import {
  captureBookTags,
  readReleaseDate,
  type DeferredTagBlob,
} from './generalTags';

export type ExtractedMetadata = {
  fileFormat?: string;
  /** `extra.SERIES` — the raw tag off the file, not series membership. */
  series?: string;
  /** `extra.PART`. */
  part?: number;
  /** Top-level `Grouping` (iTunes `©grp`). */
  grouping?: string;
  /** Carried, never called here. See `DeferredTagBlob` in generalTags.ts. */
  rawTagsJson?: DeferredTagBlob;
  durationMs?: number;
  title?: string;
  album?: string;
  author?: string;
  narrator?: string;
  releaseDate?: string;
  description?: string;
  copyright?: string;
  chapters?: { startMs: number; title?: string }[];
  trackPosition?: number;
  cover?: string;
  bitrate?: number;
  sampleRate?: number;
  genre?: string;
  codec?: string;
  raw?: MediaInfoResult;
  imgWidth?: number;
  imgHeight?: number;
};

function parseTimestamp(timestamp: string): number | undefined {
  if (!timestamp.startsWith('_')) {
    return undefined;
  }
  // format is _HH_MM_SS_MS
  const parts = timestamp.substring(1).split('_');
  if (parts.length !== 4) {
    return undefined;
  }

  const [hours, minutes, seconds, milliseconds] = parts.map(Number);

  if ([hours, minutes, seconds, milliseconds].some(isNaN)) {
    return undefined;
  }

  return (hours * 3600 + minutes * 60 + seconds) * 1000 + milliseconds;
}

export async function analyzeFileWithMediaInfo(
  uri: string,
): Promise<ExtractedMetadata> {
  const res = await getMediaInfo(uri);
  return extractMetadataFromResult(res);
}

/**
 * Analyzes a media file without extracting cover art.
 * Faster than analyzeFileWithMediaInfo() for multi-file books where only the first file needs cover extraction.
 */
export async function analyzeFileWithMediaInfoNoCover(
  uri: string,
): Promise<ExtractedMetadata> {
  const res = await getMediaInfoNoCover(uri);
  return extractMetadataFromResult(res);
}

/**
 * Shared logic for extracting metadata from MediaInfo result.
 * Exported so callers that already have a MediaInfoResult (e.g. from the
 * streaming batch path) can convert without re-invoking the native side.
 */
export function extractMetadataFromResult(
  res: MediaInfoResult,
): ExtractedMetadata {
  const json = (res.json || {}) as any;
  const media = json.media || {};
  const tracks: any[] = media.track || [];
  // console.log('tracks', JSON.stringify(tracks, null, 2));

  const general = tracks.find((t) => t['@type'] === 'General') || {};
  const audio = tracks.find((t) => t['@type'] === 'Audio') || {};
  const menus = tracks.filter((t) => t['@type'] === 'Menu');
  //! not getting image track returned by mediainfo
  const image = tracks.find((t) => t['@type'] === 'Image') || {};
  const genre = general.Genre;
  const bitrate =
    numberFrom(audio.BitRate) || numberFrom(general.OverallBitRate);
  const sampleRate = numberFrom(audio.SamplingRate);
  // const channels = numberFrom(audio.Channels);
  const codec = audio.Format || audio.CodecID || general.CodecID;
  const durationInSeconds =
    numberFrom(general.Duration) || numberFrom(audio.Duration);
  const durationMs = durationInSeconds
    ? durationInSeconds * 1000
    : undefined;
  // Everything this funnel used to drop on the floor, plus fileFormat, which
  // it computed and then nobody read. See generalTags.ts — the logic lives
  // there because nothing in this file is reachable from jest.
  const tags = captureBookTags(general);
  const releaseDate = readReleaseDate(general);
  const description =
    general.Title_More || general.extra?.comment || general.Comment;
  const title = general.Track || general.Title || general.Album;
  const album = general.Album;
  const author =
    general.Artist || general.Performer || general.Album_Performer;
  const copyright = general.Copyright;
  const narrator =
    general.nrt ||
    general.extra?.nrt ||
    general.Composer ||
    general.Album_Performer;
  const trackPosition = numberFrom(general.Track_Position);
  const imgWidth = numberFrom(image.Width);
  const imgHeight = numberFrom(image.Height);

  // Extract Cover_Data (base64 encoded cover art from embedded artwork)
  // This is populated when MediaInfo is built with MEDIAINFO_ADVANCED and
  // Option("Cover_Data", "base64") is set before opening the file
  const cover = general.Cover_Data as string | undefined;

  const chapters: { startMs: number; title?: string }[] = [];
  for (const menu of menus) {
    // This handles the format where chapters are in the `extra` object
    if (menu.extra && typeof menu.extra === 'object') {
      for (const key in menu.extra) {
        // Keys are like _00_08_25_939
        if (key.startsWith('_')) {
          const startMs = parseTimestamp(key);
          const title = menu.extra[key];
          if (startMs !== undefined && typeof title === 'string') {
            chapters.push({ startMs, title });
          }
        }
      }
    }

    //! don't think this is needed
    // This handles the format where chapters are in `Chapters_Pos_Begin`
    if (Array.isArray(menu.Chapters_Pos_Begin)) {
      const begins: number[] = (menu.Chapters_Pos_Begin || [])
        .map(numberFrom)
        .filter((n: any): n is number => n !== undefined);
      const names: string[] = Array.isArray(menu.Chapters_Name)
        ? menu.Chapters_Name
        : [];
      for (let i = 0; i < begins.length; i++) {
        // Avoid adding duplicates if a file has chapters in multiple formats
        if (!chapters.some((c) => c.startMs === begins[i])) {
          chapters.push({
            startMs: begins[i],
            title: names[i] || `Chapter ${i + 1}`,
          });
        }
      }
    }
  }

  // Sort chapters by start time, as they may be parsed from different sources
  // Then deduplicate by startMs (some files have multiple Menu tracks with same data)
  if (chapters.length > 0) {
    chapters.sort((a, b) => a.startMs - b.startMs);

    // Remove duplicates - keep first occurrence at each startMs
    const seen = new Set<number>();
    const uniqueChapters: typeof chapters = [];
    for (const ch of chapters) {
      if (!seen.has(ch.startMs)) {
        seen.add(ch.startMs);
        uniqueChapters.push(ch);
      }
    }
    chapters.length = 0;
    chapters.push(...uniqueChapters);
  }

  return {
    fileFormat: tags.fileFormat,
    series: tags.series,
    part: tags.part,
    grouping: tags.grouping,
    rawTagsJson: tags.rawJson,
    durationMs,
    title,
    album,
    author,
    narrator,
    releaseDate,
    description,
    copyright,
    chapters,
    trackPosition,
    genre,
    codec,
    bitrate,
    sampleRate,
    cover, // Base64 encoded cover art from embedded artwork
    imgHeight,
    imgWidth,

    // raw: res,
  };
}

function numberFrom(v: any): number | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    // Remove non-digits except dot
    const cleaned = v.replace(/[^0-9.\-]/g, '');
    const n = Number(cleaned);
    return isFinite(n) ? n : undefined;
  }
  return undefined;
}
