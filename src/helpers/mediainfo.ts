// Higher-level helper that wraps getMediaInfo and extracts common fields
import {
  getMediaInfo,
  MediaInfoResult,
  ensureMediaInfo,
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
  raw: MediaInfoResult;
  // bitrate?: number;
  // codec?: string;
  // channels?: number;
  // sampleRate?: number;
  // disc?: number;
  // track?: number;
  // imgWidth?: number;
  // imgHeight?: number;
};

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
  //! this needs to account for multiple menu tracks menu1 and menu2
  //TODO const menus = tracks.filter((t) => t['@type'] === 'Menu');
  const menu = tracks.find((t) => t['@type'] === 'Menu') || {};
  //! not getting image track returned by mediainfo
  // const image = tracks.find((t) => t['@type'] === 'Image') || {};

  // const bitrate =
  //   numberFrom(audio.BitRate) || numberFrom(general.OverallBitRate);
  // const sampleRate = numberFrom(audio.SamplingRate);
  // const channels = numberFrom(audio.Channels);
  // const codec = audio.Format || audio.CodecID || general.CodecID;
  // const disc = numberFrom(general.Part_Position);
  const durationMs =
    numberFrom(general.Duration) || numberFrom(audio.Duration);
  const fileFormat = general.Format;
  const releaseDate =
    general.rldt ||
    general.Original_Date ||
    general.Recorded_Date ||
    general.Tagged_Date ||
    general.Original_Year;
  const description = general.Comment || general.Title_More;
  const title = general.Track || general.Title;
  const album = general.Album;
  const author =
    general.Artist || general.Album_Performer || general.Performer;
  const copyright = general.Copyright;
  const narrator =
    general.Composer || general.nrt || general.Album_Performer;
  // const track = numberFrom(general.Track_Position);
  // const imgWidth = numberFrom(image.Width);
  // const imgHeight = numberFrom(image.Height);

  const chapters: { startMs: number; title?: string }[] = [];
  //TODO for (const menu of menus) {} ??
  //! get the names for the menu begins and menu names
  if (menu && Array.isArray(menu.Chapters_Pos_Begin)) {
    const begins: number[] = (menu.Chapters_Pos_Begin || [])
      .map(numberFrom)
      .filter(Boolean) as number[];
    const names: string[] = Array.isArray(menu.Chapters_Name)
      ? menu.Chapters_Name
      : [];
    for (let i = 0; i < begins.length; i++) {
      chapters.push({ startMs: begins[i], title: names[i] });
    }
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
