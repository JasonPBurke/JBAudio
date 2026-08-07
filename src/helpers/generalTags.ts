/**
 * Reading the MediaInfo General track — specifically the parts the scan used
 * to throw away.
 *
 * Deliberately pure and free of React Native imports so it can be tested:
 * `mediainfo.ts` reaches the native turbomodule through `mediainfoAdapter`,
 * which makes every line in that file unreachable from jest (this repo runs
 * jest on bare babel, with no RN preset). Anything here that matters is
 * testable; `mediainfo.ts` stays the thin funnel that calls it.
 *
 * Where things live is not a detail. iTunes' `©grp` atom arrives as a
 * TOP-LEVEL `Grouping`, while Audible's freeform atoms arrive under `extra`
 * (`extra.SERIES`, `extra.PART`, `extra.rldt`). Reading one at the other's
 * address is exactly how the `rldt` fallback below came to never fire.
 */

/** The `General` track as MediaInfo hands it over: string values, loosely typed. */
type GeneralTrack = Record<string, unknown> & {
  extra?: Record<string, unknown>;
};

export type CapturedTags = {
  /** `extra.SERIES` — the raw tag, not series membership. */
  series?: string;
  /** `extra.PART`, parsed. */
  part?: number;
  /** Top-level `Grouping` (iTunes `©grp`). */
  grouping?: string;
  /** Top-level `Format`, e.g. `MPEG-4`. */
  fileFormat?: string;
  /** The whole track as JSON, for `book_tags.raw_json`. */
  rawJson?: string;
};

/**
 * Base64 cover art rides the General track as `Cover_Data`, and the first file
 * of every book — the one whose tags become the book's — is exactly the file
 * the scan extracts WITH cover. Keeping it would store a whole JPEG per book
 * instead of the ~2 KB of tags the blob was costed at.
 */
const COVER_DATA_KEY = 'Cover_Data';

function trimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Strict on purpose: `PART` is a bare number in every real record, so anything
 * else (`'3 / 3'`, `'Book Two'`) is a shape we have not seen and must not
 * guess at. Contrast `numberFrom` in mediainfo.ts, which strips non-digits and
 * would read `'3 / 3'` as 33.
 */
function partNumber(value: unknown): number | undefined {
  const text = trimmedString(value);
  if (text === undefined) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Everything worth keeping off one file's General track: four queryable values
 * plus the track itself.
 */
export function captureBookTags(general: unknown): CapturedTags {
  const track = (general ?? {}) as GeneralTrack;
  const extra = (track.extra ?? {}) as Record<string, unknown>;

  return {
    series: trimmedString(extra.SERIES),
    part: partNumber(extra.PART),
    grouping: trimmedString(track.Grouping),
    fileFormat: trimmedString(track.Format),
    rawJson: serializeTrack(track),
  };
}

function serializeTrack(track: GeneralTrack): string | undefined {
  const keepable = Object.keys(track).filter((key) => key !== COVER_DATA_KEY);
  // Nothing but cover art, or nothing at all: no row worth writing.
  if (keepable.length === 0) return undefined;

  const kept: Record<string, unknown> = {};
  for (const key of keepable) {
    kept[key] = track[key];
  }
  return JSON.stringify(kept);
}

/**
 * The release-date fallback chain.
 *
 * `extra.rldt` is the fix this ticket owes the repo: the chain read a
 * top-level `general.rldt`, which is present in 0 of 304 real files, while 47
 * carry it under `extra`. The branch had never once fired. Both addresses are
 * kept, in that order, mirroring the `nrt` chain in mediainfo.ts — which only
 * works today because its `extra` lookup happens to sit in the same chain.
 */
export function readReleaseDate(general: unknown): string | undefined {
  const track = (general ?? {}) as GeneralTrack;
  const extra = (track.extra ?? {}) as Record<string, unknown>;

  return (
    trimmedString(track.Recorded_Date) ??
    trimmedString(track.rldt) ??
    trimmedString(extra.rldt) ??
    trimmedString(track.Original_Date) ??
    trimmedString(track.Tagged_Date) ??
    trimmedString(track.Original_Year)
  );
}
