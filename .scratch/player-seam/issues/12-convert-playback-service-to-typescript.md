# 12 — Convert the playback service to TypeScript

**What to build:** The app's most dangerous file becomes visible to the
toolchain — its active-Book reads checked, its nine inbound **Remote control**
handlers typed, its progress-tick path readable to the compiler for the first
time.

**Blocked by:** 08

**Status:** needs-triage

## Why it was excluded from the migration

709 lines, zero tests, playback-critical. Ticket 07 moves it onto the adapter,
and the only thing making that defensible is that the change there is
**mechanical and greppable**. A TypeScript conversion in the same diff would
destroy that property, and with it the ability to review ticket 07 by
inspection.

## What excluding it costs

The adapter's types do not protect this file. Its five active-Book reads get no
compile-time check and are verified by ticket 08's device pass instead — a
weaker guarantee than the rest of the migration enjoys. That gap is why this
ticket exists rather than being dropped.

## ⚠ Not the same thing as making it testable

RNTP was one of four blockers to testing this file; the others are a native
shake module, a native haptics module, and the database-backed stores. Reaching
it with tests is an "accept your inputs" problem — architecture-review candidate
03's treatment applied here — and it is a substantially larger job than a type
conversion. **Do not let the two be conflated in triage.**

## Acceptance criteria

- [ ] The file is TypeScript; `tsc` 0 with no new suppressions
- [ ] The five active-Book reads are checked
- [ ] The nine remote handlers have typed payloads
- [ ] Test count at or above baseline
- [ ] A device pass over the Remote control surface, as in ticket 08

## Triage note

`needs-triage`: needs a driver ruling on appetite. Large diff, most dangerous
file, no user-visible payoff, and the benefit is realised only if the file keeps
being edited.
