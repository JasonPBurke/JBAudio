// Higher-level helper that wraps getMediaInfo and extracts common fields
import {
  getMediaInfo,
  MediaInfoResult,
  ensureMediaInfo,
  getCover,
} from '../lib/mediainfoAdapter';

export type ExtractedMetadata = {
  fileFormat?: string;
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
  raw: MediaInfoResult;
  cover?: string;
  // bitrate?: number;
  // codec?: string;
  // channels?: number;
  // sampleRate?: number;
  // disc?: number;
  // track?: number;
  // imgWidth?: number;
  // imgHeight?: number;
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
  uri: string
): Promise<ExtractedMetadata> {
  await ensureMediaInfo();
  const res = await getMediaInfo(uri);
  const json = (res.json || {}) as any;
  const media = json.media || {};
  const tracks: any[] = media.track || [];
  // console.log('tracks', JSON.stringify(tracks, null, 2));

  const general = tracks.find((t) => t['@type'] === 'General') || {};
  const audio = tracks.find((t) => t['@type'] === 'Audio') || {};
  const menus = tracks.filter((t) => t['@type'] === 'Menu');
  //! not getting image track returned by mediainfo
  // const image = tracks.find((t) => t['@type'] === 'Image') || {};
  // const cover = await getCover(uri);
  // console.log('cover', cover);
  // console.log('raw res', JSON.stringify(res, null, 2));
  // console.log('image', image);

  // const bitrate =
  //   numberFrom(audio.BitRate) || numberFrom(general.OverallBitRate);
  // const sampleRate = numberFrom(audio.SamplingRate);
  // const channels = numberFrom(audio.Channels);
  // const codec = audio.Format || audio.CodecID || general.CodecID;
  const durationInSeconds =
    numberFrom(general.Duration) || numberFrom(audio.Duration);
  const durationMs = durationInSeconds
    ? durationInSeconds * 1000
    : undefined;
  const fileFormat = general.Format;
  const releaseDate =
    general.Recorded_Date ||
    general.rldt ||
    general.Original_Date ||
    general.Tagged_Date ||
    general.Original_Year;
  const description =
    general.extra?.comment || general.Comment || general.Title_More;
  const title = general.Track || general.Title;
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
  // const track = numberFrom(general.Track_Position);
  // const imgWidth = numberFrom(image.Width);
  // const imgHeight = numberFrom(image.Height);

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
  if (chapters.length > 0) {
    chapters.sort((a, b) => a.startMs - b.startMs);
  }

  return {
    fileFormat,
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

    raw: res,
    // imgWidth,
    // imgHeight,
    // track,
    // bitrate,
    // codec,
    // channels,
    // sampleRate,
    // disc,
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
