# 12 — Device pass

**Spec:** `.scratch/queue-shape/spec.md` — `### Stage 2 — device pass required`.

**What to build:** Confirmation on a real device that the translator behaves on real Books,
and on two Books the corpus cannot produce.

⚠ **This is a PREVIEW build: `run-as` is refused, so there is no DB inspection.** Every
`.scratch` recipe that reads the database fails. All observations below are UI-only.

**Three real subjects, already in the corpus:** a multi-file Book with one chapter per file;
a single-file Book with chapters; a single-file Book with no chapters.

⚠ **"Single-file with chapters" is two runtime shapes and you cannot tell which from the
outside.** Clipping requires *all* of: real (not auto-generated) chapters, at least one
non-zero chapter start offset, and an estimated memory peak under half the device heap. So a
short single-file Book with real chapters loads as a chapter Queue, while the same Book
auto-chaptered — or a long one; the recorded out-of-memory case was 28.7 hours — loads as
one item. **Confirm which branch each subject takes before starting**, or all three may
exercise the same path and the pass proves less than it appears to.

**Two synthesised subjects**, for the cases the corpus cannot produce:

1. A Book with **one unusable chapter duration mid-list** — the exact-or-null path. This is
   the case with real history: a zero-duration chapter once marked a twenty-file Book
   Finished at chapter five, and unit tests did not catch it. A synthesised subject
   exercises scan → database → store → translator → render end to end, which no test lane
   reaches.
2. A **multi-file Book whose files each carry embedded chapters** — the fourth authoring
   shape. It is already broken in the queue builder, independently of this work; this
   subject turns "known unrepresented shape" from a hypothesis into characterised,
   documented behaviour. **Record what it does; do not fix it here** — see the spec's
   `## Out of scope`.

**Blocked by:** 11

**Status:** ready-for-agent

- [ ] Which runtime shape each of the three real subjects takes is confirmed and recorded
      before the pass begins
- [ ] Both single-file runtime shapes are actually exercised; if the corpus cannot, a
      subject is adjusted until they are
- [ ] A Book with a bad chapter duration renders something sensible in the library row —
      not blank, not `NaN` — and is **not** marked Finished early
- [ ] The player screen's elapsed and remaining times track correctly on a clipped
      single-file Book
- [ ] A footprint recorded during a chapter-Queue Book lands on the right chapter after the
      move in `10`
- [ ] The fourth-shape subject's behaviour is characterised and written up, with a separate
      issue filed for the queue-builder defect
- [ ] Any device-only logging added for this pass is removed before the ticket closes
