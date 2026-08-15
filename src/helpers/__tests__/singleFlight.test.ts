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
