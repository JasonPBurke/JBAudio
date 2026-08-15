import {
  resolveProvenance,
  resolveMembership,
  resolveCanonicalSource,
  canonicalSourceFor,
} from '@/db/seriesProvenance';

/**
 * The v33 provenance columns are all nullable, because `addColumns` cannot
 * backfill a chosen value (spec §K10) — every pre-existing row reads `null`.
 * These readers are the ONE place that null is turned into a value, so the
 * direction of the coalesce is decided once instead of at every call site.
 *
 * The direction is abstention bias: a row wrongly read as 'user' is merely
 * never auto-updated, while a row wrongly read as 'detected' is eligible for
 * a regeneration to clobber it — which destroys a hand-made playlist.
 */
describe('resolveProvenance — origin / name_source', () => {
  it('reads a missing value as user-owned', () => {
    expect(resolveProvenance(null)).toBe('user');
    expect(resolveProvenance(undefined)).toBe('user');
  });

  it('passes the two real values through', () => {
    expect(resolveProvenance('detected')).toBe('detected');
    expect(resolveProvenance('user')).toBe('user');
  });

  it('reads the empty string as user-owned', () => {
    // Not reachable today (every v33 column is optional, so the null-value
    // function writes null) but it is exactly what a NON-optional string
    // column would have been backfilled with — the §K10 trap. If one of these
    // columns is ever made non-optional, this reader must not start reporting
    // rows as detected.
    expect(resolveProvenance('')).toBe('user');
  });

  it('reads an unrecognised value as user-owned', () => {
    // Same bias: only the literal 'detected' earns the right to be clobbered.
    expect(resolveProvenance('DETECTED')).toBe('user');
    expect(resolveProvenance('auto')).toBe('user');
  });
});

describe('resolveMembership', () => {
  it('reads a missing value as user-owned', () => {
    expect(resolveMembership(null)).toBe('user');
    expect(resolveMembership(undefined)).toBe('user');
  });

  it('passes all three real values through', () => {
    expect(resolveMembership('detected')).toBe('detected');
    expect(resolveMembership('user')).toBe('user');
    // Reads as a contradiction at the call site and is kept anyway (§G4's
    // "known wart"): a _source suffix would lie, 'removed' collides with the
    // Removed Series list, and a second column was already rejected.
    expect(resolveMembership('excluded')).toBe('excluded');
  });

  it('reads an unrecognised value as user-owned', () => {
    expect(resolveMembership('')).toBe('user');
    expect(resolveMembership('auto')).toBe('user');
  });
});

describe('resolveCanonicalSource — the one that does NOT coalesce', () => {
  it('keeps a missing value missing', () => {
    // §G5: null here means "no number is set", because canonical_number is
    // itself nullable. Coalescing it to 'user' would claim the user chose a
    // number that does not exist.
    expect(resolveCanonicalSource(null)).toBeNull();
    expect(resolveCanonicalSource(undefined)).toBeNull();
  });

  it('passes the two real values through', () => {
    expect(resolveCanonicalSource('detected')).toBe('detected');
    expect(resolveCanonicalSource('user')).toBe('user');
  });

  it('reads an unrecognised value as no source at all', () => {
    expect(resolveCanonicalSource('')).toBeNull();
    expect(resolveCanonicalSource('auto')).toBeNull();
  });
});

/**
 * The write half of the same column. It lived twice — once in `seriesQueries`
 * and once in `seriesEditorSave` — which is exactly the drift ADR 0001 was
 * written about: two copies of one rule, free to disagree about what null
 * means with nothing failing. It sits beside its reader now.
 */
describe('canonicalSourceFor — the write half', () => {
  it('claims a number the user set, and only then', () => {
    expect(canonicalSourceFor(4)).toBe('user');
    // Zero is a number somebody typed, not an absent one.
    expect(canonicalSourceFor(0)).toBe('user');
  });

  it('writes no source when there is no number', () => {
    // The §G5 rule from the reader's side: an unnumbered row must not come out
    // looking like one the user pinned.
    expect(canonicalSourceFor(null)).toBeNull();
  });

  it('round-trips through its own reader', () => {
    // The invariant the co-location buys: what this writes is what that reads.
    for (const n of [null, 0, 1, 12]) {
      expect(resolveCanonicalSource(canonicalSourceFor(n))).toBe(
        canonicalSourceFor(n),
      );
    }
  });
});
