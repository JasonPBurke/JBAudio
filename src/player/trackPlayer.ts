import type { EmitterSubscription } from 'react-native';
import TrackPlayer, {
  AndroidAudioContentType,
  AppKilledPlaybackBehavior,
  Capability,
  Event,
  RepeatMode,
  State,
} from 'react-native-track-player';
import type {
  AddTrack,
  EventPayloadByEvent,
  PlayerOptions,
  Progress,
  ServiceHandler,
  Track,
  TrackMetadataBase,
  UpdateOptions,
} from 'react-native-track-player';

/**
 * The one module that imports `react-native-track-player`.
 *
 * MECHANICAL: RNTP's vocabulary, RNTP's semantics, no decisions. The same rule
 * `src/db/seriesQueries.ts` states for its own IO half — anything that decides
 * lives above this file. Nothing here branches on a Book, a Chapter or a Queue
 * shape, and nothing here should ever learn to: the app's most contested
 * question (what is Position measured against?) belongs to the callers, and
 * putting it inside the one module whose justification is that it decides
 * nothing would be self-defeating.
 *
 * This is NOT a deep module and is not presented as one. Its justification is
 * narrower and sufficient: it is the sole import site, so a newly discovered
 * RNTP quirk — the seek clamp, `updateOptions` replacing arrays wholesale, the
 * `commandStarted` latch, the foreground-service demote patch — has an obvious
 * home instead of being fixed at whichever call site met it. Claiming more
 * would invite someone to "fix" it later by giving it responsibilities.
 *
 * ⚠ ONE READ IS DELIBERATELY NOT A PASSTHROUGH, and `getActiveTrack` is NOT
 * exported. RNTP's `Track` is declared with an `[key: string]: any` index
 * signature, so `activeTrack.bookId`, `.bookid` and `.bookID` all compile and
 * two of them yield `undefined`. All 31 sites that fetched a Track read
 * `?.bookId` off it and nothing else — measured across every one, not sampled
 * — so `getActiveBookId` returns the answer instead of the transport. There is
 * no escape hatch on purpose: an escape hatch with no user is how the collapse
 * gets quietly undone, because the next person in a hurry reaches for the
 * familiar name. If a caller ever genuinely needs the whole item, it gets
 * added then, with the reason written into
 * `.scratch/player-seam/issues/04-create-rntp-adapter.md`.
 *
 * ⚠ THE QUEUE READ STAYS STRUCTURAL, and that asymmetry is deliberate rather
 * than an inconsistency waiting to be tidied. An active-item read answers a
 * question and returns the answer; a queue read exposes a structure and
 * returns the structure. Relative seek and chapter skip need per-item
 * durations to compute a landing spot, and the restore path needs the first
 * item's `bookId`.
 *
 * ⚠ ENUMS ARE RE-EXPORTED, NEVER REDEFINED, so they stay identity-equal to
 * RNTP's and every existing `State.Playing` comparison keeps working
 * untouched. Redefining them would be a small vocabulary win and a generator
 * of equality bugs that present as logic bugs.
 *
 * The fake sits BELOW this file, not at it:
 * `src/helpers/__tests__/support/fakePlayer.ts` keeps faking RNTP and tests
 * keep `jest.mock`ing RNTP, so the real adapter runs on top of the fake and is
 * exercised by the existing suite rather than being the one untested module.
 * That is also why every CALL below goes through RNTP's DEFAULT export — the
 * mocks replace `default`, and a named import would route around them.
 *
 * ⚠ THE ENUM RE-EXPORTS ARE THE ONE EXCEPTION, and they are named imports by
 * necessity. A test whose `jest.mock` factory omits `State` therefore re-exports
 * `undefined` through this file. Nothing regresses — the same mock already
 * yields `undefined` at the call site today — but once a migrated module takes
 * `State` from here, a mock that never needed to name it may suddenly have to.
 *
 * See `docs/adr/0003-only-the-rntp-adapter-imports-rntp.md` for why, and for
 * the four alternatives that were rejected.
 */

// ---------------------------------------------------------------------------
// Reads — the active item collapses to a bookId; the queue stays structural
// ---------------------------------------------------------------------------

/**
 * Which Book the Player currently has loaded, or `null` when it has none.
 *
 * The `typeof` guard is the single point ON THE ACTIVE-ITEM READ PATH where
 * `Track`'s `any` index signature is converted into a checked read — not the
 * single point in the file. `getQueue` still hands out `Track[]` whose
 * `bookId` is `any`, deliberately and by the same asymmetry: the restore path
 * reads `queue[0].bookId` unchecked and that read is not one of the 31.
 *
 * It is not a decision: a queue item without a usable `bookId` is
 * indistinguishable from no active item to every caller, and the alternative —
 * leaking `any` one layer up — is the defect this function exists to remove.
 */
export async function getActiveBookId(): Promise<string | null> {
  const bookId = (await TrackPlayer.getActiveTrack())?.bookId;
  return typeof bookId === 'string' ? bookId : null;
}

/** The active queue index, or `undefined` when nothing is loaded. */
export async function getActiveTrackIndex(): Promise<number | undefined> {
  return TrackPlayer.getActiveTrackIndex();
}

/** Position, duration and buffered position of the active queue item. */
export async function getProgress(): Promise<Progress> {
  return TrackPlayer.getProgress();
}

/**
 * The Player's transport state.
 *
 * Narrower than RNTP's `PlaybackState` union by exactly the `error` payload its
 * `State.Error` branch carries, because no caller reads it — every one
 * destructures `{ state }`. Widen it here if one ever does.
 */
export async function getPlaybackState(): Promise<{ state: State }> {
  return TrackPlayer.getPlaybackState();
}

