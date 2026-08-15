/**
 * An operation that cannot run concurrently with itself.
 *
 * Calling it joins the run already under way, if there is one. `afterCurrent`
 * is for callers who need a run that *starts* after they called.
 */
export type SingleFlight<T> = {
  (): Promise<T>;
  afterCurrent(): Promise<T>;
};

/**
 * Wraps an async operation so that overlapping calls share one run.
 *
 * While a run is in flight, further calls receive that run's promise instead of
 * starting a second one. Once it settles the wrapper returns to idle, so a later
 * call starts a genuinely new run.
 */
export function singleFlight<T>(run: () => Promise<T>): SingleFlight<T> {
  let inFlight: Promise<T> | null = null;

  const call = (): Promise<T> => {
    if (inFlight !== null) return inFlight;

    // `run()` is called inside the executor so that a synchronous throw becomes
    // a rejection rather than escaping to the caller's frame — the return type
    // promises a promise, and an unawaited caller has no try/catch to hit. The
    // executor runs synchronously, so this does not delay the operation by a
    // microtask the way `Promise.resolve().then(run)` would.
    inFlight = new Promise<T>((resolve) => resolve(run())).finally(() => {
      inFlight = null;
    });

    return inFlight;
  };

  /**
   * Runs the operation, guaranteeing it STARTS after this call was made.
   *
   * A plain call joins whatever is already running, which is wrong for a caller
   * that has just changed something the operation reads when it starts — the
   * run in flight read the old state and will never see the change. This waits
   * for that run to finish and then starts a new one.
   *
   * ⚠ The run in flight is awaited but its OUTCOME IS DISCARDED, failure
   * included. It is answering a question this caller did not ask, and its
   * failure says nothing about whether this caller's run can succeed. Only the
   * fresh run's outcome is returned.
   *
   * Concurrent `afterCurrent` callers coalesce onto one fresh run rather than
   * queueing a run each: the run they share starts after all of them called, so
   * it observes all of their changes.
   */
  const afterCurrent = async (): Promise<T> => {
    if (inFlight !== null) {
      await inFlight.catch(() => undefined);
    }
    return call();
  };

  return Object.assign(call, { afterCurrent });
}
