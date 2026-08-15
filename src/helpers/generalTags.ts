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

/**
 * The whole General track as JSON, bound for `book_tags.raw_json` — DEFERRED,
 * and this is the one place the reason is written down. Every declaration of
 * it downstream names this type rather than restating the argument.
 *
 * A thunk rather than a string because only one file's blob per BOOK is ever
 * stored: `groupChaptersIntoBooks` copies it inside its `!bookMap.has(...)`
 * branch and drops every other file's. On the recorded corpus (~3,880 files,
 * ~350 books) eager serialisation computed ~3,530 results, held them for the
 * whole directory pass and threw them away.
 *
 * Calling it is `groupChaptersIntoBooks`' job and nobody else's. Call it per
 * file and the deferral buys nothing; never call it and `book_tags.raw_json`
 * empties silently, because `Book.metadata` is `{ [key: string]: any }` and
 * WatermelonDB's `@text` setter turns the uncalled function into null.
 *
 * ⚠ Deliberately NOT memoised. Caching the result would retain the string
 * *and* the pruned copy for every file, which is both halves of the cost this
 * exists to avoid. It is called at most once per book; there is nothing to
 * cache.
 */
export type DeferredTagBlob = () => string;

export type CapturedTags = {
  /** `extra.SERIES` — the raw tag, not series membership. */
  series?: string;
  /** `extra.PART`, parsed. */
  part?: number;
  /** Top-level `Grouping` (iTunes `©grp`). */
  grouping?: string;
  /** Top-level `Format`, e.g. `MPEG-4`. */
  fileFormat?: string;
  /**
   * `undefined` still means *nothing worth writing* — the same signal the
   * string carried, so the `if (rawTagsJson)` at the write site is unchanged.
   */
  rawJson?: DeferredTagBlob;
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
  const storable = pruneTrack(track);

  return {
    series: trimmedString(extra.SERIES),
    part: partNumber(extra.PART),
    grouping: trimmedString(track.Grouping),
    fileFormat: trimmedString(track.Format),
    // The closure captures the PRUNED COPY, never `track`. Closing over the
    // track would pin `Cover_Data` — a whole base64 JPEG — for as long as the
    // thunk lives, which is the entire directory pass. That reads as an
    // optimisation and is far worse than the waste it replaces.
    rawJson:
      storable === undefined ? undefined : () => JSON.stringify(storable),
  };
}

/**
 * The cheap half of the old `serializeTrack`, still eager: dropping the cover
 * key is what makes the deferred half safe to hold on to.
 *
 * The kept keys are COPIED across rather than spread-then-deleted, so the
 * cover's value is never read. `Cover_Data` arrives as base64 already in
 * memory, so reading it costs nothing by itself — but a prune that touches it
 * is one edit away from retaining it, and the test pins the stronger property.
 *
 * Shallow on purpose. `extra` rides along by reference: this codebase's
 * extractor reads cover bytes from the TOP-LEVEL `Cover_Data` only
 * (`mediainfo.ts`, `mediainfoAdapter.ts`), and no fixture or real record has
 * ever shown them under `extra`. Pruning it too would be guessing at a shape
 * we have not seen — the same refusal `partNumber` above makes.
 */
function pruneTrack(track: GeneralTrack): Record<string, unknown> | undefined {
  const kept: Record<string, unknown> = {};
  // A flag rather than `Object.keys(kept).length` at the end: this runs once
  // per FILE (~3,880 of them), and a second keys array is the kind of throwaway
  // allocation this whole change exists to stop making.
  let keptAny = false;

  for (const key of Object.keys(track)) {
    if (key === COVER_DATA_KEY) continue;
    kept[key] = track[key];
    keptAny = true;
  }

  // Nothing but cover art, or nothing at all: no row worth writing.
  return keptAny ? kept : undefined;
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
