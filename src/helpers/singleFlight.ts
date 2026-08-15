/**
 * Wraps an async operation so that overlapping calls share one run.
 *
 * While a run is in flight, further calls receive that run's promise instead of
 * starting a second one. Once it settles the wrapper returns to idle, so a later
 * call starts a genuinely new run.
 */
export function singleFlight<T>(run: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | null = null;

  return () => {
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
}
