import {
  __configureLadderInstrumentation,
  armAnchorFix,
  ladderInstrumentationEnabled,
  logLadderPress,
  logLadderSettle,
  probeFirstItemOffset,
  sampleDriftAfterSweep,
} from '../ladderInstrumentation';
import type { BackPressDecision, SweepDecision } from '../ladderDecisions';

/**
 * Ticket 08's device-pass instrumentation.
 *
 * ⚠ This suite's FIRST job is the one that protects the app: prove the module
 * is INERT unless something turns it on. Every other assertion here runs
 * against an explicitly-configured instance, so a regression that flipped the
 * default would still pass them -- the default test is the only one that
 * cannot be fooled that way.
 */

const scrollTo: BackPressDecision = { kind: 'scrollTo', offset: 900, rung: 'section' };
const declineAtTop: BackPressDecision = { kind: 'decline', reason: 'at-top' };
const noSweep: SweepDecision = { kind: 'none', reason: 'not-at-top' };
const collapse = (open: string[]): SweepDecision => ({
  kind: 'collapse',
  open: new Set(open),
  visibleIds: new Set(open),
});

/** A configured instance plus the lines it wrote and the timers it queued. */
function rig(patch: Parameters<typeof __configureLadderInstrumentation>[0] = {}) {
  const lines: string[] = [];
  const timers: { fn: () => void; ms: number }[] = [];
  let clock = 1000;
  __configureLadderInstrumentation({
    enabled: true,
    sink: (line) => lines.push(line),
    now: () => clock,
    schedule: (fn, ms) => timers.push({ fn, ms }),
    ...patch,
  });
  return {
    lines,
    timers,
    advance: (ms: number) => {
      clock += ms;
    },
    runTimers: () => {
      const due = timers.splice(0, timers.length);
      for (const t of due) t.fn();
    },
  };
}

afterEach(() => {
  // Back to the built-in defaults, so no test can leak an enabled module into
  // the next file's import of the same singleton.
  __configureLadderInstrumentation();
});

describe('the default configuration', () => {
  it('is disabled under jest, so nothing is logged and the anchor fix stays armed', () => {
    const sink = jest.fn();
    __configureLadderInstrumentation({ sink });

    expect(ladderInstrumentationEnabled()).toBe(false);

    logLadderPress({ view: 'booksHome', offset: 10, firstItemOffset: 38, decision: scrollTo });
    logLadderSettle({
      view: 'booksHome',
      trigger: 'momentum',
      offset: 0,
      firstItemOffset: 38,
      expandedCount: 3,
      decision: collapse(['a']),
    });

    // The load-bearing half: shipping behaviour is the fix ON, always.
    expect(armAnchorFix()).toBe(true);
    expect(sink).not.toHaveBeenCalled();
  });
});

describe('press and settle sequencing (the momentum-end count)', () => {
  it('counts the settles that follow each press, with the gap since the press', () => {
    const r = rig();

    logLadderPress({ view: 'booksHome', offset: 1234.5, firstItemOffset: 38, decision: scrollTo });
    r.advance(140);
    logLadderSettle({
      view: 'booksHome',
      trigger: 'momentum',
      offset: 900,
      firstItemOffset: 38,
      expandedCount: 2,
      decision: noSweep,
    });
    r.advance(20);
    logLadderSettle({
      view: 'booksHome',
      trigger: 'momentum',
      offset: 0,
      firstItemOffset: 38,
      expandedCount: 3,
      decision: collapse(['recents']),
    });

    expect(r.lines).toEqual([
      '[LADDER] press#1 view=booksHome offset=1234.5 first=38.0 -> scrollTo/section@900.0',
      '[LADDER] settle#1 momentum since=press#1/+140ms/n=1 view=booksHome offset=900.0 first=38.0 vel=- -> none/not-at-top',
      '[LADDER] settle#2 momentum since=press#1/+160ms/n=2 view=booksHome offset=0.0 first=38.0 vel=- -> collapse/dropped=2',
    ]);
  });

  it('restarts the per-press count on the next press', () => {
    const r = rig();

    logLadderPress({ view: 'booksHome', offset: 1000, firstItemOffset: 38, decision: scrollTo });
    logLadderSettle({
      view: 'booksHome',
      trigger: 'momentum',
      offset: 0,
      firstItemOffset: 38,
      expandedCount: 1,
      decision: noSweep,
    });
    logLadderPress({ view: 'booksHome', offset: 0, firstItemOffset: 38, decision: declineAtTop });
    logLadderSettle({
      view: 'booksHome',
      trigger: 'momentum',
      offset: 0,
      firstItemOffset: 38,
      expandedCount: 1,
      decision: noSweep,
    });

    expect(r.lines[1]).toContain('since=press#1/+0ms/n=1');
    expect(r.lines[2]).toBe('[LADDER] press#2 view=booksHome offset=0.0 first=38.0 -> decline/at-top');
    expect(r.lines[3]).toContain('since=press#2/+0ms/n=1');
  });

  it('marks a settle that follows no press at all', () => {
    const r = rig();

    logLadderSettle({
      view: 'booksHome',
      trigger: 'drag',
      velocityY: -0.004,
      offset: 0,
      firstItemOffset: 38,
      expandedCount: 2,
      decision: collapse(['recents', 'weir']),
    });

    expect(r.lines).toEqual([
      '[LADDER] settle#1 drag since=none view=booksHome offset=0.0 first=38.0 vel=-0.0040 -> collapse/dropped=0',
    ]);
  });
});

