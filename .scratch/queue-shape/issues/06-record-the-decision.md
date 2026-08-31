# 06 — Record the decision

**Spec:** `.scratch/queue-shape/spec.md` — `### The ADR`.

**What to build:** One ADR, next in sequence under `docs/adr/`.

It exists because a future reader **will** ask "why isn't there a `resolveQueueShape` here?
the architecture review said there should be." The review sketched a shape verdict as the
primary export; what got built answers in **coordinates** instead, and the other two rulings
follow from that one.

Three rulings, one story:

1. The position translator is the primary export; the shape verdict is demoted to three
   callers — the two queue builders and book-end detection.
2. `'one-item' | 'multi-item'`, not `'absolute' | 'chapter-relative'`.
3. Exact-or-null, with a separately named best-effort variant.

Ruling 3 is the borderline one and is included **precisely because** it reads as fussiness
in six months and would get "simplified" back to a zero default. That form has already
caused one shipped bug: a chapter whose duration failed to extract is stored as zero, which
emptied a remaining-time sum and marked a twenty-file Book Finished at chapter five. The
argument for keeping it — *the same arithmetic error is cosmetic in a library row and
destructive in book-end detection, and severity is a property of the caller, which the
translator cannot see* — needs to live somewhere a refactor cannot delete.

Deliberately **out** of the ADR: the ban on the module reading the Player (cite the existing
adapter ADR's second decision rather than restating it), the threshold correction and the
dropped scan-time flag (a bug fix — spec plus code comment is enough), and the memo (cheap
to reverse, unsurprising).

**Blocked by:** None — can start immediately. The decisions are settled; this records them.

**Status:** ready-for-agent

- [ ] Follows the repo's existing ADR format, numbered next in sequence
- [ ] Status line records driver approval and the date, in the house style
- [ ] Covers all three rulings, with the trade-off and the rejected alternative for each
- [ ] Cites the adapter ADR for the Player-read ban rather than restating it
- [ ] Does not cover the four excluded items above
- [ ] Names what would make the decision wrong — the condition under which a future reader
      should reopen it, not just why it was right
