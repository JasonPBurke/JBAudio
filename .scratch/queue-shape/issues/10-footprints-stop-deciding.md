# 10 — Footprints stop deciding

**Spec:** `.scratch/queue-shape/spec.md` — decision 8.

**What to build:** Footprint recording stops working out what Position is measured against
from inside the persistence layer.

The persistence module currently asks the Player where it is, fetches the Book's chapters,
decides the Queue shape and branches — and carries a rule-shaped comment saying so:
*nothing under `db/` may decide what Position is measured against*. The adapter work left
that comment standing deliberately, because fixing it properly needed this module to exist.

The landing site already exists. The primitive that takes a Chapter Position and writes it
is already pure persistence; everything above it in that file is derivation that wandered
downstairs. Promote the primitive, and move the derivation up into the helper that already
owns the Active Book on behalf of all seven calling surfaces.

⚠ **The rule-shaped comment is DELETED, not reworded.** A comment describing a violation has
no correct rewrite once the violation is gone.

⚠ **Two live bugs are fixed here, and they are opposite.** Sibling functions each guard the
case the other one needs: one refuses to answer when the Queue index is unreadable *even
though the index is irrelevant for that shape*, and the other fabricates index zero *on the
shape where the index is the only source of truth* — silently recording a footprint at the
wrong chapter. The translator's contract fixes both; confirm both, don't assume.

Also drop the sort by chapter start offset. That offset is zero on every row of a multi-file
Book, so sorting by it is a no-op on the shape where order matters most. **Array position is
the ordering** — both queue builders map in order and neither filters nor sorts. Reading the
store's Book instead of re-fetching removes the sort and lands on the memo's stable array
reference at the same time.

⚠ **Do not mock the Active-Book footprint helper in this ticket's tests.** The existing
convention is to mock that helper rather than the persistence module — but this ticket moves
the code under test *into* it, so the usual mock would swallow exactly what is being
verified.

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] Nothing under `db/` imports the player adapter
- [ ] The Chapter Position primitive is promoted; derivation lives in the Active-Book helper
- [ ] The rule-shaped comment is deleted
- [ ] An unreadable Queue index no longer records a footprint at chapter zero, and a
      one-item Book no longer refuses to record because of an index it does not need — both
      confirmed by test
- [ ] The sort by chapter start offset is gone; ordering comes from array position
- [ ] Tests do not mock the Active-Book footprint helper; the reason is noted where the mock
      used to be
- [ ] `tsc` 0, eslint 0, full suite green
