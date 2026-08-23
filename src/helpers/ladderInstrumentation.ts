import type { BackPressDecision, LadderView, SweepDecision } from './ladderDecisions';

/**
 * The back-to-top ladder's DEVICE-PASS INSTRUMENTATION -- ticket 08's three
 * deferred items, and nothing else.
 *
 * ⚠ THIS MODULE IS A MEASURING INSTRUMENT, NOT A FEATURE. Ticket 09 deletes it
 * whole, together with the prototype's MVCP probe in `node_modules`. It exists
 * because three checklist items are not observable on an ordinary build:
 *
 *   1. HOW MANY momentum-end events one back press produces (once on a clean
 *      press, twice when the press interrupts a fling). The sweep is idempotent
 *      by design precisely so the count cannot matter -- but "cannot matter" is
 *      a claim about a number nobody has read.
 *   2. Each view's `getFirstItemOffset()`, READ rather than assumed. The
 *      expected 38 / 38 / 44 comes from the prototype; the fourth list has
 *      never been measured by any device.
 *   3. The MVCP anchor-fix drift A/B, which needs a fix-OFF arm -- and F-11's
 *      one-binary rule forbids answering it with a second build.
 *
 * ⚠ The A/B arm is the reason this is a module rather than three `console.log`
 * calls. Item 3 was deferred BECAUSE fix-off meant a second binary; making the
 * arm a runtime alternation collapses the A/B into ONE build, which is both
 * what F-11 requires and a better experiment -- the two arms then interleave on
 * the same device, the same library and the same session, so nothing but the
 * arm differs between consecutive runs.
 *
 * Output goes to `console.log`, which ticket 08's session 3 established REACHES
 * LOGCAT IN A PREVIEW BUILD under tag `ReactNativeJS`. That is the whole reason
 * these three items are cheap now: instrumentation does not need a debug build,
 * and a debug build could not answer them anyway (assets over Metro, §D of the
 * ticket).
 *
 *   adb logcat -s ReactNativeJS | grep LADDER
 */

/** `on`/`off` pins the arm for a whole session; `alternate` runs the A/B. */
export type AnchorFixMode = 'alternate' | 'on' | 'off';

export type LadderInstrumentationConfig = {
  /**
   * The master switch, and the ONLY thing standing between a shipping build and
   * a per-sweep `console.log` + a deliberately-broken anchor fix.
   */
  enabled: boolean;
  anchorFix: AnchorFixMode;
  sink: (line: string) => void;
  now: () => number;
  schedule: (fn: () => void, ms: number) => void;
};

/**
 * ⚠ `enabled` defaults to FALSE UNDER JEST, and that is not test hygiene -- it
 * is what keeps the suite honest. In `alternate` mode the anchor fix is
 * deliberately withheld on every other sweep, so an instrumentation module that
 * was live under jest would make `useBackToTopLadder`'s
 * `prepareForLayoutAnimationRender` assertions pass or fail by parity. The hook
 * suite instead configures this module EXPLICITLY when it wants to prove the
 * lever moves, which is the only way that assertion means anything.
 *
 * `process.env.NODE_ENV` is inlined by babel in a release bundle, so the check
 * costs nothing on device.
 */
const BUILD_DEFAULTS: LadderInstrumentationConfig = {
  enabled: process.env.NODE_ENV !== 'test',
  anchorFix: 'alternate',
  sink: (line) => console.log(line),
  now: () => Date.now(),
  schedule: (fn, ms) => {
    setTimeout(fn, ms);
  },
};

let config: LadderInstrumentationConfig = { ...BUILD_DEFAULTS };

/** Presses and settles are numbered from the same session start. */
let pressSeq = 0;
let settleSeq = 0;
let settlesSincePress = 0;
let lastPressAt: number | null = null;
let anchorRun = 0;
let lastArm: 'on' | 'off' = 'on';
const reportedFirstItemOffsets = new Map<LadderView, number>();

/**
 * Reconfigure AND reset every counter. Tests only -- the device build never
 * calls it, which is why the shape it restores is the build default rather than
 * whatever the last caller passed.
 */
export function __configureLadderInstrumentation(
  patch: Partial<LadderInstrumentationConfig> = {},
): void {
  config = { ...BUILD_DEFAULTS, ...patch };
  pressSeq = 0;
  settleSeq = 0;
  settlesSincePress = 0;
  lastPressAt = null;
  anchorRun = 0;
  lastArm = 'on';
  reportedFirstItemOffsets.clear();
}

export function ladderInstrumentationEnabled(): boolean {
  return config.enabled;
}

function emit(line: string): void {
  config.sink(`[LADDER] ${line}`);
}

/** One decimal is finer than any effect being measured and keeps lines short. */
const num = (n: number | undefined): string =>
  n === undefined ? '-' : n.toFixed(1);

/**
 * Velocity gets FOUR decimals because the gate it feeds is 0.01: at one decimal
 * every settled lift and every slow fling print as `-0.0`, which is exactly the
 * distinction §F4 and D-3 turn on.
 */
const vel = (v: number | undefined): string => (v === undefined ? '-' : v.toFixed(4));

const describeBackPress = (d: BackPressDecision): string =>
  d.kind === 'decline' ? `decline/${d.reason}` : `scrollTo/${d.rung}@${num(d.offset)}`;

export type LadderPressLog = {
  view: LadderView;
  /** Absent when no list is mounted -- the `no-list` decline. */
  offset?: number;
  firstItemOffset?: number;
  decision: BackPressDecision;
};

export function logLadderPress({
  view,
  offset,
  firstItemOffset,
  decision,
}: LadderPressLog): void {
  if (!config.enabled) return;

  pressSeq += 1;
  settlesSincePress = 0;
  lastPressAt = config.now();

  emit(
    `press#${pressSeq} view=${view} offset=${num(offset)} first=${num(firstItemOffset)} ` +
      `-> ${describeBackPress(decision)}`,
  );
}

