import {
  handleRemoteSeekPress,
  isRepeatOfLastSeek,
  DUPLICATE_SEEK_WINDOW_MS,
  type RemoteSeekBurst,
} from '../remoteSeekPress';

/*
 * The notification / Android Auto seek-bar press.
 *
 * ── The bug this pins ──
 *
 * ONE tap on the notification seek bar makes the platform hand us the SAME
 * seek TWICE, tens of milliseconds apart (measured on a Pixel 7 Pro: two
 * BUFFERING->PLAYING cycles at an identical target position for one tap).
 * The handler recorded a footprint per event, so the user got two
 * breadcrumbs: the first at the spot they left, the second at the spot they
 * had just landed on -- because by the time the duplicate's position read
 * resolved, the first event's seek had already moved the Player.
 *
 * The second breadcrumb is wrong twice over. It names a place the user never
 * left, and it points AT the destination, which is the one place they can
 * already get back to by doing nothing.
 *
 * ⚠ TWO properties are asserted here and only one of them is visible from a
 * "was it recorded?" count. The other is ORDER: the footprint must be written
 * BEFORE the seek, because it is a breadcrumb back to the PRE-press spot.
 * Recording after the seek still produces exactly one footprint and still
 * passes a count assertion -- and it is precisely the bug the duplicate
 * exposed. See `nextPress` for the same rule on the skip presses.
 */

// The module under test imports the player adapter and the footprint
// recorder for its composition root only; both reach native/SQLite and
// neither is exercised here, where every effect is injected.
jest.mock('react-native-track-player', () => ({
  __esModule: true,
  default: { seekTo: jest.fn() },
}));

jest.mock('@/helpers/activeBookFootprints', () => ({
  recordActiveBookSeekFootprint: jest.fn(),
}));

let order: string[];
let burst: RemoteSeekBurst;

const freshBurst = (): RemoteSeekBurst => ({ targetSeconds: null, atMs: 0 });

/** One remote seek, with the recorder and the transport both traced. */
const press = (
  targetSeconds: number,
  nowMs: number,
  onBeforeSeek: () => Promise<void> | void = () => {
    order.push('footprint');
  },
) =>
  handleRemoteSeekPress({
    targetSeconds,
    nowMs,
    burst,
    onBeforeSeek,
    seek: async (seconds: number) => {
      order.push(`seek:${seconds}`);
    },
  });

beforeEach(() => {
  order = [];
  burst = freshBurst();
});

describe('a single remote seek', () => {
  it('records the breadcrumb BEFORE it seeks', async () => {
    await press(120, 1_000);

    expect(order).toEqual(['footprint', 'seek:120']);
  });
});

describe('the duplicate the platform sends for one press', () => {
  it('seeks again but leaves only ONE breadcrumb', async () => {
    await press(120, 1_000);
    await press(120, 1_061); // the measured ~61ms gap

    expect(order).toEqual(['footprint', 'seek:120', 'seek:120']);
    expect(order.filter((o) => o === 'footprint')).toHaveLength(1);
  });

  it('is caught even when both events are in flight at once', async () => {
    // How they actually arrive: native dispatches the second event while the
    // first handler is still awaiting its position read. Neither run is
    // awaited before the other starts, which is the interleaving the
    // synchronous test-and-set in `handleRemoteSeekPress` exists to survive.
    const first = press(120, 1_000);
    const second = press(120, 1_030);
    await Promise.all([first, second]);

    expect(order.filter((o) => o === 'footprint')).toHaveLength(1);
    expect(order.filter((o) => o.startsWith('seek:'))).toHaveLength(2);
  });

  it('collapses a burst of three, not just a pair', async () => {
    await press(120, 1_000);
    await press(120, 1_030);
    await press(120, 1_070);

    expect(order.filter((o) => o === 'footprint')).toHaveLength(1);
    expect(order.filter((o) => o.startsWith('seek:'))).toHaveLength(3);
  });
});

describe('presses that are NOT the duplicate', () => {
  it('records a second press to a DIFFERENT target inside the window', async () => {
    await press(120, 1_000);
    await press(300, 1_050);

    expect(order).toEqual([
      'footprint',
      'seek:120',
      'footprint',
      'seek:300',
    ]);
  });

  it('records a second press to the same target once the window has passed', async () => {
    await press(120, 1_000);
    await press(120, 1_000 + DUPLICATE_SEEK_WINDOW_MS);

    expect(order.filter((o) => o === 'footprint')).toHaveLength(2);
  });
});

describe('the breadcrumb never costs the user their seek', () => {
  it('seeks even when recording throws', async () => {
    await press(120, 1_000, () => {
      throw new Error('database is having a day');
    });

    expect(order).toEqual(['seek:120']);
  });
});

describe('isRepeatOfLastSeek', () => {
  it('is false before any seek has been served', () => {
    expect(isRepeatOfLastSeek(freshBurst(), 120, 1_000)).toBe(false);
  });

  it('is false exactly ON the window boundary', () => {
    const b: RemoteSeekBurst = { targetSeconds: 120, atMs: 1_000 };

    expect(
      isRepeatOfLastSeek(b, 120, 1_000 + DUPLICATE_SEEK_WINDOW_MS),
    ).toBe(false);
  });

  it('tolerates the float the payload is rebuilt from', () => {
    const b: RemoteSeekBurst = { targetSeconds: 120, atMs: 1_000 };

    expect(isRepeatOfLastSeek(b, 120.0009, 1_010)).toBe(true);
  });
});
