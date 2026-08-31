# 02 — Migrate the zero-delta consumers

**Spec:** `.scratch/queue-shape/spec.md` — `## Problem statement`, decision 2.

**What to build:** Every site that decides Queue shape for itself asks the verdict from
`01` instead. Each site keeps its own branching — this ticket moves *where the answer comes
from*, not what anyone does with it.

Three of these sites currently answer by asking the Player how many items are in the Queue.
That is the wrong question in a subtle way: it answers about *whichever Book happens to be
loaded*, which disagrees with the Book being asked about for the length of every Book
switch. Those three sites shed their Queue reads entirely — a Queue read marshals the whole
track list across the bridge, so on a clipped Book with hundreds of chapters this is a
saving, not a cost.

Two of the sites migrated here were on **no list** in the brief or its addenda — an inlined
copy of the "treat as single file" predicate in the library-row progress helper, and a
predicate in the player's progress bar that names the clipped-chapters gate as though it
answered "is Position chapter-relative?".

⚠ **This ticket has no behavioural delta on any Book that works today.** The progress bar's
predicate change looks like a fix but is inert: checked against all four authoring shapes,
the old and new answers agree on three, and diverge only on the shape that is already broken
in the queue builder for an unrelated reason. If a device difference appears here, something
is wrong — stop and investigate rather than accepting it.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] All three Player-reading shape sites now ask the verdict, and no longer read the Queue
      to do it
- [ ] The two previously unlisted variants — the inlined predicate in the library-row
      progress helper, and the progress bar's `isChapterRelative` — both ask the verdict
- [ ] The remaining consumers of the two shared shape predicates ask the verdict
- [ ] Queue reads that survive are only the honest ones: *is anything loaded?*, *am I at the
      last item?*, and *what is in it?* — none of them asking about shape
- [ ] No consumer's branching logic changes; only the source of the verdict
- [ ] Existing tests pass unmodified wherever behaviour is genuinely unchanged; any test that
      needed editing is called out on this ticket with the reason
- [ ] `tsc` 0, eslint 0, full suite green
