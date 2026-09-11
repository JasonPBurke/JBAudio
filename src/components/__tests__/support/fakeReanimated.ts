/**
 * A behaviour-faithful stand-in for the three Reanimated APIs
 * `PlayerProgressBar` uses, built to reproduce a scheduling bug that a
 * value-only stub cannot express.
 *
 * Trap 3 in docs/testing/jest-projects-and-rn-tests.md says a suite that
 * imports reanimated must carry its own stub, because the shipped `/mock`
 * entry point re-enters the real index and dies in worklets' native half.
 * `PlayerControls.rn.test.tsx` gets away with ten inline lines because it only
 * needs shared values to HOLD a number. This suite needs them to SCHEDULE, so
 * the stub models the two things the real runtime does that a plain object
 * does not:
 *
 *   1. A mapper re-runs only when a shared value read inside its PREPARE
 *      function changes. Values read inside the reaction body are invisible to
 *      the dependency tracker -- which is the whole bug.
 *   2. A mapper runs on the UI thread at frame granularity, and `runOnJS`
 *      hands its already-captured arguments back to the JS thread LATER. A
 *      write that lands between capture and delivery does not change what was
 *      captured.
 *
 * Both are driven manually here (`frame()`, `flushJs()`) so a test can pin an
 * interleaving instead of racing one.
 */

type Prepare = () => unknown;
type React_ = (current: unknown, previous: unknown) => void;

type Mapper = {
  prepare: Prepare;
  react: React_;
  inputs: Set<FakeShared<unknown>>;
  previous: unknown;
  hasRun: boolean;
  dirty: boolean;
};

export type FakeShared<T> = { value: T };

class FakeReanimatedRuntime {
  private mappers: Mapper[] = [];
  private jsQueue: (() => void)[] = [];
  /** Non-null only while a prepare function is being evaluated. */
  private tracking: Set<FakeShared<unknown>> | null = null;

  createShared<T>(initial: T): FakeShared<T> {
    const runtime = this;
    let current = initial;
    const shared: FakeShared<T> = {
      get value() {
        runtime.tracking?.add(shared as FakeShared<unknown>);
        return current;
      },
      set value(next: T) {
        if (Object.is(current, next)) return;
        current = next;
        runtime.markDirty(shared as FakeShared<unknown>);
      },
    };
    return shared;
  }

  registerMapper(prepare: Prepare, react: React_): Mapper {
    const mapper: Mapper = {
      prepare,
      react,
      inputs: new Set(),
      previous: undefined,
      hasRun: false,
      dirty: true,
    };
    this.mappers.push(mapper);
    return mapper;
  }

  removeMapper(mapper: Mapper) {
    this.mappers = this.mappers.filter((m) => m !== mapper);
  }

  /** Evaluate `fn`, recording every shared value it reads. */
  private trackReads(fn: Prepare, into: Set<FakeShared<unknown>>) {
    const outer = this.tracking;
    this.tracking = into;
    try {
      return fn();
    } finally {
      this.tracking = outer;
    }
  }

  private markDirty(shared: FakeShared<unknown>) {
    for (const mapper of this.mappers) {
      if (!mapper.hasRun || mapper.inputs.has(shared)) mapper.dirty = true;
    }
  }

  /**
   * One UI-thread frame: every mapper with a changed input runs, and anything
   * it hands to `runOnJS` is queued rather than called.
   */
  frame() {
    for (const mapper of this.mappers) {
      if (!mapper.dirty) continue;
      mapper.dirty = false;
      const inputs = new Set<FakeShared<unknown>>();
      const current = this.trackReads(mapper.prepare, inputs);
      mapper.inputs = inputs;
      // `null` on the first run, matching the real hook's `T | null`.
      const previous = mapper.hasRun ? mapper.previous : null;
      mapper.hasRun = true;
      mapper.previous = current;
      mapper.react(current, previous);
    }
  }

  /** Deliver everything `runOnJS` captured, in order. */
  flushJs() {
    const queued = this.jsQueue;
    this.jsQueue = [];
    queued.forEach((call) => call());
  }

  enqueueJs(call: () => void) {
    this.jsQueue.push(call);
  }

  reset() {
    this.mappers = [];
    this.jsQueue = [];
  }
}

/**
 * One runtime per test file. The jest module registry hands the mock factory
 * and the test the same instance, which is what lets the test drive frames.
 */
export const fakeReanimated = new FakeReanimatedRuntime();

/** The `react-native-reanimated` surface `PlayerProgressBar` imports. */
export const createReanimatedMock = () => {
  // Required, not imported: this runs inside a hoisted jest.mock factory.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useRef, useEffect } = require('react') as typeof import('react');
  return {
    __esModule: true,
    useSharedValue: <T,>(initial: T) => {
      const ref = useRef<FakeShared<T> | null>(null);
      if (!ref.current) ref.current = fakeReanimated.createShared(initial);
      return ref.current;
    },
    // Lazily evaluated: the real one recomputes on the UI thread whenever an
    // input moves, so reading it always reflects the current inputs.
    useDerivedValue: <T,>(fn: () => T) => ({
      get value() {
        return fn();
      },
    }),
    useAnimatedReaction: (prepare: Prepare, react: React_) => {
      // Registered once, like the real hook with `[]` deps.
      useEffect(() => {
        const mapper = fakeReanimated.registerMapper(prepare, react);
        return () => fakeReanimated.removeMapper(mapper);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
    },
  };
};

/** The `react-native-worklets` surface: a deferred UI -> JS hop. */
export const createWorkletsMock = () => ({
  __esModule: true,
  runOnJS:
    <A extends unknown[]>(fn: (...args: A) => void) =>
    (...args: A) =>
      fakeReanimated.enqueueJs(() => fn(...args)),
});
