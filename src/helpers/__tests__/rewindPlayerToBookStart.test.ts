import { rewindPlayerToBookStart } from '../rewindPlayerToBookStart';
import { queueShapeOf } from '../queueShape';
import { createFakePlayer, type FakePlayer } from './support/fakePlayer';
import {
  oneChapterBookChapters,
  multiItemChapters,
} from './support/queueShapeFixtures';

/*
 * The transport half of finishing a Book, run against the simulated player
 * (see `support/fakePlayer.ts`) rather than against call spies alone.
 *
 * ⚠ ON A ONE-ITEM QUEUE THE TWO ARMS LAND IN THE SAME PLACE. `seekTo(0)` and
 * `skip(0)` both leave the listener at 0:00 when the Queue has a single item,
 * so `player.at()` cannot tell them apart and the assertion has to name the
 * transport. The landing spot only diverges on a MULTI-ITEM Queue — where
 * `seekTo(0)` would restart the last chapter and leave the Book unrewound —
 * which is why both shapes are tested and why the multi-item case asserts on
 * the index.
 */

let mockPlayer: FakePlayer;

jest.mock('react-native-track-player', () => ({
  __esModule: true,
  default: {
    seekTo: (...a: unknown[]) => mockPlayer.api.seekTo(...a),
    skip: (...a: unknown[]) => mockPlayer.api.skip(...a),
  },
}));

describe('rewindPlayerToBookStart', () => {
  it('seeks to 0 on a one-item Queue, without touching the queue position', async () => {
    mockPlayer = createFakePlayer({
      durations: [36000],
      index: 0,
      position: 35999,
    });

    await rewindPlayerToBookStart('one-item');

    expect(mockPlayer.at()).toEqual({ index: 0, position: 0 });
    expect(mockPlayer.api.seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayer.api.skip).not.toHaveBeenCalled();
  });

  it('skips to the first item on a multi-item Queue', async () => {
    mockPlayer = createFakePlayer({
      durations: [600, 600, 600],
      index: 2,
      position: 599,
    });

    await rewindPlayerToBookStart('multi-item');

    expect(mockPlayer.at()).toEqual({ index: 0, position: 0 });
    expect(mockPlayer.api.skip).toHaveBeenCalledWith(0);
    expect(mockPlayer.api.seekTo).not.toHaveBeenCalled();
  });
});

/*
 * The verdict driving the transport, on the shape the correction is about.
 *
 * A Book with exactly ONE chapter used to be claimed by two contradictory
 * shape predicates at once; `queueShapeOf` calls it what it is. See
 * `.scratch/queue-shape/issues/03-one-chapter-flip.md` for where that
 * actually changes behaviour — it is the queue BUILDERS, pinned in
 * `handleBookPlay.test.ts`. What these two cases pin is narrower and still
 * worth having: that the end-of-queue reset asks the verdict at all, and
 * lands on the seek arm for a one-chapter Book.
 */
describe('rewindPlayerToBookStart — a one-chapter Book', () => {
  it('seeks rather than skips, because its Queue has one item', async () => {
    const chapters = oneChapterBookChapters();
    mockPlayer = createFakePlayer({
      durations: [36000],
      index: 0,
      position: 35999,
    });

    await rewindPlayerToBookStart(queueShapeOf(chapters));

    expect(queueShapeOf(chapters)).toBe('one-item');
    expect(mockPlayer.api.seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayer.api.skip).not.toHaveBeenCalled();
    expect(mockPlayer.at()).toEqual({ index: 0, position: 0 });
  });

  it('still skips for a Book whose chapters are one file each', async () => {
    const chapters = multiItemChapters(3);
    mockPlayer = createFakePlayer({
      durations: [600, 600, 600],
      index: 2,
      position: 599,
    });

    await rewindPlayerToBookStart(queueShapeOf(chapters));

    expect(queueShapeOf(chapters)).toBe('multi-item');
    expect(mockPlayer.api.skip).toHaveBeenCalledWith(0);
    expect(mockPlayer.at()).toEqual({ index: 0, position: 0 });
  });
});
