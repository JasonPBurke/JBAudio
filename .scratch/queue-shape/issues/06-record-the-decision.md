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

**Status:** resolved

- [x] Follows the repo's existing ADR format, numbered next in sequence
- [x] Status line records driver approval and the date, in the house style
- [x] Covers all three rulings, with the trade-off and the rejected alternative for each
- [x] Cites the adapter ADR for the Player-read ban rather than restating it
- [x] Does not cover the four excluded items above
- [x] Names what would make the decision wrong — the condition under which a future reader
      should reopen it, not just why it was right

## Answer

`docs/adr/0004-queue-shape-answers-in-coordinates-not-a-verdict.md`. Numbered next in
sequence; format follows 0003 — a claim as the title, a status line carrying driver
approval and provenance, the future misreading named in the lead, then the decision, the
per-ruling defence, and the reopen conditions.

Structural choices worth recording:

- **Each ruling gets its own section carrying its own trade-off and its own rejected
  alternative**, rather than 0003's single `## Why not the alternatives` block. The three
  rulings have different audiences — ruling 2 only matters to the three verdict callers —
  and a shared rejection block would have forced a reader chasing one of them through all
  three.
- **The four excluded items are absent, not listed as excluded.** A line saying "the
  threshold correction is out of scope" is still the ADR covering the threshold
  correction, and invites a future reader to treat it as a ruling. The Player-read ban is
  the one exception, because ticket 06 requires the citation: it appears as
  `## Not decided here`, pointing at ADR 0003 decision 2 and at 0003's
  `## Known incompleteness`, which names this module as the answer it deferred.
- **`## When this is wrong` gives one reopen condition per ruling**, each stated as
  something observable rather than a judgement: the verdict's caller count growing past
  three; shape D becoming representable once `handleBookPlay:217` is fixed; and — for
  ruling 3, the one at risk — the nulls not surviving the call sites. That last one is a
  genuine kill condition: if every migrated consumer collapses `null` identically, the
  best-effort variant has bought nothing and should go.

Every file:line pointer in the ADR was checked against the tree at `f40f82d` rather than
copied from the spec on trust: `bookProgressUtils.ts:66,77`, `scanLibrary.ts:532`
(`duration: 0` confirmed at :538), `handleBookPlay.ts:217`, `bookEndDetection.ts:43`,
`service.ts:677`, `PlayerProgressBar.tsx:82`, `footprintQueries.ts:54,174`. All resolve.

⚠ The spec's `## Ticket breakdown` numbers the ADR `05` and the translator `06`; the
issue files number them `06` and `07`. The issue files are what exist. No renumbering was
done — the spec's `### The ADR (ticket 05)` heading is stale by one.
