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

**Status:** ready-for-agent

- [ ] **Position** narrowed to the Player's reading within the current Queue item; its
      hazard warning removed
- [ ] **Book Position** added — how far into the whole Book; answers "how far through?"
- [ ] **Chapter Position** added — which Chapter, and how far into it; answers "how far into
      this one?"
- [ ] **Queue shape** added — one item or one per Chapter, described as a property of the
      **Queue** rather than of the Book, since the same Book can differ between devices
- [ ] Each entry carries an `_Avoid_` line in the existing house style
- [ ] Nothing about the device memory gate enters the glossary — it answers a *cause*, not a
      what
- [ ] No implementation detail anywhere in the additions
