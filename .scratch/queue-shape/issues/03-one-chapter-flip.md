# 03 — The one-chapter flip

**Spec:** `.scratch/queue-shape/spec.md` — decision 2.

**What to build:** The two queue builders and the playback service's remaining shape sites
move onto the verdict from `01`. This is where the corrected threshold stops being latent
and becomes real.

**This ticket carries the only behavioural delta in stage 1.** A Book with exactly one
chapter — a single audio file with no chapter metadata, which is a shape the corpus
actually contains — is today claimed by two contradictory predicates at once. After this
ticket it is unambiguously a one-item Queue, which changes what the service does when that
Book reaches its end: it seeks back to the start rather than skipping to the first item.
Both land the listener at 0:00; the seek is the honest call on a Queue that has one item.

⚠ That end-of-queue branch is **not** guarded by a chapter-count check, unlike almost every
other consumer of this predicate. It is the one place the flip is observable, which is why
it gets its own ticket and its own test rather than riding along in `02`.

**Blocked by:** 02 — not a logical gate; both touch the playback service and would conflict
if run in parallel.

**Status:** ready-for-agent

- [ ] Both queue builders ask the verdict rather than deriving shape themselves
- [ ] The playback service's remaining shape sites ask the verdict
- [ ] A one-chapter Book reaching the end of its Queue seeks to the start instead of
      skipping, and a test against the fake-player harness pins that
- [ ] The fake-player harness is used rather than a new one — it already simulates the
      native seek clamp and is the recorded starting point for queue-position work
- [ ] Every other consumer of the flipped predicate is confirmed unaffected, either because
      it guards on chapter count or because both readings coincide for a one-chapter Book;
      the confirmation is recorded on this ticket
- [ ] `tsc` 0, eslint 0, full suite green
