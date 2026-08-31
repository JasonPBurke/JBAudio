# 04 — Remove the old mechanisms

**Spec:** `.scratch/queue-shape/spec.md` — `## Problem statement`, decision 7.

**What to build:** The contract half of expand–contract. With every call site migrated, the
predicates they used to call are deleted, and the app is left with exactly one answer to
"what shape is this Book's Queue?".

Also drops the persisted scan-time flag from every playback decision. The database column
**stays** — the feature flag's own header notes that Books still carry it — but no playback
code reads it. It bought nothing: the library store hydrates a Book's chapters in the same
conversion that reads the flag, so there was never a case where the flag was available and
the chapters were not.

After this ticket, **stage 1 is complete and shippable on its own.** Every consumer still
branches on shape; what changed is that they all branch on the *same* answer.

⚠ **No lint rule is added, deliberately** — see the spec's decision 7 for the reasoning and
for what to reconsider if stage 2 ever gets separated from stage 1 by more than a few days.
Do not add one as a bonus.

**Blocked by:** 02, 03

**Status:** ready-for-agent

- [ ] The two shared shape predicates and the derived single-file check are deleted
- [ ] The two inline copies migrated in `02` are gone, not merely bypassed
- [ ] A grep over non-test sources proves no mechanism from the spec's inventory table
      survives, and the grep is recorded on this ticket
- [ ] No playback code reads the persisted scan-time flag; the database column is untouched
- [ ] No lint rule is added
- [ ] `tsc` 0, eslint 0, full suite green
