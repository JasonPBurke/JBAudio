# 07 — Add the position translator beside the conversion pair

**Spec:** `.scratch/queue-shape/spec.md` — decisions 1, 3.

**What to build:** One function that answers "where am I, in Book terms?" and returns
**both** coordinates at once — Book Position and Chapter Position — so that no consumer ever
converts between them again.

This is the module the whole effort is for. Stage 1 gave every site the same verdict but
left each one branching on it; this removes the branch. The shape question is nothing but
*the conversion between the two coordinates*, so once the conversion happens in one place,
the question stops being asked.

⚠ **The translator already exists in the codebase, unguarded.** Two functions convert in
each direction today, both assuming the one-item mapping, both correct only because their
callers branch first. That is the mechanism that produced nine competing mechanisms: when
the conversion silently assumes a shape, the decision has to live at every call site and it
multiplies with them. This ticket writes the guarded version; `11` deletes the pair.

Pure and synchronous, taking plain numbers. That is what lets the persisted consumers —
library rows, chapter list, footprint list — use it without touching the bridge, and it is
why the signature must not grow a Player read for convenience.

**The contract is exact-or-null.** `null` means *I could not tell*, **never** *the answer is
zero*. This is the house rule already stated three times in this codebase, being extended
rather than invented: the sleep-timer ceiling returns null for not-known so callers can tell
"zero" from "not arrived"; book-end detection returns "none" and never "clear" for an
undecidable tick; the skip-next decision treats an unreadable index as *act*, not as *index
zero*.

Each coordinate is independently nullable, because they have **opposite reliability and it
flips with the shape**: on a chapter Queue, Chapter Position is exact and free while Book
Position must be summed from chapter durations, which is corruptible; on a one-item Queue it
is the other way round.

The best-effort variant returns an approximate Book Position, counting unusable durations as
zero. It is separate and separately named because the approximation must be **asked for by a
name that admits what it is**. See the spec for why one policy cannot serve both consumers.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Returns both coordinates from one call, computed once
- [ ] Pure and synchronous, plain numbers in; imports nothing from the player adapter
- [ ] Each coordinate independently nullable; the **whole** result is null — not a result of
      nulls — when there is no Book or no chapters, so callers can tell "no Book" from "a
      Book I cannot measure"
- [ ] An unreadable Queue index yields null for the coordinate that needs it, never a
      fabricated zero
- [ ] A chapter with an unusable duration voids **Book Position only**; Chapter Position
      still answers where it can
- [ ] The best-effort variant exists under a name that says it approximates, and its header
      names the shipped bug that makes the distinction load-bearing
- [ ] Unit tests cover both shapes, both coordinates, and every null path
- [ ] Nothing calls it yet; the app is unchanged
- [ ] `tsc` 0, eslint 0, full suite green
