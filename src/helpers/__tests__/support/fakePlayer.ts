/**
 * A minimal simulator of TrackPlayer's queue semantics.
 *
 * Call-assertion mocks cannot catch boundary bugs: code that computes a
 * nonsense target (a negative position, or one past the item's end) still
 * "calls seekTo", so the spy is satisfied while the user lands in the wrong
 * place. This fake models the two native behaviours that turn such a target
 * into the symptom the user sees:
 *
 *  1. `seekTo` CLAMPS into `[0, duration]` of the ACTIVE queue item. This is
 *     the same clamping that made native `seekBy` stop at a chapter boundary
 *     (the reason `relativeSeek` exists at all).
 *  2. `skipToNext` / `skipToPrevious` / `skip` move the active item and reset
 *     the position to 0.
 *
 * Tests then assert on the landing spot — `player.at()` — which is exactly
 * what a user reports ("I ended up at the start of chapter 2").
 */

export interface FakePlayerOptions {
  /** Per-queue-item durations in seconds, in queue order. */
  durations: number[];
  /** Active queue item index. */
  index: number;
  /** Position within the active item, in seconds. */
  position: number;
  /** Whether the player is playing before the seek. Defaults to false. */
  playing?: boolean;
  /** Omit `duration` from queue items, as an untagged rip would. */
  withoutTrackDurations?: boolean;
}

export interface FakePlayer {
  /** The object to hand to `jest.mock('react-native-track-player')`. */
  api: Record<string, jest.Mock>;
  /** Landing spot after the operation under test. */
  at: () => { index: number; position: number };
  /** True while the simulated player is playing. */
  isPlaying: () => boolean;
  /** Absolute position from the start of the book, in seconds. */
  absolute: () => number;
}

export function createFakePlayer(options: FakePlayerOptions): FakePlayer {
  const { durations, withoutTrackDurations = false } = options;
  let index = options.index;
  let position = options.position;
  let playing = options.playing ?? false;

  const queue = durations.map((duration, i) => ({
    bookId: 'book-1',
    mediaId: `book-1_ch${i}`,
    ...(withoutTrackDurations ? {} : { duration }),
  }));

  const activate = (next: number) => {
    index = Math.max(0, Math.min(next, durations.length - 1));
    position = 0;
  };

  const api = {
    getPlaybackState: jest.fn(async () => ({
      state: playing ? 'playing' : 'paused',
    })),
    getProgress: jest.fn(async () => ({
      position,
      duration: durations[index],
      buffered: durations[index],
    })),
    getQueue: jest.fn(async () => queue),
    getActiveTrackIndex: jest.fn(async () => index),
    getActiveTrack: jest.fn(async () => queue[index]),
    seekTo: jest.fn(async (target: number) => {
      // Native clamps into the active item — the whole reason this bug exists.
      position = Math.max(0, Math.min(target, durations[index]));
    }),
    skipToNext: jest.fn(async () => activate(index + 1)),
    skipToPrevious: jest.fn(async () => activate(index - 1)),
    skip: jest.fn(async (target: number) => activate(target)),
    play: jest.fn(async () => {
      playing = true;
    }),
    pause: jest.fn(async () => {
      playing = false;
    }),
  };

  return {
    api,
    at: () => ({ index, position }),
    isPlaying: () => playing,
    absolute: () =>
      durations.slice(0, index).reduce((sum, d) => sum + d, 0) + position,
  };
}