describe('the anchor-fix A/B arm', () => {
  it('alternates on/off across runs and names the arm', () => {
    const r = rig({ anchorFix: 'alternate' });

    expect([armAnchorFix(), armAnchorFix(), armAnchorFix(), armAnchorFix()]).toEqual([
      true,
      false,
      true,
      false,
    ]);
    expect(r.lines).toEqual([
      '[LADDER] anchorFix run#1 arm=on',
      '[LADDER] anchorFix run#2 arm=off',
      '[LADDER] anchorFix run#3 arm=on',
      '[LADDER] anchorFix run#4 arm=off',
    ]);
  });

  it('can be pinned to one arm for a whole session', () => {
    rig({ anchorFix: 'off' });
    expect([armAnchorFix(), armAnchorFix()]).toEqual([false, false]);

    rig({ anchorFix: 'on' });
    expect([armAnchorFix(), armAnchorFix()]).toEqual([true, true]);
  });
});

describe('the drift sample', () => {
  it('reads the resting offset after the sweep and reports it against its own run', () => {
    const r = rig({ anchorFix: 'alternate' });

    armAnchorFix(); // run#1, on
    sampleDriftAfterSweep(() => 0.4);
    armAnchorFix(); // run#2, off
    sampleDriftAfterSweep(() => -617.2);

    expect(r.timers.map((t) => t.ms)).toEqual([600, 600]);
    r.runTimers();

    expect(r.lines.slice(-2)).toEqual([
      '[LADDER] drift run#1 arm=on offset=0.4 after=600ms',
      '[LADDER] drift run#2 arm=off offset=-617.2 after=600ms',
    ]);
  });

  it('survives a list that has gone away by the time the sample is due', () => {
    const r = rig();
    armAnchorFix();
    sampleDriftAfterSweep(() => {
      throw new Error('unmounted');
    });

    expect(() => r.runTimers()).not.toThrow();
    expect(r.lines.at(-1)).toBe('[LADDER] drift run#1 arm=on offset=unreadable after=600ms');
  });

  it('does nothing at all when disabled', () => {
    const sink = jest.fn();
    const schedule = jest.fn();
    __configureLadderInstrumentation({ sink, schedule });

    sampleDriftAfterSweep(() => 0);

    expect(schedule).not.toHaveBeenCalled();
    expect(sink).not.toHaveBeenCalled();
  });
});

describe('the per-view first-item offset probe', () => {
  it('reports the value once the list has a layout, naming the view', () => {
    const r = rig();

    probeFirstItemOffset('seriesHome', () => 44);
    r.runTimers();

    expect(r.lines).toEqual(['[LADDER] first view=seriesHome value=44.0 attempt=1']);
  });

  it('retries while the list still reads zero or nothing, then reports', () => {
    const r = rig();
    const reads = [undefined, 0, 38];

    probeFirstItemOffset('booksHome', () => reads.shift());
    r.runTimers();
    expect(r.lines).toEqual([]);
    r.runTimers();
    expect(r.lines).toEqual([]);
    r.runTimers();

    expect(r.lines).toEqual(['[LADDER] first view=booksHome value=38.0 attempt=3']);
  });

  it('reports an unresolved value on the last attempt rather than staying silent', () => {
    const r = rig();

    probeFirstItemOffset('booksGrid', () => 0);
    for (let i = 0; i < 10; i++) r.runTimers();

    expect(r.lines).toEqual(['[LADDER] first view=booksGrid value=0.0 attempt=4/UNRESOLVED']);
  });

  it('stops when the view is left before the value resolves', () => {
    const r = rig();

    const cancel = probeFirstItemOffset('booksGrid', () => 44);
    cancel();
    r.runTimers();

    expect(r.lines).toEqual([]);
  });

  it('reports each view once, and again only if its value changes', () => {
    const r = rig();

    probeFirstItemOffset('booksHome', () => 38);
    r.runTimers();
    probeFirstItemOffset('booksHome', () => 38);
    r.runTimers();
    probeFirstItemOffset('booksHome', () => 52);
    r.runTimers();

    expect(r.lines).toEqual([
      '[LADDER] first view=booksHome value=38.0 attempt=1',
      '[LADDER] first view=booksHome value=52.0 attempt=1',
    ]);
  });

  it('does not probe at all when disabled', () => {
    const schedule = jest.fn();
    __configureLadderInstrumentation({ schedule });

    probeFirstItemOffset('booksHome', () => 38);

    expect(schedule).not.toHaveBeenCalled();
  });
});