export type LadderSettleLog = {
  view: LadderView;
  trigger: 'momentum' | 'drag';
  velocityY?: number;
  offset: number;
  firstItemOffset: number;
  /** The size of the COMMITTED expanded set, so `dropped` can be reported. */
  expandedCount: number;
  decision: SweepDecision;
};

/**
 * ⚠ Logged for EVERY settle, including the ones the sweep declines. The count
 * is the observable ticket 08 asks for, and a line written only when the sweep
 * fires would answer a different question: an interrupted fling's first
 * momentum end lands at a non-top offset and declines, and that decline IS the
 * second event.
 */
export function logLadderSettle({
  view,
  trigger,
  velocityY,
  offset,
  firstItemOffset,
  expandedCount,
  decision,
}: LadderSettleLog): void {
  if (!config.enabled) return;

  settleSeq += 1;
  settlesSincePress += 1;

  const since =
    lastPressAt === null
      ? 'none'
      : `press#${pressSeq}/+${config.now() - lastPressAt}ms/n=${settlesSincePress}`;

  const outcome =
    decision.kind === 'none'
      ? `none/${decision.reason}`
      : `collapse/dropped=${expandedCount - decision.open.size}`;

  emit(
    `settle#${settleSeq} ${trigger} since=${since} view=${view} ` +
      `offset=${num(offset)} first=${num(firstItemOffset)} vel=${vel(velocityY)} -> ${outcome}`,
  );
}

/**
 * Should this sweep apply the MVCP anchor fix (§G1/§G2)?
 *
 * ⚠ Returns TRUE when instrumentation is disabled, and that direction is the
 * safe one by construction rather than by convention: `true` is the shipping
 * behaviour, so the only way this module can change what a real build does is
 * by being switched ON deliberately.
 */
export function armAnchorFix(): boolean {
  if (!config.enabled) return true;

  anchorRun += 1;
  lastArm =
    config.anchorFix === 'alternate'
      ? anchorRun % 2 === 1
        ? 'on'
        : 'off'
      : config.anchorFix;

  emit(`anchorFix run#${anchorRun} arm=${lastArm}`);
  return lastArm === 'on';
}

/**
 * How long after the sweep the resting offset is read.
 *
 * MVCP's correction is issued from FlashList's own commit effect, so it lands
 * within a frame or two of the mutation; 600 ms is far past that and still
 * inside the window before a reader could plausibly have scrolled again. It is
 * a probe interval, not a race -- if the number is ambiguous the prototype's
 * `[DT]` probe in `node_modules` prints the correction's `diff` directly.
 */
const DRIFT_SAMPLE_MS = 600;

/**
 * The A/B's OUTCOME measure: where the list actually came to rest after a sweep
 * that mutated the data. Fix on, this should be at top; fix off, the prototype
 * saw it dragged hundreds of px back down the list.
 */
export function sampleDriftAfterSweep(readOffset: () => number): void {
  if (!config.enabled) return;

  const run = anchorRun;
  const arm = lastArm;

  config.schedule(() => {
    let offset: string;
    try {
      offset = num(readOffset());
    } catch {
      // The list can unmount between the sweep and the sample. An instrument
      // that crashes the screen it is measuring is worse than one that admits
      // it missed a reading.
      offset = 'unreadable';
    }
    emit(`drift run#${run} arm=${arm} offset=${offset} after=${DRIFT_SAMPLE_MS}ms`);
  }, DRIFT_SAMPLE_MS);
}

/**
 * The retry ladder for the first-item-offset probe.
 *
 * `firstItemOffset` is a plain field on FlashList's manager, populated once the
 * list has measured its header -- so it reads `0` for the first frames of a
 * mount, and on a cold start behind a 355-book scan that can be a while. Four
 * attempts over ~8 s, then report whatever it says AND say it never resolved,
 * because a silent probe is indistinguishable from a broken one.
 */
const FIRST_ITEM_PROBE_MS = [300, 800, 2000, 5000];

/**
 * Read one view's `getFirstItemOffset()` and report it once.
 *
 * Deliberately NOT read at press time: the ticket wants a number per VIEW, and
 * pressing back in each view to get one is exactly the manual step this is
 * meant to remove. Returns its own canceller, so leaving the view before the
 * value resolves stops the probe rather than reporting the outgoing list's
 * number under the incoming view's name.
 */
export function probeFirstItemOffset(
  view: LadderView,
  readOffset: () => number | undefined,
): () => void {
  if (!config.enabled) return () => {};

  let cancelled = false;

  const attempt = (n: number): void => {
    if (cancelled) return;

    let value: number | undefined;
    try {
      value = readOffset();
    } catch {
      value = undefined;
    }

    const resolved = value !== undefined && Number.isFinite(value) && value !== 0;
    const last = n === FIRST_ITEM_PROBE_MS.length;

    if (!resolved && !last) {
      config.schedule(() => attempt(n + 1), FIRST_ITEM_PROBE_MS[n]);
      return;
    }

    // Report a CHANGE as well as a first sighting: the offset is the header
    // spacer's height, and a view whose number moves between mounts is itself
    // a finding.
    if (reportedFirstItemOffsets.get(view) === value) return;
    reportedFirstItemOffsets.set(view, value ?? NaN);

    emit(
      `first view=${view} value=${num(value)} attempt=${n}${resolved ? '' : '/UNRESOLVED'}`,
    );
  };

  config.schedule(() => attempt(1), FIRST_ITEM_PROBE_MS[0]);
  return () => {
    cancelled = true;
  };
}
