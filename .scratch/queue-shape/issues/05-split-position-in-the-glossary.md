# 05 — Split `Position` in the glossary

**Spec:** `.scratch/queue-shape/spec.md` — decision 5.

**What to build:** `CONTEXT.md` gains the nouns the app has been missing.

The glossary has had **one word for three quantities** — what the Player reports, how far
through the whole Book a listener is, and how far into the current Chapter they are — so
every piece of code that needed one of the derived two had to work it out itself and had no
word to name which one it meant. Nine competing mechanisms is what a missing noun looks
like in code.

**Position** is narrowed to what the Player actually reports: where playback has reached
inside the current Queue item. Its `⚠` about what it is measured against is **deleted** —
that warning was the glossary admitting it had not finished. Position was never ambiguous;
the app was.

This follows the rule `CONTEXT.md` already states three times in its keys cluster: **name a
key after the question it answers**. Position is that rule's third instance, after the
`activeBookId` collision and the Series identity-versus-display-order merge.

`CONTEXT.md` is a glossary and nothing else — no implementation detail, no file paths, no
module names.

**Blocked by:** None — can start immediately. Independent of all code tickets.

**Status:** resolved

- [x] **Position** narrowed to the Player's reading within the current Queue item; its
      hazard warning removed
- [x] **Book Position** added — how far into the whole Book; answers "how far through?"
- [x] **Chapter Position** added — which Chapter, and how far into it; answers "how far into
      this one?"
- [x] **Queue shape** added — one item or one per Chapter, described as a property of the
      **Queue** rather than of the Book, since the same Book can differ between devices
- [x] Each entry carries an `_Avoid_` line in the existing house style
- [x] Nothing about the device memory gate enters the glossary — it answers a *cause*, not a
      what
- [x] No implementation detail anywhere in the additions

## Answer

Done in `CONTEXT.md`. **Position** is narrowed to the Player's reading within the current
Queue item and its `⚠` is gone; **Book Position**, **Chapter Position** and **Queue shape**
are added, each with an `_Avoid_` line. The Position trio sits together in "Playback and
progress"; **Queue shape** sits immediately after **Queue**, which is where a property of
the Queue belongs.

All seven boxes verified. Nothing about the device memory gate entered the file
(`grep` for heap/memory/clipped over `CONTEXT.md` returns nothing), and none of the four
entries names a file, module or function — stricter than the neighbouring **Active Book**
and **Requested Book**, which do, in breach of the preamble. That breach is pre-existing
and was left alone.

Two-axis review (Standards + Spec) run against the first commit. Spec axis: no missing
requirement, no scope creep. Both axes independently ranked the same finding first — the
new **Queue shape** entry restated the **Queue** entry's own second half, so two adjacent
entries answered one question. **Queue** now points at **Queue shape** and the fact has one
owner. The Spec axis also caught that "Derived, never reported" was false on half the
shapes: on a one-item Queue, Book Position *is* the raw reading, as the spec's own taxonomy
table says. Reworded to "not a second thing the Player reports". Both fixes are in.

Terminology check: `Queue shape` matches the capitalisation already used by
`docs/adr/0004-queue-shape-answers-in-coordinates-not-a-verdict.md`.

⚠ The glossary is now **ahead of the code**: **Book Position**'s `_Avoid_` line proscribes
"absolute position", which is still the live name in `calculateAbsolutePosition` and the
`absolutePosition` locals in `helpers/restoreLastActiveBook.ts` and
`helpers/handleBookPlay.ts`. Ticket `11` retires that pair; until it lands, the drift is
expected rather than a defect.

Commits: `74e7352` (the split), plus the review follow-up.