/**
 * The whole queue, as items. Structural on purpose — see the header: callers
 * need per-item durations and the first item's `bookId`, not an answer.
 */
export async function getQueue(): Promise<Track[]> {
  return TrackPlayer.getQueue();
}

/** One queue item by index. Write-adjacent: read, edit, `updateMetadataForTrack`. */
export async function getTrack(index: number): Promise<Track | undefined> {
  return TrackPlayer.getTrack(index);
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/**
 * Seek to an absolute position within the ACTIVE queue item.
 *
 * ⚠ Native CLAMPS the target into `[0, duration]` of that item — it does not
 * cross a boundary. Crossing is a decision and lives above, in
 * `helpers/relativeSeek.ts`.
 */
export async function seekTo(seconds: number): Promise<void> {
  return TrackPlayer.seekTo(seconds);
}

/** Seek by an offset. Subject to the same active-item clamp as `seekTo`. */
export async function seekBy(seconds: number): Promise<void> {
  return TrackPlayer.seekBy(seconds);
}

export async function play(): Promise<void> {
  return TrackPlayer.play();
}

export async function pause(): Promise<void> {
  return TrackPlayer.pause();
}

export async function stop(): Promise<void> {
  return TrackPlayer.stop();
}

/** Make `index` the active queue item. Native resets the position to 0. */
export async function skip(index: number): Promise<void> {
  return TrackPlayer.skip(index);
}

export async function skipToNext(): Promise<void> {
  return TrackPlayer.skipToNext();
}

export async function skipToPrevious(): Promise<void> {
  return TrackPlayer.skipToPrevious();
}

/** Set the playback rate. Quantizing it is a decision and lives above. */
export async function setRate(rate: number): Promise<void> {
  return TrackPlayer.setRate(rate);
}

export async function setVolume(level: number): Promise<void> {
  return TrackPlayer.setVolume(level);
}

/** Clear the queue and unload the active item. */
export async function reset(): Promise<void> {
  return TrackPlayer.reset();
}

/**
 * Append items to the queue.
 *
 * Array-only, and without RNTP's `insertBeforeIndex` second parameter — no
 * caller passes one. RNTP also overloads this on a bare item; the ratified
 * surface carries one shape, so a single-item caller passes `[track]`.
 */
export async function add(tracks: AddTrack[]): Promise<number | void> {
  return TrackPlayer.add(tracks);
}

/** Replace one queue item's metadata in place. */
export async function updateMetadataForTrack(
  index: number,
  metadata: TrackMetadataBase,
): Promise<void> {
  return TrackPlayer.updateMetadataForTrack(index, metadata);
}

export async function setRepeatMode(mode: RepeatMode): Promise<RepeatMode> {
  return TrackPlayer.setRepeatMode(mode);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export async function setupPlayer(options: PlayerOptions): Promise<void> {
  return TrackPlayer.setupPlayer(options);
}

/**
 * ⚠ REPLACES capability arrays wholesale rather than merging them, and resets
 * omitted android options. Every caller must pass the complete set — the
 * reason `helpers/playerSetup.ts` funnels all of them through one builder.
 */
export async function updateOptions(options: UpdateOptions): Promise<void> {
  return TrackPlayer.updateOptions(options);
}

/**
 * Register the headless playback service.
 *
 * ⚠ Its ONE caller is the app entry (`index.js`) and it must stay there. Route
 * modules only execute when the router renders them, so on a headless start --
 * Android Auto or a headset connecting while the process has no UI -- a
 * registration living in a route would never run and every remote control would
 * be dead. The entry records the same reason at the call site.
 */
export function registerPlaybackService(factory: () => ServiceHandler): void {
  TrackPlayer.registerPlaybackService(factory);
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/**
 * Subscribe to a Player event. A passthrough, deliberately.
 *
 * Who may subscribe is a documented rule rather than a type constraint: the
 * Reanimated progress hook subscribes specifically to write shared values
 * without a React re-render, and any design that treats `subscribe` as a smell
 * to eliminate will fight that module and lose.
 */
export function subscribe<T extends Event>(
  event: T,
  handler: EventPayloadByEvent[T] extends never
    ? () => void
    : (payload: EventPayloadByEvent[T]) => void,
): EmitterSubscription {
  return TrackPlayer.addEventListener(event, handler);
}

// ---------------------------------------------------------------------------
// Re-exports — identity-equal to RNTP's, never redefined
//
// `AndroidAudioContentType` and `AppKilledPlaybackBehavior` are the ratified
// surface plus two, added on the ticket's own terms and with the reason
// recorded there. Both are enums, both are imported by `helpers/playerSetup.ts`,
// and ticket 08's stage-one ban bans enums — so without them that file could
// not come off RNTP and the ban's stated premise ("the enums and types, all of
// which the adapter re-exports") would simply be false. Measured across every
// named RNTP import in `src/`, not sampled.
//
// ⚠ `isPlaying` is the remaining hole and is NOT here on purpose. It is an
// imperative async function despite living in RNTP's `hooks/` folder, so the
// stage-one "React hooks stay permitted" carve-out does not cover it, and it
// DERIVES (`getPlaybackState` + `getPlayWhenReady` + `determineIsPlaying`)
// rather than reading. Its one caller is `components/PlayerStateSync.tsx`,
// which ticket 09 may restructure entirely. Classifying it now would be a
// guess; see ticket 04's `## Answer`.
// ---------------------------------------------------------------------------

export {
  AndroidAudioContentType,
  AppKilledPlaybackBehavior,
  Capability,
  Event,
  RepeatMode,
  State,
};
export type { AddTrack, Progress, Track };
