import { seekTo } from '@/player/trackPlayer';
import { recordActiveBookSeekFootprint } from '@/helpers/activeBookFootprints';
import { withoutBlockingThePress } from '@/helpers/withoutBlockingThePress';

/**
 * The remote seek-bar press: the notification player's scrubber, Android
 * Auto's, and any other MediaSession controller's.
 *
 * ── The platform sends this press TWICE ──
 *
 * One tap on the Android media notification's seek bar reaches us as TWO
 * `Event.RemoteSeek` events carrying the SAME target, tens of milliseconds
 * apart. Measured on a Pixel 7 Pro (Android 16, RNTP v5 alpha): one tap
 * produced two BUFFERING->PLAYING cycles at an identical `position`, roughly
 * 60ms apart, every single time across repeated runs.
 *
 * It is specific to seeking -- a Play press produced exactly one footprint on
 * the same device and build -- and it is NOT ours: `InnerForwardingPlayer`
 * (the media3 `ForwardingPlayer` the MediaSession drives) intercepts external
 * `seekTo` calls and emits to JS instead of forwarding, while our own
 * `seekTo` reaches ExoPlayer directly, so our reply cannot echo back as a
 * second event.
 *
 * ── Why the duplicate wrote a WRONG breadcrumb, not just a spare one ──
 *
 * The handler records where the Player is, then seeks. The duplicate's
 * position read resolves AFTER the first event's seek has landed, so it
 * recorded the DESTINATION. That is the one place the user can already get
 * back to by doing nothing, filed under a label that promises the opposite.
 * Timing decides which flavour of wrong appears: when the duplicate lost the
 * race instead, both breadcrumbs named the origin -- the older, harmless-
 * looking "two identical footprints" report is the same defect.
 *
 * ── What is suppressed, and what is not ──
 *
 * The duplicate's FOOTPRINT is dropped; its seek still runs. Seeking twice to
 * one target is idempotent, so replaying it costs nothing, and the failure
 * modes are not symmetric: a false positive here must never swallow a seek
 * the user asked for. The recording is the only half that was ever wrong.
 *
 * Two functions, following `nextPress`: `handleRemoteSeekPress` is the press
 * with its clock, its memory and its effects INJECTED -- which is what makes
 * the ordering rule assertable without a player or a database -- and
 * `pressRemoteSeek` below is the wiring the playback service calls.
 * `setup/service.ts` has no test lane, so nothing that has to be pinned may
 * live there.
 */

/**
 * How long after a remote seek a second one at the same target is still the
 * same press.
 *
 * 500ms, the same window `REMOTE_STOP_GUARD_MS` uses against a spurious
 * `RemoteStop`, and for the same kind of reason. It has an order of magnitude
 * of headroom over the ~60ms gap measured on device, and it is far below the
 * interval at which a person could deliberately re-seek to a target they are
 * already sitting on -- which would be a no-op press anyway.
 */
export const DUPLICATE_SEEK_WINDOW_MS = 500;

/**
 * How close two targets must be to count as the same one.
 *
 * The duplicate is rebuilt from the same native `positionMs` and arrives
 * identical, so this is slack against float round-tripping rather than a
 * real tolerance -- 10ms of audio, which no press is trying to express.
 */
const SAME_TARGET_TOLERANCE_SECONDS = 0.01;

/**
 * The last remote seek this runtime served.
 *
 * ⚠ It has to be STATE, and that is the whole difficulty: the duplicate is a
 * second event with its own handler run, so nothing inside one press can see
 * it. `targetSeconds` is `null` only before the first seek of the runtime --
 * distinct from a legitimate seek to 0.
 */
export type RemoteSeekBurst = {
  targetSeconds: number | null;
  atMs: number;
};

/**
 * Is this event the platform repeating the press we just served?
 *
 * Keyed on the TARGET and not merely on recency: two quick presses to
 * different spots are two presses and deserve two breadcrumbs, while the
 * duplicate always names the identical target.
 */
export function isRepeatOfLastSeek(
  burst: RemoteSeekBurst,
  targetSeconds: number,
  nowMs: number,
): boolean {
  if (burst.targetSeconds === null) return false;
  if (nowMs - burst.atMs >= DUPLICATE_SEEK_WINDOW_MS) return false;

  return (
    Math.abs(burst.targetSeconds - targetSeconds) <=
    SAME_TARGET_TOLERANCE_SECONDS
  );
}

export type RemoteSeekPress = {
  /** Where the press is asking to go, in seconds — the event's payload. */
  targetSeconds: number;
  /** `Date.now()` at the call site, injected so the window is assertable. */
  nowMs: number;
  /** The shared memory of the last seek. Read AND advanced by this press. */
  burst: RemoteSeekBurst;
  /**
   * Records the breadcrumb back to the pre-press spot. Awaited BEFORE the
   * seek: it reads the live Player, and after the transport call that reads
   * the destination instead.
   */
  onBeforeSeek: () => Promise<void> | void;
  /** The transport call itself. */
  seek: (seconds: number) => Promise<void>;
};

export async function handleRemoteSeekPress({
  targetSeconds,
  nowMs,
  burst,
  onBeforeSeek,
  seek,
}: RemoteSeekPress): Promise<void> {
  // ⚠ THE CHECK AND THE SET MUST STAY ABOVE THE FIRST `await`, and this is
  // the whole reason the guard works. The duplicate arrives while this
  // handler is still in flight -- it is a second event, not a second call --
  // so the two runs interleave. A single-threaded synchronous prefix is what
  // makes this a test-and-set the second run cannot slip inside; move either
  // line below an await and both runs read a stale `burst` and record.
  const repeat = isRepeatOfLastSeek(burst, targetSeconds, nowMs);

  // Advanced for EVERY event, the duplicate included, so a burst of three
  // collapses to one breadcrumb rather than to alternating pairs.
  burst.targetSeconds = targetSeconds;
  burst.atMs = nowMs;

  if (!repeat) {
    await withoutBlockingThePress(onBeforeSeek);
  }

  await seek(targetSeconds);
}

/**
 * The shared memory the playback service's handler seeks against.
 *
 * A module singleton for the same reason `singleFileChapterTracking` is one,
 * and with the same caveat: it assumes the playback service runs in the SAME
 * JS context as the UI, which `index.js` guarantees today.
 */
export const remoteSeekBurst: RemoteSeekBurst = {
  targetSeconds: null,
  atMs: 0,
};

/** A remote seek-bar press, wired to the real clock, recorder and player. */
export async function pressRemoteSeek(targetSeconds: number): Promise<void> {
  await handleRemoteSeekPress({
    targetSeconds,
    nowMs: Date.now(),
    burst: remoteSeekBurst,
    onBeforeSeek: () => recordActiveBookSeekFootprint(),
    seek: seekTo,
  });
}
