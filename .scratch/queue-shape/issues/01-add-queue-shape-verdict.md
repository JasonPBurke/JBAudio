# 01 — Add `queueShapeOf` beside the existing mechanisms

**Spec:** `.scratch/queue-shape/spec.md` — decisions 1, 2, 4, 6.

**What to build:** One function that answers, for a Book, whether its Queue is **one item**
or **one item per Chapter**. That is the question nine separate pieces of code currently
answer for themselves, by consulting different sources, with results that can disagree.

It is pure and synchronous — a Book's chapters in, a verdict out, no Player read — because
the two queue builders ask it *in order to build a Queue* (so there is nothing to observe
yet) and the library list asks it once per visible row (so it must not touch the bridge).

The expand half of an expand–contract: nothing calls it yet and the app behaves
identically. Ticket `04` removes what it replaces.

⚠ It carries a **deliberate correction**. The existing derived check and the persisted
scan-time flag are the same predicate written twice, with an off-by-one in the copy
everything downstream reads. Today a **one-chapter Book** makes the "treat as single file"
and "uses chapter queue" helpers **both return true** — two contradictory claims about one
Book. The new verdict uses the correct threshold, so a one-chapter Book answers
`'one-item'`. Nothing consumes that yet; ticket `03` lands the behavioural effect.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Verdict is `'one-item' | 'multi-item'` — the vocabulary the book-end detection helper
      already ships, device-verified on both shapes. Not `'absolute' | 'chapter-relative'`;
      the architecture review's sketch is rejected, see the spec's `## Solution`
- [ ] Pure and synchronous; imports nothing from the player adapter, does no IO, logs
      nothing
- [ ] A Book with exactly one chapter answers `'one-item'`
- [ ] Memoised on the chapters array via a `WeakMap`, keyed by array reference so a rescan
      collects the old entry and there is no invalidation code
- [ ] The module header states **why** the memo is sound — both non-chapter inputs are
      process-constant — and that making either runtime-variable would silently serve stale
      verdicts with no symptom
- [ ] Unit tests cover all four authoring shapes from the spec, **including** the
      multi-file-with-embedded-chapters shape that is already broken in the queue builder —
      asserting what it currently answers, so later tickets cannot move it silently
- [ ] The matching threshold on the sibling chapter-data predicate is audited, every caller
      of both is checked for whether the old threshold was load-bearing, and the findings
      are recorded on this ticket before any threshold is changed
- [ ] The dead chapter-end helper (zero callers) is deleted
- [ ] `tsc` 0, eslint 0, full suite green
