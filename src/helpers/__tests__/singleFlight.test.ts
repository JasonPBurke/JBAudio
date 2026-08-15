import { singleFlight } from '../singleFlight';

/** A promise whose settlement this test controls. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Drains pending microtasks. Counting `await Promise.resolve()` ticks is not
 * reliable here — Babel compiles async/await to generators, so the number of
 * ticks a continuation takes is an artifact of the transpiler, not behaviour.
 */
function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('singleFlight', () => {
  it('runs the operation once when a second call arrives mid-flight', async () => {
    const d = deferred<void>();
    const run = jest.fn(() => d.promise);
    const guarded = singleFlight(run);

    const first = guarded();
    const second = guarded();

    expect(run).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);

    d.resolve();
    await Promise.all([first, second]);
  });

  it('starts a new run for a call made after the previous one resolved', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const run = jest
      .fn<Promise<string>, []>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const guarded = singleFlight(run);

    const a = guarded();
    first.resolve('first run');
    await expect(a).resolves.toBe('first run');

    const b = guarded();
    second.resolve('second run');

    expect(run).toHaveBeenCalledTimes(2);
    expect(b).not.toBe(a);
    await expect(b).resolves.toBe('second run');
  });

  // A guard that fails to clear on rejection latches for the lifetime of the
  // process: one failed run and the operation can never be started again.
  it('starts a new run for a call made after the previous one rejected', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const run = jest
      .fn<Promise<string>, []>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const guarded = singleFlight(run);

    const a = guarded();
    first.reject(new Error('scan blew up'));
    await expect(a).rejects.toThrow('scan blew up');

    const b = guarded();
    second.resolve('recovered');

    expect(run).toHaveBeenCalledTimes(2);
    await expect(b).resolves.toBe('recovered');
  });

  it('delivers the failure to every caller that joined the run', async () => {
    const d = deferred<void>();
    const guarded = singleFlight(() => d.promise);

    const first = guarded();
    const second = guarded();

    d.reject(new Error('scan blew up'));

    await expect(first).rejects.toThrow('scan blew up');
    await expect(second).rejects.toThrow('scan blew up');
  });

  // The wrapper's declared return type is a promise, so a synchronous throw
  // must surface as a rejection rather than at the call site — otherwise a
  // caller's `.catch()` never runs and the throw escapes to the caller's frame.
  it('reports a synchronous throw as a rejected promise, and does not latch', async () => {
    const run = jest
      .fn<Promise<string>, []>()
      .mockImplementationOnce(() => {
        throw new Error('threw before returning');
      })
      .mockResolvedValueOnce('recovered');
    const guarded = singleFlight(run);

    await expect(guarded()).rejects.toThrow('threw before returning');
    await expect(guarded()).resolves.toBe('recovered');
  });
});

// `afterCurrent` exists for callers that changed something the operation reads
// on entry. Joining a run that started before the change would silently miss
// it, so these callers need a run that is guaranteed to begin afterwards.
describe('singleFlight afterCurrent', () => {
  it('waits for the run in flight, then starts a fresh one', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const run = jest
      .fn<Promise<string>, []>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const guarded = singleFlight(run);

    const stale = guarded();
    const fresh = guarded.afterCurrent();

    // Still waiting on the first run — no second run may start yet.
    await flush();
    expect(run).toHaveBeenCalledTimes(1);

    first.resolve('stale run');
    await stale;
    await flush();
    expect(run).toHaveBeenCalledTimes(2);

    second.resolve('fresh run');
    await expect(fresh).resolves.toBe('fresh run');
  });

  // The common case: nothing is running, so there is nothing stale to wait for
  // and a single run already observes the caller's change.
  it('starts exactly one run when nothing is in flight', async () => {
    const run = jest.fn<Promise<string>, []>().mockResolvedValue('only run');
    const guarded = singleFlight(run);

    await expect(guarded.afterCurrent()).resolves.toBe('only run');

    expect(run).toHaveBeenCalledTimes(1);
  });

  // The run in flight is answering a question this caller did not ask, so its
  // failure must not become this caller's failure.
  it('still starts a fresh run when the run in flight rejected, and hides that failure', async () => {
    const stale = deferred<string>();
    const run = jest
      .fn<Promise<string>, []>()
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce('fresh run');
    const guarded = singleFlight(run);

    const joined = guarded();
    const fresh = guarded.afterCurrent();

    stale.reject(new Error('stale scan blew up'));
    await expect(joined).rejects.toThrow('stale scan blew up');

    await expect(fresh).resolves.toBe('fresh run');
    expect(run).toHaveBeenCalledTimes(2);
  });

  // Two folders added in quick succession must not queue two extra runs: one
  // run that starts after both changes already observes both.
  it('coalesces concurrent afterCurrent callers onto a single fresh run', async () => {
    const stale = deferred<string>();
    const run = jest
      .fn<Promise<string>, []>()
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce('fresh run');
    const guarded = singleFlight(run);

    guarded();
    const a = guarded.afterCurrent();
    const b = guarded.afterCurrent();

    stale.resolve('stale run');

    await expect(a).resolves.toBe('fresh run');
    await expect(b).resolves.toBe('fresh run');
    expect(run).toHaveBeenCalledTimes(2);
  });
});
