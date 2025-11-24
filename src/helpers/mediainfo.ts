// Higher-level helper that wraps getMediaInfo and extracts common fields
import {
  getMediaInfo,
  MediaInfoResult,
  ensureMediaInfo,
} from '../lib/mediainfoAdapter';

export type ExtractedMetadata = {
  container?: string;
  durationMs?: number;
  bitrate?: number;
  codec?: string;
  channels?: number;
  sampleRate?: number;
  title?: string;
  album?: string;
  artist?: string;
  track?: number;
  disc?: number;
  chapters?: { startMs: number; title?: string }[];
  raw: MediaInfoResult;
};

export async function analyzeFileWithMediaInfo(
  uri: string
): Promise<ExtractedMetadata> {
  await ensureMediaInfo();
  const res = await getMediaInfo(uri);
  // console.log('res', res);
  const json = (res.json || {}) as any;
  const media = json.media || {};
  const tracks: any[] = media.track || [];

  const general = tracks.find((t) => t['@type'] === 'General') || {};
  const audio = tracks.find((t) => t['@type'] === 'Audio') || {};
  const menu = tracks.find((t) => t['@type'] === 'Menu') || {};

  const durationMs =
    numberFrom(general.Duration) || numberFrom(audio.Duration);
  const bitrate =
    numberFrom(audio.BitRate) || numberFrom(general.OverallBitRate);
  const sampleRate = numberFrom(audio.SamplingRate);
  const channels = numberFrom(audio.Channels);
  const codec = audio.Format || audio.CodecID || general.CodecID;
  const container = general.Format;

  const title = general.Track || general.Title;
  const album = general.Album;
  const artist =
    general.Performer || general.Artist || general.Album_Performer;
  const track = numberFrom(general.Track_Position);
  const disc = numberFrom(general.Part_Position);

  const chapters: { startMs: number; title?: string }[] = [];
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
    container,
    durationMs,
    bitrate,
    codec,
    channels,
    sampleRate,
    title,
    album,
    artist,
    track,
    disc,
    chapters,
    raw: res,
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
