# 09 — Migrate the persisted consumers

**Spec:** `.scratch/queue-shape/spec.md` — decision 3.

**What to build:** The surfaces that read where a Book was *left* rather than where the
Player is now — the library rows, the chapter list, the footprint list and the remaining-time
display — use the same translator as the live surfaces, passing persisted progress instead
of Player reads.

These are the consumers that prove the translator's signature was right. They have no Player
reads and must not gain any: the library row renders once per visible Book, unmemoized by
design, so an async bridge call there would be a scroll regression. Today one of them
re-implements the conversion inline **precisely because** it could not afford the live-only
helper — that inline copy is the shape of the bug this ticket ends.

**This ticket owns the user-visible half of exact-or-null.** A Book with a chapter whose
duration failed to extract now yields a null Book Position instead of a silently
undercounted number. Decide and implement what each surface shows for that — and it must be
sensible, never blank and never `NaN`. Where a surface genuinely wants an approximation, it
calls the best-effort variant by name, so the choice is visible at the call site.

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] Library rows, chapter list, footprint list and remaining-time all use the translator
- [ ] None of them makes a Player read, directly or transitively
- [ ] The inline conversion copy in the library-row progress helper is gone
- [ ] Each surface has a decided, implemented behaviour for a null Book Position — never
      blank, never `NaN` — and the decision is recorded on this ticket
- [ ] Any surface that wants an approximation calls the best-effort variant explicitly
- [ ] An `rn`-lane test proves a Book with an unusable chapter duration renders sensibly in
      the library row
- [ ] The `rn`-lane trap list in `docs/testing/jest-projects-and-rn-tests.md` is read before
      that test is written
- [ ] `tsc` 0, eslint 0, full suite green
