import type { EmitterSubscription } from 'react-native';
import TrackPlayer, {
  AndroidAudioContentType,
  AppKilledPlaybackBehavior,
  Capability,
  Event,
  RepeatMode,
  State,
  // ⚠ These three are NAMED module exports, not members of the default export
  // the fake replaces. Aliased so the wrappers below can keep RNTP's names --
  // see the note on the fake in the header.
  isPlaying as rntpIsPlaying,
  useActiveTrack as useRntpActiveTrack,
  useIsPlaying as useRntpIsPlaying,
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
 * That is also why every CALL below that CAN go through RNTP's DEFAULT export
 * does — the mocks replace `default`, and a named import would route around
 * them.
 *
 * ⚠ TWO GROUPS CANNOT, and both are named imports by necessity rather than by
 * choice: the enums, and the three hook/`isPlaying` wrappers RNTP publishes as
 * module exports rather than as methods on `TrackPlayer`. A test whose
 * `jest.mock` factory omits `State` therefore re-exports `undefined` through
 * this file, and one that renders a component reaching the wrappers must name
 * them in its factory — `player/__tests__/trackPlayer.rn.test.tsx` is the
 * worked example. Nothing regressed when the wrappers arrived: their one
 * caller already imported the same named exports directly, so every mock that
 * covered it still does.
 *
 * See `docs/adr/0003-only-the-rntp-adapter-imports-rntp.md` for why, and for
 * the four alternatives that were rejected.
 */

// ---------------------------------------------------------------------------
// Reads — the active item collapses to a bookId; the queue stays structural
// ---------------------------------------------------------------------------

/**
 * The one conversion of `Track`'s `any` index signature into a checked read.
 *
 * Shared by the imperative and reactive active-item reads so that "narrowed
 * identically" is a fact rather than a claim in two docblocks that can drift.
 * Private: the narrowing is the adapter's job, and a caller holding this would
 * mean a caller holding a `Track`.
 */
function asBookId(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

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
  return asBookId((await TrackPlayer.getActiveTrack())?.bookId);
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
 * Whether the Player should read as "playing" to a person looking at the UI.
 *
 * Not the same question as `getPlaybackState`, and not derivable from it here:
 * RNTP combines the transport state with `playWhenReady` and folds
 * Loading/Buffering/Error/Ended into one answer. `undefined` means not yet
 * known, which is distinct from `false`.
 *
 * The RETURN TYPE omits RNTP's `bufferingDuringPlay`, because no caller reads
 * it — the same trim, for the same reason, as `getPlaybackState`'s `error`
 * payload. ⚠ Type-level only: the field is still present at runtime, so this
 * hides it rather than stripping it. Widen the type here if a caller ever
 * wants it.
 *
 * ⚠ THE AUTHORITATIVE READ, and the reason it exists alongside the hook below.
 * `useIsPlaying` is purely event-derived, so after a long background it
 * reports whatever the last delivered event said until the backlog drains;
 * this asks the Player directly. `components/PlayerStateSync` calls it on
 * foreground for exactly that reason.
 */
export async function isPlaying(): Promise<{ playing: boolean | undefined }> {
  return rntpIsPlaying();
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
// Reactive reads — the library's React hooks
//
// ⚠ ONE COMPONENT MAY CALL THESE: `components/PlayerStateSync`, which mirrors
// them into `store/playerState` for everyone else. That was ticket 09's whole
// point — eleven `useActiveTrack()` subscriptions collapsed to one — and until
// ticket 10 the eslint allow list enforced it mechanically. It no longer can:
// the list is empty, so the ban now reads "nobody imports RNTP", and these two
// names are on THIS module's surface where any file may take them. The rule
// survives as a rule. A second caller re-creates the shape ticket 09 removed,
// and re-creates it invisibly, because a duplicated subscription is correct on
// screen and merely wasteful.
//
// They are here rather than reimplemented on `subscribe` because RNTP's
// `useActiveTrack` also fetches once on mount to seed cold start; hand-rolling
// it would drop that seed, and the FloatingPlayer would stay blank after a
// process restart until the next track change.
// ---------------------------------------------------------------------------

/**
 * Which Book the Player currently has loaded, or `null` when it has none —
 * the reactive twin of `getActiveBookId`, and narrowed identically.
 *
 * ⚠ NAMED FOR RNTP'S HOOK, NOT FOR THE ANSWER, deliberately, and the tension
 * is real rather than overlooked. CONTEXT.md's **Active Book** entry lists
 * "active track" under _Avoid_, and this name uses it — as a compound naming
 * RNTP's own `useActiveTrack` (the source), not as a synonym for the Active
 * Book (the answer). The adapter's rule is RNTP's vocabulary, and
 * `getActiveTrackIndex` above already spends the same phrase.
 *
 * The alternative, `useActiveBookId`, is worse: `store/playerState` already
 * exports that name for the MIRROR this hook feeds, and this app has been
 * bitten once already by two identically named `activeBookId` fields meaning
 * different things — `store/queue`'s was the REQUESTED Book until ticket 11
 * renamed it `requestedBookId` (see that store's header and CONTEXT.md).
 * Re-using the mirror's name here would put that collision straight back, one
 * layer down. Every consumer other than `PlayerStateSync` wants the
 * mirror, and this name makes the two impossible to confuse at an import
 * site.
 *
 * The `typeof` guard is not decoration: `Track` carries an `[key: string]: any`
 * index signature, so `.bookId`, `.bookid` and `.bookID` all compile and two
 * yield `undefined`. Since ticket 09 this value is the app's single answer to
 * "which Book is playing?", so a slip nulls the Active Book for every consumer
 * with no error and no type change. Covered by
 * `player/__tests__/trackPlayer.rn.test.tsx`.
 */
export function useActiveTrackBookId(): string | null {
  return asBookId(useRntpActiveTrack()?.bookId);
}

/**
 * Whether the Player reads as "playing", re-rendering when that changes.
 *
 * Event-derived, and narrowed to `{ playing }` on the same terms as the
 * imperative `isPlaying` above. Reach for that one when the answer must be
 * authoritative rather than merely current.
 */
export function useIsPlaying(): { playing: boolean | undefined } {
  return useRntpIsPlaying();
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

/**
 * RNTP's track metadata plus the two keys OUR PATCH adds.
 *
 * `TrackMetadataBase` is a closed interface — unlike `Track`, which carries an
 * `[key: string]: any` index signature — so the window keys would be rejected
 * as excess properties without this. Widening it here rather than at the call
 * site is the same reason the rest of this module exists: a divergence
 * between our patched RNTP and the published types is an RNTP fact, and RNTP
 * facts live in this file.
 *
 * ⚠ These are consumed ONLY by the MediaSession's view of the player
 * (`InnerForwardingPlayer`), never by ExoPlayer. They change what the
 * notification and Android Auto display; they cannot change what is played.
 * `helpers/chapterWindow.ts` is the only thing that decides their values.
 */
export type TrackMetadataUpdate = TrackMetadataBase & {
  /** Milliseconds into the file where the presented slice starts. */
  windowStartMs?: number;
  /** Milliseconds into the file where it ends. Never send one without the other. */
  windowEndMs?: number;
};

/** Replace one queue item's metadata in place. */
export async function updateMetadataForTrack(
  index: number,
  metadata: TrackMetadataUpdate,
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
 * RNTP's event/payload map plus the events OUR OWN PATCH emits.
 *
 * `remote-play-book` is emitted by the Android Auto browse path in the
 * patched native layer. It is not in RNTP's `Event` enum and not in
 * `EventPayloadByEvent`, so before this existed the only subscriber -- the
 * playback service -- compiled solely because it was JavaScript.
 *
 * Adding a member here is a claim about the PATCH, so it belongs in the one
 * module that already owns the impedance mismatch with a patched native
 * layer. Keep it in step with `android/src/` and the patch-package patch.
 */
export type AppEventPayloadByEvent = EventPayloadByEvent & {
  /** Android Auto browse selection. Payload is our patch's, not RNTP's. */
  'remote-play-book': { bookId: string };
};

/**
 * Subscribe to a Player event. A passthrough, deliberately.
 *
 * Who may subscribe is a documented rule rather than a type constraint: the
 * Reanimated progress hook subscribes specifically to write shared values
 * without a React re-render, and any design that treats `subscribe` as a smell
 * to eliminate will fight that module and lose.
 */
export function subscribe<T extends keyof AppEventPayloadByEvent>(
  event: T,
  handler: AppEventPayloadByEvent[T] extends never
    ? () => void
    : (payload: AppEventPayloadByEvent[T]) => void,
): EmitterSubscription {
  // The two casts this module accepts on purpose. RNTP's own signature only
  // admits its `Event` enum, so a name it does not know cannot be passed
  // without one -- and the alternative is writing a raw native event name
  // plus a cast back into the playback service, the exact file ADR 0003
  // exists to keep free of them. This RELOCATES the unsoundness to the
  // boundary module; it does not remove it.
  return TrackPlayer.addEventListener(event as Event, handler as never);
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
// ⚠ `isPlaying` WAS the hole ticket 04 left open, and ticket 10 closed it as a
// wrapper rather than a re-export — see `isPlaying` above. It is an imperative
// async function despite living in RNTP's `hooks/` folder, and it DERIVES
// (`getPlaybackState` + `getPlayWhenReady` + `determineIsPlaying`) rather than
// reading. Deriving is RNTP's decision about RNTP's own state, not one of
// ours, so it passes the mechanical test the rest of this file passes.
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
